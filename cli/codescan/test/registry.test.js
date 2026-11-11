'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ToolRegistry, createDefaultRegistry, loadToolModules } = require('../lib/registry');
const { normalizeResult } = require('../lib/tool');
const { runScan } = require('../lib/scan');

test('registry: 按语言自动选择工具', () => {
  const reg = createDefaultRegistry();
  assert.deepEqual(reg.autoSelect(['java'], false).sort(), ['ast-grep', 'jscpd', 'pmd'].sort());
  assert.deepEqual(reg.autoSelect(['js'], true).sort(), ['ast-grep', 'eslint', 'jscpd', 'knip', 'tsc'].sort());
  assert.deepEqual(reg.autoSelect(['ts'], false).sort(), ['ast-grep', 'eslint', 'jscpd', 'knip', 'tsc'].sort());
});

test('registry: 同名工具默认拒绝重复注册', () => {
  const reg = createDefaultRegistry();
  assert.throws(() => reg.register({ name: 'eslint', languages: ['js'], run: async () => ({}) }), /已注册/);
});

test('registry: override 可以替换内置工具', () => {
  const reg = createDefaultRegistry();
  const fake = { name: 'eslint', languages: ['js'], run: async () => ({ status: 'ok', findings: [] }) };
  reg.register(fake, { override: true });
  assert.equal(reg.get('eslint'), fake);
});

test('registry: 适配器缺少 run 时拒绝注册', () => {
  const reg = new ToolRegistry();
  assert.throws(() => reg.register({ name: 'x', languages: ['js'] }), /run\(ctx\)/);
});

test('tool: 非法 status 收敛为 error', () => {
  const r = normalizeResult({ status: 'weird', detail: 'x', findings: [] }, 't');
  assert.equal(r.status, 'error');
  assert.match(r.detail, /无效 status/);
});

test('tool: finding 字段被规范化,无文件位置的条目被丢弃', () => {
  const r = normalizeResult({
    status: 'ok',
    findings: [
      { file: 'a.js', line: 'x', message: 'm' },
      { message: 'no file' },
    ],
  }, 't');
  assert.equal(r.findings.length, 1);
  assert.equal(r.findings[0].tool, 't');
  assert.equal(r.findings[0].dimension, 'quality');
  assert.equal(r.findings[0].severity, 'info');
  assert.equal(r.findings[0].line, 0);
});

test('scan: 只依赖注册表接口,注入假工具也能完整跑通', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codescan-reg-'));
  fs.writeFileSync(path.join(dir, 'a.js'), 'const a = 1;\n');
  const reg = new ToolRegistry();
  reg.register({
    name: 'fake',
    languages: ['*'],
    dimensions: ['quality'],
    run: async () => ({
      status: 'ok',
      detail: 'fake ran',
      findings: [{ file: path.join(dir, 'a.js'), line: 1, message: 'fake finding' }],
    }),
  });
  try {
    const report = await runScan({ target: dir, tools: ['fake'], maxFindings: 10 }, { registry: reg });
    assert.equal(report.ok, true);
    assert.equal(report.tools.fake.status, 'ok');
    assert.equal(report.findings.length, 1);
    assert.equal(report.findings[0].tool, 'fake');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('registry: 外部模块可扩展工具', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codescan-mod-'));
  const mod = path.join(dir, 'my-tool.js');
  fs.writeFileSync(mod, "module.exports = { name: 'my-tool', languages: ['*'], run: async () => ({ status: 'ok', findings: [] }) };\n");
  try {
    const reg = loadToolModules(createDefaultRegistry(), [mod]);
    assert.ok(reg.get('my-tool'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});