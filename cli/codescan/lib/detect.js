'use strict';
const fs = require('fs');
const path = require('path');

const EXT_LANG = {
  '.java': 'java',
  '.js': 'js', '.jsx': 'js', '.mjs': 'js', '.cjs': 'js', '.vue': 'js',
  '.ts': 'ts', '.tsx': 'ts',
};

const IGNORE_DIRS = new Set(['node_modules', 'dist', 'target', 'build', '.git', 'out', '.idea']);

/** 递归收集目标下可识别语言的文件(上限保护) */
function collectFiles(targetAbs, limit = 3000) {
  const files = [];
  const stat = fs.statSync(targetAbs);
  if (stat.isFile()) return [targetAbs];
  const queue = [targetAbs];
  while (queue.length && files.length < limit) {
    const dir = queue.shift();
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      let st;
      try { st = fs.statSync(full); } catch { continue; }
      if (st.isDirectory()) {
        if (!IGNORE_DIRS.has(name)) queue.push(full);
      } else if (EXT_LANG[path.extname(name).toLowerCase()]) {
        files.push(full);
        if (files.length >= limit) break;
      }
    }
  }
  return files;
}

function detect(targetAbs) {
  const files = collectFiles(targetAbs);
  const byLang = { java: [], js: [], ts: [] };
  for (const f of files) {
    const lang = EXT_LANG[path.extname(f).toLowerCase()];
    if (byLang[lang]) byLang[lang].push(f);
  }
  const langs = Object.keys(byLang).filter((l) => byLang[l].length > 0);
  return { langs, files, byLang };
}

/** 向上找 git 仓库根 */
function findRepoRoot(startAbs) {
  let dir = path.resolve(startAbs);
  if (fs.statSync(dir).isFile()) dir = path.dirname(dir);
  for (;;) {
    if (fs.existsSync(path.join(dir, '.git'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function binExists(repoRoot, name) {
  const binDir = path.join(repoRoot, 'node_modules', '.bin');
  if (!fs.existsSync(binDir)) return false;
  return fs.readdirSync(binDir).some((f) => f.toLowerCase().startsWith(name.toLowerCase()));
}

module.exports = { detect, findRepoRoot, binExists, collectFiles };
