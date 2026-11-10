'use strict';
const path = require('path');
const fs = require('fs');
const { sh, disp, normKey, inScope } = require('../util');

/** knip 死代码检测(JS/TS):未使用文件/导出/依赖 → KISS 维度(确定性候选) */
async function run(ctx) {
  const repo = ctx.repoRoot;
  if (!repo) return { status: 'skipped', detail: '不在 git/npm 仓库内', findings: [] };
  if (!ctx.langs.includes('js') && !ctx.langs.includes('ts')) {
    return { status: 'skipped', detail: '无 js/ts 文件', findings: [] };
  }
  if (!fs.existsSync(path.join(repo, 'package.json'))) {
    return { status: 'skipped', detail: '无 package.json', findings: [] };
  }
  // --no-exit-code:发现问题不返回非零;--no-progress? knip 无此 flag,静默靠 reporter json
  const r = sh('npx --yes knip --reporter json --no-exit-code', { cwd: repo, timeoutMs: ctx.toolTimeout });
  const data = safeJson(r.stdout);
  if (!data) {
    return { status: 'error', detail: (r.stderr || r.stdout || 'no output').slice(0, 200), findings: [] };
  }
  const issues = data.issues || data; // 兼容新旧 reporter 结构
  const findings = [];
  let scannedFiles = 0;
  for (const entry of issues) {
    if (!entry || !entry.file) continue;
    const entryFile = path.resolve(repo, entry.file);
    scannedFiles++;
    if (!inScope(ctx.targetKey, entryFile)) continue;
    // 该文件范围内的发现
    for (const f of entry.files || []) {
      push(findings, entryFile, 0, '未使用文件', `${f.name || entry.file} 未被任何入口引用(死文件候选)`);
    }
    let n = 0;
    for (const e of entry.exports || []) {
      if (n++ >= 5) break; // 单文件最多报 5 个,防止刷屏
      push(findings, entryFile, e.line || 0, '未使用导出', `export "${e.name}" 未被引用(死代码候选)`);
    }
    for (const d of [].concat(entry.dependencies || [], entry.devDependencies || [])) {
      const name = typeof d === 'string' ? d : d.name;
      if (name) push(findings, entryFile, 0, '未使用依赖', `依赖 ${name} 未被引用(需人工确认动态引用)`);
    }
  }
  return { status: 'ok', detail: `knip 扫描 ${scannedFiles} 个文件条目`, findings };
}

function push(findings, file, line, rule, message) {
  findings.push({
    tool: 'knip', rule, dimension: 'kiss', severity: 'low',
    file: disp(file), line, message,
  });
}

function safeJson(s) {
  const t = (s || '').trim();
  if (!t.startsWith('{') && !t.startsWith('[')) return null;
  try { return JSON.parse(t); } catch { return null; }
}

module.exports = { name: 'knip', run };
