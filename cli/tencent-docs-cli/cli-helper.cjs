/**
 * 腾讯文档本地 CLI 调用助手：业务脚本通过它调用 tencent-docs，不接触 token。
 *
 * 用法:
 *   const { tool } = require('~/.agents/cli/tencent-docs-cli/cli-helper.cjs');
 *   const data = tool('smartsheet.list_records', { file_id, sheet_id });
 */
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const CLI = path.join(__dirname, 'bin', 'tencent-docs.js');

function tool(name, args = {}, options = {}) {
    const output = execFileSync(process.execPath, [CLI, 'call', name, '-'], {
        input: JSON.stringify(args),
        encoding: 'utf8',
        maxBuffer: options.maxBuffer || 64 * 1024 * 1024,
        cwd: options.cwd,
    });
    return JSON.parse(output);
}

function run(args, options = {}) {
    return execFileSync(process.execPath, [CLI, ...args], {
        encoding: 'utf8',
        maxBuffer: options.maxBuffer || 64 * 1024 * 1024,
        cwd: options.cwd,
        input: options.input,
    });
}

module.exports = { tool, run, CLI };