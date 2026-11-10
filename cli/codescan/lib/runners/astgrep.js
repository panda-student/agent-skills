'use strict';
const fs = require('fs');
const path = require('path');
const { sh, disp } = require('../util');

const RULES_DIR = path.join(__dirname, '..', '..', 'rules', 'astgrep');
const HOME = path.join(__dirname, '..', '..');
// 规则 id 前缀 → 维度
const DIMENSION = { perf: 'performance', kiss: 'kiss' };
// ast-grep severity → 报告 severity
const SEVERITY = { error: 'high', warning: 'medium', info: 'low', hint: 'info' };
// 规则语言 → 本 CLI 检测到的语言
const RULE_LANG = { Java: 'java', JavaScript: 'js', TypeScript: 'ts' };

/** ast-grep 自定义 AST 规则:N+1 / 循环内 await / 嵌套循环(确定性粗筛,误报由模型复核) */
async function run(ctx) {
  const ruleFiles = fs.readdirSync(RULES_DIR).filter((f) => f.endsWith('.yml'));
  const findings = [];
  const details = [];
  for (const rf of ruleFiles) {
    const full = path.join(RULES_DIR, rf);
    const head = fs.readFileSync(full, 'utf8').split(/\r?\n/).slice(0, 5).join('\n');
    const langLine = (head.match(/^language:\s*(\S+)/m) || [])[1];
    const ruleLang = RULE_LANG[langLine];
    if (!ruleLang || !ctx.langs.includes(ruleLang)) continue;
    const target = disp(ctx.targetAbs);
    const r = sh(
      `npx --yes --package @ast-grep/cli ast-grep scan --rule "${disp(full)}" --json "${target}"`,
      { cwd: HOME, timeoutMs: ctx.toolTimeout },
    );
    if (!r.stdout.trim().startsWith('[')) {
      details.push(`${rf}: ${(r.stderr || r.stdout || 'fail').slice(0, 150)}`);
      continue;
    }
    let matches;
    try { matches = JSON.parse(r.stdout); } catch { matches = []; }
    for (const m of matches) {
      const dim = DIMENSION[(m.ruleId || '').split('-')[0]] || 'quality';
      findings.push({
        tool: 'ast-grep', rule: m.ruleId, dimension: dim,
        severity: SEVERITY[m.severity] || 'low',
        file: disp(m.file), line: (m.range && m.range.start ? m.range.start.line + 1 : 0),
        message: `候选: ${m.text} (${ruleNote(full)})`,
        evidence: { matched: m.text },
      });
    }
    details.push(`${rf}: ${matches.length} matches`);
  }
  return { status: 'ok', detail: details.join('; '), findings };
}

function ruleNote(ruleFile) {
  try {
    const txt = fs.readFileSync(ruleFile, 'utf8');
    return (txt.match(/^note:\s*(.+)$/m) || [])[1] || '候选模式命中';
  } catch { return '候选模式命中'; }
}

module.exports = { name: 'ast-grep', run };
