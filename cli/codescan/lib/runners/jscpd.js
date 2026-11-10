'use strict';
const fs = require('fs');
const path = require('path');
const { sh, disp, mkTmpDir, inScope } = require('../util');

// 注意:cwd 必须是 CLI 根目录;jscpd 在 lib/runners 等 cwd 下会静默不写报告
const HOME = path.join(__dirname, '..', '..');

/** jscpd 重复代码检测 → 复用维度(确定性,完全替代模型判断) */
async function run(ctx) {
  const outDir = mkTmpDir();
  const target = disp(ctx.targetAbs);
  const r = sh(
    `npx --yes jscpd "${target}" --min-tokens ${ctx.args.minTokens} --reporters json --absolute ` +
    `--output "${outDir.replace(/\\/g, '/')}" --silent ` +
    `--ignore "**/node_modules/**,**/dist/**,**/target/**,**/build/**"`,
    { cwd: HOME, timeoutMs: ctx.toolTimeout },
  );
  const reportFile = path.join(outDir, 'jscpd-report.json');
  if (!fs.existsSync(reportFile)) {
    return { status: 'error', detail: (r.stderr || r.stdout || 'no report').slice(0, 300), findings: [] };
  }
  let report;
  try { report = JSON.parse(fs.readFileSync(reportFile, 'utf8')); } catch (e) {
    return { status: 'error', detail: 'report parse: ' + e.message, findings: [] };
  }
  // jscpd 5.x: duplicates 直接是数组(旧版在 .list 下)
  const dupsRaw = report.duplicates;
  const dups = Array.isArray(dupsRaw) ? dupsRaw : (dupsRaw && dupsRaw.list) || [];
  const findings = [];
  for (const d of dups) {
    const a = d.firstFile || {};
    const b = d.secondFile || {};
    if (!a.name || !b.name) continue;
    // 报告里可能是相对路径/文件名,以 target 目录解析为绝对路径
    const fa = resolveWithin(ctx, target, a.name);
    const fb = resolveWithin(ctx, target, b.name);
    if (!inScope(ctx.targetKey, fa) && !inScope(ctx.targetKey, fb)) continue;
    const lines = d.lines || (b.end - b.start) || 0;
    const sev = lines >= 20 ? 'high' : lines >= 8 ? 'medium' : 'low';
    findings.push({
      tool: 'jscpd', rule: 'duplicate', dimension: 'reuse', severity: sev,
      file: disp(fa), line: a.start || 0,
      message: `重复代码 ${lines} 行(tokens=${d.tokens}) ↔ ${disp(fb)}:${b.start}`,
      evidence: { pairFile: disp(fb), pairLine: b.start || 0, lines },
    });
  }
  return { status: 'ok', detail: `${dups.length} 处重复`, findings };
}

/**
 * 还原真实绝对路径。--absolute 在 Windows 下产出 `xxx?/D:/真实路径` 混合体;
 * 无 --absolute 时只有 basename。两者都兜底,再退化到按文件名在目标内匹配。
 */
function resolveWithin(ctx, targetDir, name) {
  // 1) mangle 形式:取 ?/ 之后的绝对路径
  if (name.includes('?/')) {
    const tail = name.split('?/').pop();
    if (/^[a-zA-Z]:\//.test(tail)) return tail;
  }
  // 2) 正常绝对路径
  if (/^[a-zA-Z]:[\\/]/.test(name) || name.startsWith('/')) return name;
  // 3) basename → 在目标文件清单里按名匹配
  const base = name.replace(/^.*[\\/]/, '');
  const hit = (ctx.allFiles || []).find((f) => f.replace(/\\/g, '/').endsWith('/' + base));
  if (hit) return hit;
  return path.join(targetDir, base);
}

module.exports = { name: 'jscpd', run };
