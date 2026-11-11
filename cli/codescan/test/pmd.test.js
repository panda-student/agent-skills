'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { normalizeJavaVersion } = require('../lib/runners/pmd');

test('normalizeJavaVersion: 兼容 1.8 与 8', () => {
  assert.equal(normalizeJavaVersion('1.8').version, '1.8');
  assert.equal(normalizeJavaVersion('8').version, '1.8');
});

test('normalizeJavaVersion: 保留 11/17', () => {
  assert.equal(normalizeJavaVersion('11').version, '11');
  assert.equal(normalizeJavaVersion('17').version, '17');
});

test('normalizeJavaVersion: 处理完整版本号', () => {
  assert.equal(normalizeJavaVersion('1.8.0_202').version, '1.8');
  assert.equal(normalizeJavaVersion('17.0.2').version, '17');
  assert.equal(normalizeJavaVersion('21.0.1').clamped, true);
});

test('normalizeJavaVersion: 超出 PMD 6 上限时收敛到 19 并标记', () => {
  const r = normalizeJavaVersion('21');
  assert.equal(r.version, '19');
  assert.equal(r.clamped, true);
});