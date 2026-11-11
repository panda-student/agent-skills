'use strict';
const path = require('path');
const { sh, disp, inScope } = require('../util');
const { findUp, findBin } = require('../detect');

const LINE_RES = [
  /^(.+?)\((\d+),\d+\): (error|warning) (TS\d+): (.*)$/,
  /^(.+?):(\d+):\d+ - (error|warning) (TS\d+): (.*)$/,
];

/** vue-tsc / tsc 类型检查(TS/Vue 项目):类型级 bug(确定性),按目标范围过滤 */
async function run(ctx) {
  const repo = ctx.rootDir || ctx.repoRoot;
  if (!repo) return { status: 'skipped', detail: '找不到项目根目录', findings: [] };
  if (!ctx.langs.includes('ts') && !ctx.hasVue) {
    return { status: 'skipped', detail: '无 ts/vue 文件', findings: [] };
  }

  const start = ctx.targetAbs;
  // monorepo:优先用离目标最近的 tsconfig,而不是仓库根的
  const tsconfigDir = findUp(start, ['tsconfig.json'], repo);
  const searchDir = tsconfigDir || start;

  // Vue 项目优先 vue-tsc;纯 TS 项目用 tsc
  const candidates = ctx.hasVue ? ['vue-tsc', 'tsc'] : ['tsc', 'vue-tsc'];
  let bin = null;
  for (const name of candidates) {
    if (findBin(searchDir, repo, name) || findBin(repo, repo, name)) { bin = name; break; }
  }
  if (!bin) {
    return { status: 'skipped', detail: '依赖未安装(先 npm/pnpm install),无 vue-tsc/tsc 可执行文件', findings: [] };
  }

  const cwd = tsconfigDir || repo;
  const projectArg = tsconfigDir ? ' -p "tsconfig.json"' : '';
  const r = await sh(
    `npx --no-install ${bin} --noEmit --pretty false${projectArg}`,
    { cwd, timeoutMs: Math.max(ctx.toolTimeout, 600000) },
  );

  if (r.spawnError) {
    return { status: 'error', detail: `${bin} 启动失败: ${(r.error || r.stderr || '').slice(0, 200)}`, findings: [] };
  }

  const findings = [];
  let total = 0;
  let unparsed = 0;
  let firstUnparsed = '';
  for (const line of (r.stdout || '').split(/\r?\n/)) {
    let m = null;
    for (const re of LINE_RES) {
      m = line.match(re);
      if (m) break;
    }
    if (!m) {
      if (/error TS\d+/.test(line)) {
        unparsed++;
        if (!firstUnparsed) firstUnparsed = line.trim();
      }
      continue;
    }
    total++;
    const file = path.isAbsolute(m[1]) ? m[1] : path.resolve(cwd, m[1]);
    if (!inScope(ctx.targetKey, file)) continue;
    findings.push({
      tool: bin, rule: m[4], dimension: 'quality',
      severity: m[3] === 'error' ? 'high' : 'low',
      file: disp(file), line: parseInt(m[2], 10) || 0,
      message: m[5],
    });
  }

  // 只有全局错误、没有任何可定位的类型问题 → 类型检查本身没完成
  if (total === 0 && unparsed > 0) {
    return { status: 'error', detail: `${bin} 未能完成类型检查: ${firstUnparsed.slice(0, 300)}`, findings: [] };
  }
  // 类型检查本身没跑起来(tsconfig 错误、依赖缺失等)
  if (total === 0 && unparsed === 0 && r.code !== 0) {
    const msg = (r.stderr || r.stdout || '').trim().slice(0, 300);
    return { status: 'error', detail: `${bin} 运行失败(code=${r.code}): ${msg || '无输出'}`, findings: [] };
  }

  const where = tsconfigDir ? path.relative(repo, path.join(tsconfigDir, 'tsconfig.json')).replace(/\\/g, '/') : '(默认)';
  const detail = `全项目 ${total} 个类型问题,目标内 ${findings.length} 个;配置 ${where}${unparsed ? `, ${unparsed} 行无法解析` : ''}`;
  return { status: unparsed ? 'partial' : 'ok', detail, findings };
}

module.exports = {
  name: 'tsc',
  languages: ['ts', 'vue'],
  dimensions: ['quality'],
  description: 'tsc / vue-tsc 类型检查',
  run,
};