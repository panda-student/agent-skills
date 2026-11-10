'use strict';
const path = require('path');
const { sh, normKey } = require('./util');

/** 解析 `git diff -U0` 输出,返回 Map<normKey(file), [[start,end],...]> 仅新增行 */
function parseDiff(diffText, repoRoot) {
  const ranges = new Map();
  let currentFile = null;
  let collecting = false;
  for (const raw of diffText.split(/\r?\n/)) {
    const line = raw;
    if (line.startsWith('+++ ')) {
      const p = line.slice(4).replace(/\t.*$/, '').replace(/^b\//, '');
      collecting = p !== '/dev/null';
      currentFile = collecting ? normKey(path.join(repoRoot, p)) : null;
      if (currentFile && !ranges.has(currentFile)) ranges.set(currentFile, []);
      continue;
    }
    if (!collecting || !currentFile) continue;
    const m = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (m) {
      const start = parseInt(m[1], 10);
      const count = m[2] === undefined ? 1 : parseInt(m[2], 10);
      if (count > 0) ranges.get(currentFile).push([start, start + count - 1]);
    }
  }
  for (const [k, v] of [...ranges]) if (v.length === 0) ranges.delete(k);
  return ranges;
}

/** 获取 diff 行范围;ref 例如 HEAD、main、HEAD~1。返回 {ranges, error} */
function getDiffRanges(repoRoot, ref) {
  const r = sh(
    `git -c core.quotepath=false diff -U0 "${ref}" -- .`,
    { cwd: repoRoot, timeoutMs: 60000 },
  );
  if (!r.ok) return { ranges: new Map(), error: r.stderr.slice(0, 300) };
  return { ranges: parseDiff(r.stdout, repoRoot), error: null };
}

/** finding 是否落在 diff 新增行内;line=0 表示行号未知 → 文件级匹配 */
function inDiff(ranges, file, line) {
  const key = normKey(file);
  const rs = ranges.get(key);
  if (!rs) return false;
  if (!line) return true; // 行号未知,文件有变更即保留
  return rs.some(([s, e]) => line >= s && line <= e);
}

module.exports = { getDiffRanges, inDiff, parseDiff };
