'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { sh } = require('../lib/util');

test('sh: 不存在的命令按失败返回,不能当成"没问题"', async () => {
  const r = await sh('codescan-definitely-not-a-command-xyz');
  assert.equal(r.ok, false);
  assert.equal(r.spawnError, true);
});

test('sh: 非零退出码仍返回输出(工具发现问题的正常语义)', async () => {
  const r = await sh(`node -e "process.stdout.write('hello'); process.exit(3)"`);
  assert.equal(r.ok, true);
  assert.equal(r.code, 3);
  assert.equal(r.stdout, 'hello');
});

test('sh: maxBuffer 溢出按失败返回', async () => {
  const r = await sh(`node -e "process.stdout.write('x'.repeat(5000))"`, { maxBuffer: 1024 });
  assert.equal(r.ok, false);
  assert.equal(r.spawnError, true);
});