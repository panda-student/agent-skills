'use strict';
const fs = require('fs');
const path = require('path');
const { normKey, disp } = require('./util');
const { detect, findRepoRoot } = require('./detect');
const { getDiffRanges, inDiff } = require('./diff');
const runners = {
  jscpd: require('./runners/jscpd'),
  astgrep: require('./runners/astgrep'),
  pmd: require('./runners/pmd'),
  eslint: require('./runners/eslint'),
  tsc: require('./runners/vuetsc'),
  knip: require('./runners/knip'),
};

/** 工具按语言路由:哪个语言触发哪些工具 */
function autoTools(langs) {
  const tools = new Set(['jscpd', 'astgrep']);
  if (langs.includes('java')) tools.add('pmd');
  if (langs.includes('js')) { tools.add('eslint'); tools.add('knip'); }
  if (langs.includes('ts')) { tools.add('tsc'); tools.add('knip'); }
  return [...tools];
}

async function runScan(args) {
  const targetAbs = path.resolve(args.target);
  if (!fs.existsSync(targetAbs)) {
    return { error: `目标不存在: ${targetAbs}` };
  }
  const { langs, byLang, files } = detect(targetAbs);
  if (!langs.length) {
    return { error: `目标内没有可识别的源码文件(java/js/ts/vue)`, target: disp(targetAbs) };
  }
  const repoRoot = findRepoRoot(targetAbs);

  // diff 行范围(可选)
  let diffRanges = null;
  let diffError = null;
  if (args.diff) {
    if (!repoRoot) diffError = '不在 git 仓库内,diff 过滤不可用';
    else {
      const d = getDiffRanges(repoRoot, args.diffRef || 'HEAD');
      diffRanges = d.ranges;
      diffError = d.error;
    }
  }

  const wanted = args.tools || autoTools(langs);
  const ctx = {
    targetAbs, targetKey: normKey(targetAbs), repoRoot, langs, byLang, allFiles: files,
    args, diffRanges, toolTimeout: args.timeoutMs || 300000,
  };

  const toolResults = {};
  const findings = [];
  await Promise.all(wanted.map(async (name) => {
    const runner = runners[name];
    if (!runner) {
      toolResults[name] = { status: 'error', detail: '未知工具', findings: [] };
      return;
    }
    const t0 = Date.now();
    try {
      const res = await runner.run(ctx);
      res.ms = Date.now() - t0;
      toolResults[name] = { status: res.status, detail: res.detail || '', ms: res.ms, findings: res.findings };
    } catch (e) {
      toolResults[name] = { status: 'error', detail: String(e && e.message).slice(0, 300), ms: Date.now() - t0, findings: [] };
    }
  }));

  // 范围内 + diff 行过滤 + 去重 + 截断
  const seen = new Set();
  const filtered = [];
  const sevOrder = { high: 0, medium: 1, low: 2, info: 3 };
  for (const name of wanted) {
    for (const f of toolResults[name].findings || []) {
      if (diffRanges) {
        const ok = f.fileLevel
          ? inDiff(diffRanges, f.file, 0) || inDiff(diffRanges, f.file, f.line)
          : (f.tool === 'jscpd' && f.evidence && f.evidence.pairFile)
            ? inDiff(diffRanges, f.file, f.line) || inDiff(diffRanges, f.evidence.pairFile, f.evidence.pairLine)
            : inDiff(diffRanges, f.file, f.line);
        if (!ok) continue;
      }
      const key = `${f.tool}|${f.rule}|${normKey(f.file)}|${f.line}|${f.message.slice(0, 60)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      filtered.push(f);
    }
  }
  filtered.sort((a, b) =>
    (sevOrder[a.severity] - sevOrder[b.severity]) || a.dimension.localeCompare(b.dimension) || a.file.localeCompare(b.file));
  const capped = filtered.slice(0, args.maxFindings);

  return {
    target: disp(targetAbs),
    repoRoot: repoRoot ? disp(repoRoot) : null,
    detected: langs,
    diff: args.diff ? { ref: args.diffRef || 'HEAD', files: diffRanges ? diffRanges.size : 0, error: diffError } : null,
    tools: Object.fromEntries(Object.entries(toolResults).map(([k, v]) => [k, { status: v.status, detail: v.detail, ms: v.ms, findings: (v.findings || []).length }])),
    truncated: filtered.length > capped.length ? filtered.length - capped.length : 0,
    findings: capped,
  };
}

module.exports = { runScan };
