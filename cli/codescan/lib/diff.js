'use strict';
const path = require('path');
const { sh, normKey } = require('./util');

// 只允许常规 git ref 字符,避免把用户输入拼进 shell 时被注入
const REF_RE = /^[^\s"'`;$|&<>()]+$/;

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

/** 未跟踪文件整体视为新增(新增文件不会出现在 git diff 里) */
async function addUntracked(ranges, repoRoot) {
  const r = await sh('git ls-files --others --exclude-standard -z', { cwd: repoRoot, timeoutMs: 60000 });
  if (!r.ok) return { error: r.stderr.slice(0, 300) };
  for (const p of r.stdout.split('\0')) {
    if (!p) continue;
    const key = normKey(path.join(repoRoot, p));
    if (!ranges.has(key)) ranges.set(key, [[1, Number.MAX_SAFE_INTEGER]]);
    else ranges.get(key).push([1, Number.MAX_SAFE_INTEGER]);
  }
  return { error: null };
}

/**
 * 获取 diff 行范围。
 * mode:
 * - worktree(默认): ref → 工作区,并包含未跟踪文件
 * - staged:         ref → 暂存区
 * - commit:         仅该提交自身的改动
 * 返回 {ranges, error, mode, ref}
 */
async function getDiffRanges(repoRoot, opts = {}) {
  const mode = opts.mode || 'worktree';
  const ref = opts.ref || 'HEAD';
  if (!REF_RE.test(ref)) {
    return { ranges: new Map(), error: `非法 git ref: ${ref}`, mode, ref };
  }

  let cmd;
  if (mode === 'staged') {
    cmd = `git -c core.quotepath=false diff --cached -U0 "${ref}" -- .`;
  } else if (mode === 'commit') {
    const parents = await sh(`git rev-list --parents -n 1 "${ref}"`, { cwd: repoRoot, timeoutMs: 60000 });
    if (!parents.ok) return { ranges: new Map(), error: parents.stderr.slice(0, 300), mode, ref };
    const count = parents.stdout.trim().split(/\s+/).filter(Boolean).length;
    // 根提交没有父提交,用 git show(等价于与空树比较)
    cmd = count <= 1
      ? `git -c core.quotepath=false show --format= --unified=0 "${ref}" --`
      : `git -c core.quotepath=false diff -U0 "${ref}^" "${ref}" -- .`;
  } else {
    cmd = `git -c core.quotepath=false diff -U0 "${ref}" -- .`;
  }

  const r = await sh(cmd, { cwd: repoRoot, timeoutMs: 120000 });
  if (!r.ok) return { ranges: new Map(), error: r.stderr.slice(0, 300), mode, ref };

  const ranges = parseDiff(r.stdout, repoRoot);
  if (mode === 'worktree') {
    const u = await addUntracked(ranges, repoRoot);
    if (u.error) return { ranges, error: `未跟踪文件读取失败: ${u.error}`, mode, ref };
  }
  return { ranges, error: null, mode, ref };
}

/** [start,end] 与 diff 新增行是否有交集;line=0 表示行号未知 → 文件级匹配 */
function rangesOverlap(ranges, file, start, end) {
  const key = normKey(file);
  const rs = ranges.get(key);
  if (!rs) return false;
  if (!start) return true; // 行号未知,文件有变更即保留
  const s = start;
  const e = end && end >= start ? end : start;
  return rs.some(([a, b]) => s <= b && e >= a);
}

/** finding 是否落在 diff 新增行内 */
function inDiff(ranges, file, line) {
  return rangesOverlap(ranges, file, line, line);
}

module.exports = { getDiffRanges, inDiff, rangesOverlap, parseDiff };