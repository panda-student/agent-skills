'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { keepByDiff, autoTools } = require('../lib/scan');
const { normKey } = require('../lib/util');

const REPO = path.resolve('C:/repo');

test('keepByDiff: jscpd 重复块按区间匹配,不只看起始行', () => {
  const ranges = new Map([[normKey(path.join(REPO, 'a.js')), [[120, 140]]]]);
  const finding = {
    tool: 'jscpd', rule: 'duplicate', dimension: 'reuse', severity: 'high',
    file: path.join(REPO, 'a.js'), line: 100, message: 'dup',
    evidence: { pairFile: path.join(REPO, 'x.js'), pairLine: 1, lines: 50 },
  };
  assert.equal(keepByDiff(ranges, finding), true);
});

test('keepByDiff: 重复块完全在 diff 之外时过滤', () => {
  const ranges = new Map([[normKey(path.join(REPO, 'a.js')), [[10, 20]]]]);
  const finding = {
    tool: 'jscpd', rule: 'duplicate', dimension: 'reuse', severity: 'high',
    file: path.join(REPO, 'a.js'), line: 100, message: 'dup',
    evidence: { pairFile: path.join(REPO, 'x.js'), pairLine: 200, lines: 5 },
  };
  assert.equal(keepByDiff(ranges, finding), false);
});

test('autoTools: Vue 项目也会触发 tsc/eslint/knip', () => {
  const tools = autoTools(['js'], true);
  assert.ok(tools.includes('tsc'));
  assert.ok(tools.includes('eslint'));
  assert.ok(tools.includes('knip'));
});

test('autoTools: 纯 Java 项目只加 PMD,不加前端工具', () => {
  const tools = autoTools(['java'], false);
  assert.ok(tools.includes('pmd'));
  assert.ok(!tools.includes('eslint'));
  assert.ok(!tools.includes('knip'));
});