'use strict';
const fs = require('fs');
const path = require('path');
const { normKey, disp, pool } = require('./util');
const { detect, findRepoRoot, findUp } = require('./detect');
const { getDiffRanges, inDiff, rangesOverlap } = require('./diff');
const { createDefaultRegistry } = require('./registry');
const { normalizeResult } = require('./tool');

/** 兼容旧调用:按语言路由(实际逻辑由注册表里各适配器声明) */
function autoTools(langs, hasVue) {
  return createDefaultRegistry().autoSelect(langs, hasVue);
}

/** 解析 diff 模式:--diff-commit 只看该提交;--staged 看暂存区;否则 ref → 工作区 */
function resolveDiff(args) {
  if (args.diffCommit) return { mode: 'commit', ref: args.diffCommit };
  if (args.staged) return { mode: 'staged', ref: args.diffRef || 'HEAD' };
  return { mode: 'worktree', ref: args.diffRef || 'HEAD' };
}

async function runScan(args, options = {}) {
  const registry = options.registry || createDefaultRegistry();
  const targetAbs = path.resolve(args.target);
  if (!fs.existsSync(targetAbs)) {
    return { error: `目标不存在: ${targetAbs}` };
  }
  const { langs, byLang, files, hasVue, truncated: filesTruncated } = detect(targetAbs);
  if (!langs.length && !hasVue) {
    return { error: `目标内没有可识别的源码文件(java/js/ts/vue)`, target: disp(targetAbs) };
  }
  const repoRoot = findRepoRoot(targetAbs);
  // 前端工具的配置/依赖搜索根:git 仓库根优先,否则找最近的 package.json;
  // 都不是时退回目标目录(不强制要求 git 仓库)
  const targetDir = fs.statSync(targetAbs).isFile() ? path.dirname(targetAbs) : targetAbs;
  const rootDir = repoRoot || findUp(targetAbs, ['package.json'], null) || targetDir;
  // knip 需要离目标最近的 package.json(monorepo 下不能直接用仓库根)
  const packageDir = repoRoot ? findUp(targetAbs, ['package.json'], repoRoot) : rootDir;

  // diff 行范围(可选)
  let diffRanges = null;
  let diffError = null;
  let diffInfo = null;
  if (args.diff) {
    if (!repoRoot) {
      diffError = '不在 git 仓库内,diff 过滤不可用';
      diffInfo = { ...resolveDiff(args), files: 0 };
    } else {
      const { mode, ref } = resolveDiff(args);
      const d = await getDiffRanges(repoRoot, { mode, ref });
      diffRanges = d.ranges;
      diffError = d.error;
      diffInfo = { mode, ref, files: d.ranges.size };
    }
  }

  const wanted = args.tools || registry.autoSelect(langs, hasVue);
  const ctx = {
    targetAbs, targetKey: normKey(targetAbs), repoRoot, rootDir, packageDir, langs, byLang, allFiles: files,
    hasVue, args, diffRanges, toolTimeout: args.timeoutMs || 300000,
  };

  const toolResults = {};
  const started = Date.now();
  await pool(wanted, args.jobs || 4, async (name) => {
    const tool = registry.get(name);
    if (!tool) {
      toolResults[name] = {
        status: 'error',
        detail: `未注册的工具: ${name}(可用: ${registry.names().join(', ')})`,
        ms: 0,
        findings: [],
      };
      return;
    }
    const t0 = Date.now();
    try {
      const res = normalizeResult(await tool.run(ctx), name);
      toolResults[name] = {
        status: res.status, detail: res.detail, ms: Date.now() - t0,
        findings: res.findings,
        ...(res.meta ? { meta: res.meta } : {}),
      };
    } catch (e) {
      toolResults[name] = {
        status: 'error', detail: String(e && e.message).slice(0, 300),
        ms: Date.now() - t0, findings: [],
      };
    }
  });
  const elapsed = Date.now() - started;

  // 范围内 + diff 行过滤 + 去重 + 截断
  const seen = new Set();
  const filtered = [];
  const sevOrder = { high: 0, medium: 1, low: 2, info: 3 };
  for (const name of wanted) {
    for (const f of toolResults[name].findings || []) {
      if (diffRanges && !keepByDiff(diffRanges, f)) continue;
      const key = `${f.tool}|${f.rule}|${normKey(f.file)}|${f.line}|${f.message.slice(0, 60)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      filtered.push(f);
    }
  }
  filtered.sort((a, b) =>
    (sevOrder[a.severity] - sevOrder[b.severity]) || a.dimension.localeCompare(b.dimension) || a.file.localeCompare(b.file));
  const maxFindings = Number.isFinite(args.maxFindings) ? args.maxFindings : 200;
  const capped = filtered.slice(0, maxFindings);

  const stats = { total: wanted.length, ok: 0, skipped: 0, partial: 0, error: 0 };
  for (const v of Object.values(toolResults)) stats[v.status] = (stats[v.status] || 0) + 1;
  const ok = stats.error === 0 && stats.partial === 0;

  return {
    ok,
    target: disp(targetAbs),
    repoRoot: repoRoot ? disp(repoRoot) : null,
    detected: langs,
    hasVue,
    files: { total: files.length, truncated: filesTruncated },
    diff: args.diff ? { ...diffInfo, error: diffError } : null,
    tools: Object.fromEntries(Object.entries(toolResults).map(([k, v]) => [k, {
      status: v.status, detail: v.detail, ms: v.ms, findings: (v.findings || []).length,
      ...(v.meta ? { meta: v.meta } : {}),
    }])),
    summary: {
      ...stats,
      findings: capped.length,
      filtered: filtered.length - capped.length,
      elapsedMs: elapsed,
    },
    truncated: filtered.length > capped.length ? filtered.length - capped.length : 0,
    findings: capped,
  };
}

/** finding 是否应保留在本次 diff 范围内 */
function keepByDiff(diffRanges, f) {
  if (f.fileLevel) {
    return inDiff(diffRanges, f.file, 0) || inDiff(diffRanges, f.file, f.line);
  }
  if (f.tool === 'jscpd' && f.evidence && f.evidence.pairFile) {
    // 重复块是 [start, start+lines-1] 的区间,不能只看起始行
    const len = Math.max(1, f.evidence.lines || 1);
    const a = rangesOverlap(diffRanges, f.file, f.line, f.line + len - 1);
    const b = rangesOverlap(diffRanges, f.evidence.pairFile, f.evidence.pairLine, f.evidence.pairLine + len - 1);
    return a || b;
  }
  return inDiff(diffRanges, f.file, f.line);
}

module.exports = { runScan, autoTools, keepByDiff };