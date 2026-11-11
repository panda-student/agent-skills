'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { detect, collectFiles } = require('../lib/detect');

function tmpRepo(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codescan-test-'));
  for (const name of files) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), '');
  }
  return dir;
}

test('detect: 识别 java/js/ts/vue', () => {
  const dir = tmpRepo(['A.java', 'a.js', 'b.ts', 'C.vue']);
  try {
    const d = detect(dir);
    assert.deepEqual([...d.langs].sort(), ['java', 'js', 'ts']);
    assert.equal(d.hasVue, true);
    assert.equal(d.byLang.vue.length, 1);
    assert.equal(d.byLang.js.length, 2); // a.js + C.vue
    assert.equal(d.truncated, false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('collectFiles: 达到上限时显式标记 truncated', () => {
  const dir = tmpRepo(['a.js', 'b.js', 'c.js']);
  try {
    const r = collectFiles(dir, 2);
    assert.equal(r.files.length, 2);
    assert.equal(r.truncated, true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('detect: 忽略 node_modules/dist/target', () => {
  const dir = tmpRepo(['src/a.js', 'node_modules/x.js', 'dist/y.js', 'target/Z.java']);
  try {
    const d = detect(dir);
    assert.equal(d.files.length, 1);
    assert.equal(d.langs.includes('java'), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});