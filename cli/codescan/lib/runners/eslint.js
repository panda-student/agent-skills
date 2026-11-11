'use strict';
const path = require('path');
const fs = require('fs');
const { sh, disp, extractJson } = require('../util');
const { findUp, findBin } = require('../detect');

// 风格类规则(噪音,与审查维度无关,直接丢弃)
const STYLE_PATTERNS = [
  'indent', 'quotes', 'semi', 'comma-dangle', 'comma-spacing', 'comma-style', 'eol-last',
  'no-multiple-empty-lines', 'key-spacing', 'space-', 'padding-line', 'object-curly',
  'arrow-parens', 'operator-linebreak', 'brace-style', 'padded-blocks', 'dot-location',
  'array-bracket', 'block-spacing', 'camelcase', 'func-call-spacing', 'jsx-quotes',
  'max-len', 'no-trailing-spaces', 'unicode-bom', 'wrap-iife', 'yield-star-spacing',
];
const STYLE_RE = new RegExp('^(' + STYLE_PATTERNS.map((p) => p.replace(/[-]/g, '\\-')).join('|') + '|prettier/)');
// 只过滤 vue 的排版类规则;vue/no-unused-vars、vue/no-mutating-props 等质量规则必须保留
const VUE_STYLE_RE = /^vue\/(html-indent|html-closing-bracket-newline|html-closing-bracket-spacing|html-end-tags|html-quotes|html-self-closing|html-comment-content-newline|html-comment-indent|html-comment-spacing|max-attributes-per-line|max-len|multiline-html-element-content-newline|singleline-html-element-content-newline|attributes-order|attribute-hyphenation|mustache-interpolation-spacing|no-multi-spaces|no-spaces-around-equal-signs-in-attribute|padding-line-between-blocks|order-in-components|component-tags-order|static-class-names-order|v-bind-style|v-on-style|v-slot-style|prefer-prop-type-boolean-first|this-in-template)$/;

function isStyleRule(ruleId) {
  return STYLE_RE.test(ruleId) || VUE_STYLE_RE.test(ruleId) || ruleId.startsWith('prettier/');
}
// 复杂度类规则 → KISS 维度
const KISS_RULES = /^(complexity|max-lines-per-function|max-lines|max-statements|max-depth|max-params|sonarjs\/cognitive-complexity|sonarjs\/no-small-switch)/;

const FLAT_CONFIGS = ['eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs', 'eslint.config.ts'];
const LEGACY_CONFIGS = [
  '.eslintrc.js', '.eslintrc.cjs', '.eslintrc.json', '.eslintrc.yml', '.eslintrc.yaml', '.eslintrc',
];
const ALL_CONFIGS = [...FLAT_CONFIGS, ...LEGACY_CONFIGS];

/** 仓库本地 ESLint(JS/TS/Vue):bug/错误处理(确定性) */
async function run(ctx) {
  const repo = ctx.rootDir || ctx.repoRoot;
  if (!repo) return { status: 'skipped', detail: '找不到项目根目录', findings: [] };
  const files = ctx.byLang.js || [];
  if (!files.length) return { status: 'skipped', detail: '无 js/ts/vue 文件', findings: [] };

  // monorepo:按最近的 eslint 配置目录分组,而不是只用仓库根配置
  const groups = groupByConfig(files, repo);
  if (!groups.size) {
    return { status: 'skipped', detail: '未找到 eslint 配置(eslint.config.* 或 .eslintrc.*)', findings: [] };
  }

  const version = await detectVersion(repo);
  const findings = [];
  const details = [];
  let attempted = 0;
  let failed = 0;
  let fatal = 0;
  let linted = 0;
  let ignored = 0;

  for (const [configDir, group] of groups) {
    const hasEslint = findBin(configDir, repo, 'eslint') !== null;
    if (!hasEslint) {
      failed++;
      details.push(`${rel(repo, configDir)}: 未安装 eslint`);
      continue;
    }
    const flat = isFlat(configDir);
    for (const chunk of chunkBy(group, 50)) {
      attempted++;
      const relFiles = chunk.map((f) => '"' + path.relative(configDir, f).replace(/\\/g, '/') + '"').join(' ');
      const retryable = !flat && (version === null || version < 9);

      let r = await invoke(configDir, relFiles, ctx.toolTimeout, false);
      let results = safeJson(r.stdout);
      let usedFallback = false;

      // 已知坑:.eslintrc 引用未安装的 @babel/eslint-parser;仅 ESLint <9 可用 --parser-options
      if (results && retryable && hasFatalBabel(results)) {
        const r2 = await invoke(configDir, relFiles, ctx.toolTimeout, true);
        const results2 = safeJson(r2.stdout);
        if (results2) {
          r = r2;
          results = results2;
          usedFallback = true;
        }
      }
      if (usedFallback) details.push('parser fallback: @babel/eslint-parser → babel-eslint');

      if (!results) {
        failed++;
        details.push(`${rel(repo, configDir)}: ${(r.stderr || r.stdout || 'no output').slice(0, 160)}`);
        continue;
      }
      const stats = collect(results, findings);
      fatal += stats.fatal;
      ignored += stats.ignored;
      linted += chunk.length;
    }
  }

  if (attempted === 0) {
    return { status: 'error', detail: '找到 eslint 配置,但没有可用的 eslint 安装(先安装依赖)', findings: [] };
  }
  if (failed === attempted) {
    return { status: 'error', detail: '所有 lint 批次均失败: ' + details.join('; ').slice(0, 400), findings };
  }
  const covered = [...groups.values()].reduce((n, g) => n + g.length, 0);
  const uncovered = files.length - covered;
  const checked = linted - ignored;
  const allIgnored = linted > 0 && ignored === linted;
  const status = failed > 0 || fatal > 0 || uncovered > 0 || allIgnored ? 'partial' : 'ok';
  const summary = `lint ${checked} 个文件(${attempted} 批次)` +
    `${ignored ? `, ${ignored} 个被 eslintignore 忽略` : ''}`;
  const notes = [
    `${summary}${fatal ? `, ${fatal} 个解析失败` : ''}${uncovered ? `, ${uncovered} 个文件无 eslint 配置未检查` : ''}`,
    ...details,
  ];
  return { status, detail: notes.join('; '), findings };
}

