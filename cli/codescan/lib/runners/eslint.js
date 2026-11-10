'use strict';
const path = require('path');
const fs = require('fs');
const { sh, disp } = require('../util');

// 风格类规则(噪音,与审查维度无关,直接丢弃)
const STYLE_PATTERNS = [
  'indent', 'quotes', 'semi', 'comma-dangle', 'comma-spacing', 'comma-style', 'eol-last',
  'no-multiple-empty-lines', 'key-spacing', 'space-', 'padding-line', 'object-curly',
  'arrow-parens', 'operator-linebreak', 'brace-style', 'padded-blocks', 'dot-location',
  'array-bracket', 'block-spacing', 'camelcase', 'func-call-spacing', 'jsx-quotes',
  'max-len', 'no-trailing-spaces', 'unicode-bom', 'wrap-iife', 'yield-star-spacing',
];
const STYLE_RE = new RegExp('^(' + STYLE_PATTERNS.map((p) => p.replace(/[-]/g, '\\-')).join('|') + '|(vue|prettier)/)');
// 复杂度类规则 → KISS 维度
const KISS_RULES = /^(complexity|max-lines-per-function|max-lines|max-statements|max-depth|max-params|sonarjs\/cognitive-complexity|sonarjs\/no-small-switch)/;

const ESLINT_CANDIDATES = ['.eslintrc.js', '.eslintrc.cjs', '.eslintrc.json', '.eslintrc.yml', '.eslintrc'];

/** 仓库本地 ESLint(JS/Vue):bug/错误处理(确定性) */
async function run(ctx) {
  const repo = ctx.repoRoot;
  if (!repo) return { status: 'skipped', detail: '不在 git/npm 仓库内', findings: [] };
  const hasConfig = ESLINT_CANDIDATES.some((f) => fs.existsSync(path.join(repo, f)));
  const hasEslint = fs.existsSync(path.join(repo, 'node_modules', 'eslint'));
  if (!hasConfig || !hasEslint) {
    return { status: 'skipped', detail: `仓库无 eslint 配置或未安装(config=${hasConfig}, deps=${hasEslint})`, findings: [] };
  }
  const jsFiles = ctx.byLang.js;
  if (!jsFiles.length) return { status: 'skipped', detail: '无 js/vue 文件', findings: [] };

  // 相对路径分批调用(Windows 命令行长度限制)
  const findings = [];
  const details = [];
  const chunks = [];
  for (let i = 0; i < jsFiles.length && i < 300; i += 30) chunks.push(jsFiles.slice(i, i + 30));
  let useOverride = false;   // 探测到 @babel/eslint-parser 缺失后,对所有批次生效
  let probed = false;
  for (const chunk of chunks) {
    // 相对路径(相对 repo 根),不要再做 disp()——那会按 CLI 进程 cwd 重新绝对化
    const rel = chunk.map((f) => '"' + path.relative(repo, f).replace(/\\/g, '/') + '"').join(' ');
    const extra = useOverride ? ' --parser-options {"parser":"babel-eslint"}' : '';
    let r = sh(`npx --no-install eslint --no-fix --format json${extra} ${rel}`, { cwd: repo, timeoutMs: ctx.toolTimeout });
    let results = safeJson(r.stdout);
    // 已知坑:.eslintrc 引用未安装的 @babel/eslint-parser(如 pms_frontend),用旧包名兜底;
    // 分批扫描时后续批次也要应用,否则 fatal 无 ruleId 被静默丢弃
    if (!probed && hasFatalParser(results)) {
      details.push('parser fallback: @babel/eslint-parser → babel-eslint');
      useOverride = true;
      r = sh(`npx --no-install eslint --no-fix --format json --parser-options {"parser":"babel-eslint"} ${rel}`, { cwd: repo, timeoutMs: ctx.toolTimeout });
      results = safeJson(r.stdout);
    }
    probed = true;
    if (!results) { details.push((r.stderr || 'no output').slice(0, 120)); continue; }
    collect(results, findings);
  }
  if (useOverride) details.push('(已全程应用解析器兜底)');
  return { status: 'ok', detail: details.join('; ') || `${jsFiles.length} files`, findings };
}

function hasFatalParser(results) {
  return Array.isArray(results) && results.some((f) =>
    (f.messages || []).some((m) => m.fatal && /Cannot find module ['"]@babel\/eslint-parser['"]/.test(m.message || '')));
}

function safeJson(s) {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : null;
  } catch { return null; }
}

function collect(results, findings) {
  for (const f of results) {
    for (const m of f.messages || []) {
      if (!m.ruleId || STYLE_RE.test(m.ruleId)) continue;
      findings.push({
        tool: 'eslint', rule: m.ruleId,
        dimension: KISS_RULES.test(m.ruleId) ? 'kiss' : 'quality',
        severity: m.fatal ? 'high' : m.severity === 2 ? 'medium' : 'low',
        file: disp(f.filePath), line: m.line || 0,
        message: m.message || '',
      });
    }
  }
}

module.exports = { name: 'eslint', run };
