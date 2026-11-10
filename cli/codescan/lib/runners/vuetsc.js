'use strict';
const path = require('path');
const { sh, disp, inScope } = require('../util');
const { binExists } = require('../detect');

const LINE_RE = /^(.+?)\((\d+),\d+\): (error|warning) (TS\d+): (.*)$/;

/** vue-tsc / tsc 类型检查(TS 项目):类型级 bug(确定性),按目标范围过滤 */
async function run(ctx) {
  const repo = ctx.repoRoot;
  if (!repo) return { status: 'skipped', detail: '不在 git/npm 仓库内', findings: [] };
  if (!ctx.langs.includes('ts')) return { status: 'skipped', detail: '无 ts 文件', findings: [] };
  const isVue = binExists(repo, 'vue-tsc');
  const isTsc = !isVue && binExists(repo, 'tsc');
  if (!isVue && !isTsc) {
    return { status: 'skipped', detail: '依赖未安装(先 npm/pnpm install),无 vue-tsc/tsc 可执行文件', findings: [] };
  }
  const bin = isVue ? 'vue-tsc' : 'tsc';
  const r = sh(`npx --no-install ${bin} --noEmit --pretty false`, { cwd: repo, timeoutMs: Math.max(ctx.toolTimeout, 600000) });
  const findings = [];
  let total = 0;
  for (const line of (r.stdout || '').split(/\r?\n/)) {
    const m = line.match(LINE_RE);
    if (!m) continue;
    total++;
    const file = path.resolve(repo, m[1]);
    if (!inScope(ctx.targetKey, file)) continue;
    findings.push({
      tool: bin, rule: m[4], dimension: 'quality',
      severity: m[3] === 'error' ? 'high' : 'low',
      file: disp(file), line: parseInt(m[2], 10) || 0,
      message: m[5],
    });
  }
  if (total && !findings.length) {
    return { status: 'ok', detail: `全项目 ${total} 个类型问题,均不在审查目标内`, findings: [] };
  }
  return { status: 'ok', detail: `全项目 ${total} 个类型问题,目标内 ${findings.length} 个`, findings };
}

module.exports = { name: 'tsc', run };
