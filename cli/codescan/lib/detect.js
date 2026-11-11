'use strict';
const fs = require('fs');
const path = require('path');

const EXT_LANG = {
  '.java': 'java',
  '.js': 'js', '.jsx': 'js', '.mjs': 'js', '.cjs': 'js', '.vue': 'js',
  '.ts': 'ts', '.tsx': 'ts',
};

const IGNORE_DIRS = new Set([
  'node_modules', 'dist', 'target', 'build', 'out', 'coverage', '.git',
  '.idea', '.next', '.nuxt', '.output', 'vendor',
]);

/** 递归收集目标下可识别语言的文件(上限保护,截断会显式上报) */
function collectFiles(targetAbs, limit = 3000) {
  const stat = fs.statSync(targetAbs);
  if (stat.isFile()) return { files: [targetAbs], truncated: false };
  const files = [];
  const queue = [targetAbs];
  let truncated = false;
  while (queue.length && !truncated) {
    const dir = queue.shift();
    let names;
    try { names = fs.readdirSync(dir); } catch { continue; }
    for (const name of names) {
      const full = path.join(dir, name);
      let st;
      try { st = fs.statSync(full); } catch { continue; }
      if (st.isDirectory()) {
        if (!IGNORE_DIRS.has(name)) queue.push(full);
      } else if (EXT_LANG[path.extname(name).toLowerCase()]) {
        if (files.length >= limit) { truncated = true; break; }
        files.push(full);
      }
    }
  }
  return { files, truncated };
}

function detect(targetAbs) {
  const { files, truncated } = collectFiles(targetAbs);
  const byLang = { java: [], js: [], ts: [], vue: [] };
  for (const f of files) {
    const lang = EXT_LANG[path.extname(f).toLowerCase()];
    if (byLang[lang]) byLang[lang].push(f);
    if (path.extname(f).toLowerCase() === '.vue') byLang.vue.push(f);
  }
  const langs = ['java', 'js', 'ts'].filter((l) => byLang[l].length > 0);
  return { langs, files, byLang, hasVue: byLang.vue.length > 0, truncated };
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

/**
 * 从 startAbs 向上查找包含任一候选文件的目录,直到 stopAbs(含)。
 * 用于 monorepo 子包:配置可能在子包而不是仓库根。
 */
function findUp(startAbs, names, stopAbs) {
  let dir = path.resolve(startAbs);
  try { if (fs.statSync(dir).isFile()) dir = path.dirname(dir); } catch { /* 路径不存在时按目录处理 */ }
  const stop = stopAbs ? path.resolve(stopAbs) : null;
  for (;;) {
    for (const n of names) {
      if (fs.existsSync(path.join(dir, n))) return dir;
    }
    if (stop && dir === stop) break;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/** 从 startAbs 向上找 node_modules/.bin 下存在 name 的目录 */
function findBin(startAbs, stopAbs, name) {
  let dir = path.resolve(startAbs);
  try { if (fs.statSync(dir).isFile()) dir = path.dirname(dir); } catch { /* ignore */ }
  const stop = stopAbs ? path.resolve(stopAbs) : null;
  const needle = name.toLowerCase();
  for (;;) {
    const binDir = path.join(dir, 'node_modules', '.bin');
    if (fs.existsSync(binDir)) {
      try {
        const hit = fs.readdirSync(binDir).some((f) => {
          const n = f.toLowerCase();
          return n === needle || n === `${needle}.cmd` || n === `${needle}.ps1` ||
            n === `${needle}.bat` || n === `${needle}.exe`;
        });
        if (hit) return dir;
      } catch { /* ignore */ }
    }
    if (stop && dir === stop) break;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

module.exports = { detect, findRepoRoot, collectFiles, findUp, findBin };