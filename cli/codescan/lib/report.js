'use strict';
const DIM_META = {
  reuse: { icon: '🔁', label: '复用问题(确定性)' },
  srp: { icon: '🎯', label: '单一职责信号(确定性)' },
  quality: { icon: '📋', label: '质量问题(确定性)' },
  performance: { icon: '⚡', label: '性能候选(确定性粗筛,需复核)' },
  kiss: { icon: '🧩', label: 'KISS/死代码候选(确定性粗筛,需复核)' },
};

const STATUS_ICON = { ok: '✅', skipped: '⏭️', partial: '⚠️', error: '❌' };

function toText(report) {
  const lines = [];
  lines.push(`# codescan 报告`);
  lines.push(`目标: ${report.target}`);
  lines.push(`语言: ${report.detected.join(', ') || '(none)'}${report.hasVue ? ', vue' : ''}  |  仓库: ${report.repoRoot || '非 git 仓库'}`);
  if (report.files) {
    lines.push(`文件: ${report.files.total} 个${report.files.truncated ? ' (⚠ 已达收集上限,结果不完整)' : ''}`);
  }
  if (report.diff) {
    const mode = report.diff.mode || 'worktree';
    lines.push(`diff: ${mode} ${report.diff.ref || ''} → ${report.diff.files} 个文件有新增行${report.diff.error ? ' (⚠ ' + report.diff.error + ')' : ''}`);
  }

  const bad = Object.entries(report.tools || {}).filter(([, t]) => t.status === 'error' || t.status === 'partial');
  const skipped = Object.entries(report.tools || {}).filter(([, t]) => t.status === 'skipped');
  if (bad.length) {
    lines.push('');
    lines.push(`⚠ 有 ${bad.length} 个工具未完整执行,本次结论可能不完整:`);
    for (const [name, t] of bad) lines.push(`  - ${name}(${t.status}): ${t.detail || '无详情'}`);
  }

  lines.push('');
  lines.push(`## 工具状态`);
  for (const [name, t] of Object.entries(report.tools || {})) {
    lines.push(`- ${STATUS_ICON[t.status] || '•'} ${name}: ${t.status}${t.detail ? ` — ${t.detail}` : ''} (${t.findings} 项, ${t.ms}ms)`);
  }

  lines.push('');
  const byDim = {};
  for (const f of report.findings) (byDim[f.dimension] = byDim[f.dimension] || []).push(f);
  for (const dim of ['reuse', 'srp', 'quality', 'performance', 'kiss']) {
    const fs = byDim[dim] || [];
    if (!fs.length) continue;
    const meta = DIM_META[dim];
    lines.push(`## ${meta.icon} ${meta.label} (${fs.length} 项)`);
    for (const f of fs) {
      lines.push(`- [${f.severity}] ${shortPath(report, f.file)}:${f.line} — ${f.message}  {${f.tool}:${f.rule}}`);
    }
    lines.push('');
  }

  if (report.truncated) lines.push(`⚠ 还有 ${report.truncated} 项低优先级发现被截断(--max-findings 调整)`);
  if (!report.findings.length) {
    const executed = Object.values(report.tools || {}).filter((t) => t.status === 'ok' || t.status === 'partial');
    if (!executed.length) {
      lines.push(`(没有成功执行的工具,无法判断是否干净)`);
    } else if (bad.length || skipped.length) {
      lines.push(`(成功执行的工具未发现问题;注意有工具跳过/失败,见上方状态)`);
    } else {
      lines.push(`(所有工具均成功执行且未发现问题)`);
    }
  }
  return lines.join('\n');
}

function shortPath(report, file) {
  if (report.repoRoot && file.toLowerCase().startsWith(report.repoRoot.toLowerCase())) {
    return file.slice(report.repoRoot.length + 1) || file;
  }
  return file;
}

module.exports = { toText };