function invoke(cwd, relFiles, timeoutMs, useBabelFallback) {
  const extra = useBabelFallback ? ' --parser-options {"parser":"babel-eslint"}' : '';
  return sh(`npx --no-install eslint --no-fix --format json${extra} ${relFiles}`, { cwd, timeoutMs });
}

/** 按最近的 eslint 配置目录分组;没有配置的文件不参与 */
function groupByConfig(files, repo) {
  const map = new Map();
  for (const f of files) {
    const dir = findUp(f, ALL_CONFIGS, repo);
    if (!dir) continue;
    if (!map.has(dir)) map.set(dir, []);
    map.get(dir).push(f);
  }
  return map;
}

function isFlat(dir) {
  return FLAT_CONFIGS.some((f) => fs.existsSync(path.join(dir, f)));
}

async function detectVersion(repo) {
  const r = await sh('npx --no-install eslint --version', { cwd: repo, timeoutMs: 60000 });
  if (!r.ok) return null;
  const m = (r.stdout || '').match(/v?(\d+)\./);
  return m ? parseInt(m[1], 10) : null;
}

function hasFatalBabel(results) {
  return Array.isArray(results) && results.some((f) =>
    (f.messages || []).some((m) => m.fatal && /Cannot find module ['"]@babel\/eslint-parser['"]/.test(m.message || '')));
}

function safeJson(s) {
  const v = extractJson(s);
  return Array.isArray(v) ? v : null;
}

function collect(results, findings) {
  const stats = { fatal: 0, ignored: 0 };
  for (const f of results) {
    // eslintignore 命中的文件没有任何实际检查,不能算作"已 lint"
    if ((f.messages || []).some((m) => /File ignored because/i.test(m.message || ''))) {
      stats.ignored++;
      continue;
    }
    for (const m of f.messages || []) {
      if (m.fatal) {
        stats.fatal++;
        // 解析失败意味着该文件实际没被检查,必须显式暴露(最多 20 条,避免刷屏)
        if (stats.fatal <= 20) {
          findings.push({
            tool: 'eslint', rule: 'parse-error', dimension: 'quality', severity: 'high',
            file: disp(f.filePath), line: m.line || 0, message: (m.message || '解析失败').slice(0, 300),
          });
        }
        continue;
      }
      if (!m.ruleId || isStyleRule(m.ruleId)) continue;
      findings.push({
        tool: 'eslint', rule: m.ruleId,
        dimension: KISS_RULES.test(m.ruleId) ? 'kiss' : 'quality',
        severity: m.severity === 2 ? 'medium' : 'low',
        file: disp(f.filePath), line: m.line || 0,
        message: m.message || '',
      });
    }
  }
  return stats;
}

function chunkBy(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function rel(repo, dir) {
  const r = path.relative(repo, dir).replace(/\\/g, '/');
  return r || '.';
}

module.exports = {
  name: 'eslint',
  languages: ['js', 'ts', 'vue'],
  dimensions: ['quality', 'kiss'],
  description: 'JS/TS/Vue 规则检查',
  run,
};