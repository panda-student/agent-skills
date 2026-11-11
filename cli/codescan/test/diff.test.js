'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { parseDiff, inDiff, rangesOverlap } = require('../lib/diff');
const { normKey } = require('../lib/util');

const REPO = path.resolve('C:/repo');

test('parseDiff: 收集新增行区间', () => {
  const text = [
    'diff --git a/src/A.java b/src/A.java',
    '--- a/src/A.java',
    '+++ b/src/A.java',
    '@@ -1,2 +1,3 @@',
    '@@ -10,0 +11,2 @@',
  ].join('\n');
  const ranges = parseDiff(text, REPO);
  assert.deepEqual(ranges.get(normKey(path.join(REPO, 'src/A.java'))), [[1, 3], [11, 12]]);
});

test('parseDiff: 删除的文件不产生范围', () => {
  const text = ['+++ /dev/null', '@@ -1,3 +0,0 @@'].join('\n');
  assert.equal(parseDiff(text, REPO).size, 0);
});

test('inDiff: 只匹配新增行', () => {
  const ranges = new Map([[normKey(path.join(REPO, 'a.js')), [[120, 140]]]]);
  assert.equal(inDiff(ranges, path.join(REPO, 'a.js'), 130), true);
  assert.equal(inDiff(ranges, path.join(REPO, 'a.js'), 100), false);
});

test('rangesOverlap: 重复块起始行不在 diff、块体覆盖新增行时仍命中', () => {
  const ranges = new Map([[normKey(path.join(REPO, 'a.js')), [[120, 140]]]]);
  assert.equal(rangesOverlap(ranges, path.join(REPO, 'a.js'), 100, 149), true);
  assert.equal(rangesOverlap(ranges, path.join(REPO, 'a.js'), 141, 200), false);
});