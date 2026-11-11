'use strict';
const fs = require('fs');
const path = require('path');
const { sh, disp, mkTmpDir, extractJson } = require('../util');

const RULES_DIR = path.join(__dirname, '..', '..', 'rules', 'astgrep');
const HOME = path.join(__dirname, '..', '..');
// 规则 id 前缀 → 维度
const DIMENSION = { perf: 'performance', kiss: 'kiss' };
// ast-grep severity → 报告 severity
const SEVERITY = { error: 'high', warning: 'medium', info: 'low', hint: 'info' };
// 规则语言 → 本 CLI 检测到的语言
const RULE_LANG = { Java: 'java', JavaScript: 'js', TypeScript: 'ts' };
const AST_GREP_VERSION = process.env.CODESCAN_AST_GREP_VERSION || '0.51.1';

/** ast-grep 自定义 AST 规则:N+1 / 循环内 await / 嵌套循环(确定性粗筛,误报由模型复核) */
async function run(ctx) {
  const ruleFiles = fs.readdirSync(RULES_DIR).filter((f) => f.endsWith('.yml'));
  const active = ruleFiles.filter((rf) => {
    const meta = readRuleMeta(path.join(RULES_DIR, rf));
    return meta.lang && RULE_LANG[meta.lang] && ctx.langs.includes(RULE_LANG[meta.lang]);
  });
  if (!active.length) return { status: 'skipped', detail: '没有匹配当前语言的 ast-grep 规则', findings: [] };

  // 一次扫描加载全部规则(原来每条规则单独起一次 npx,冷启动极慢)
  const tmp = mkTmpDir();
  let findings = null;
  try {
    const cfg = path.join(tmp, 'sgconfig.yml');
    fs.writeFileSync(cfg, `ruleDirs:\n  - "${RULES_DIR.replace(/\\/g, '/').replace(/"/g, '\\"')}"\n`);
    const r = await sh(
      `npx --yes --package @ast-grep/cli@${AST_GREP_VERSION} ast-grep scan --config "${disp(cfg)}" --json "${disp(ctx.targetAbs)}"`,
      { cwd: HOME, timeoutMs: ctx.toolTimeout },
    );
    findings = parseScan(r.stdout, active);
    if (!findings) {
      // 配置方式不兼容时退回逐规则调用(保持旧行为)
      const fallback = await runPerRule(active, ctx);
      if (fallback.findings === null) {
        return { status: 'error', detail: 'ast-grep 全部调用失败: ' + fallback.details.slice(0, 2).join(' | '), findings: [] };
      }
      return {
        status: fallback.failed ? 'partial' : 'ok',
        detail: `fallback 逐规则;${fallback.details.join('; ')}`,
        findings: fallback.findings,
      };
    }
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ }
  }
  return { status: 'ok', detail: `${active.length} 条规则, ${findings.length} matches`, findings };
}

function parseScan(stdout, active) {
  const matches = extractJson(stdout);
  if (!Array.isArray(matches)) return null;
  const notes = ruleNotes(active);
  return matches.map((m) => ({
    tool: 'ast-grep',
    rule: m.ruleId || 'unknown',
    dimension: DIMENSION[(m.ruleId || '').split('-')[0]] || 'quality',
    severity: severityOf(m.severity),
    file: disp(m.file),
    line: m.range && m.range.start ? m.range.start.line + 1 : 0,
    message: `候选: ${m.text} (${notes[m.ruleId] || '候选模式命中'})`,
    evidence: { matched: m.text },
  }));
}

async function runPerRule(active, ctx) {
  const findings = [];
  const details = [];
  let failed = 0;
  for (const rf of active) {
    const full = path.join(RULES_DIR, rf);
    const r = await sh(
      `npx --yes --package @ast-grep/cli@${AST_GREP_VERSION} ast-grep scan --rule "${disp(full)}" --json "${disp(ctx.targetAbs)}"`,
      { cwd: HOME, timeoutMs: ctx.toolTimeout },
    );
    const matches = extractJson(r.stdout);
    if (!Array.isArray(matches)) {
      failed++;
      details.push(`${rf}: ${(r.stderr || r.stdout || r.error || 'fail').slice(0, 150)}`);
      continue;
    }
    const note = readRuleMeta(full).note || '候选模式命中';
    for (const m of matches) {
      findings.push({
        tool: 'ast-grep', rule: m.ruleId, dimension: DIMENSION[(m.ruleId || '').split('-')[0]] || 'quality',
        severity: severityOf(m.severity),
        file: disp(m.file), line: (m.range && m.range.start ? m.range.start.line + 1 : 0),
        message: `候选: ${m.text} (${note})`,
        evidence: { matched: m.text },
      });
    }
    details.push(`${rf}: ${matches.length} matches`);
  }
  return { findings: failed === active.length ? null : findings, details, failed };
}

function readRuleMeta(file) {
  try {
    const txt = fs.readFileSync(file, 'utf8');
    return {
      lang: (txt.match(/^language:\s*(\S+)/m) || [])[1],
      note: (txt.match(/^note:\s*(.+)$/m) || [])[1],
    };
  } catch {
    return {};
  }
}

function ruleNotes(files) {
  const map = {};
  for (const rf of files) {
    const meta = readRuleMeta(path.join(RULES_DIR, rf));
    const id = (fs.readFileSync(path.join(RULES_DIR, rf), 'utf8').match(/^id:\s*(\S+)/m) || [])[1];
    if (id && meta.note) map[id] = meta.note;
  }
  return map;
}

function severityOf(v) {
  if (typeof v === 'number') return v <= 0 ? 'high' : v === 1 ? 'medium' : v === 2 ? 'low' : 'info';
  return SEVERITY[v] || 'low';
}

module.exports = {
  name: 'ast-grep',
  languages: ['*'],
  dimensions: ['performance', 'kiss'],
  description: 'AST 结构模式匹配',
  run,
};