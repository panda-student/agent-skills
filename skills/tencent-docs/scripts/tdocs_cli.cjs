/**
 * 腾讯文档本地 CLI 调用助手（业务技能通过它调用 CLI，不接触 MCP/token）
 *
 * 用法:
 *   const { tool } = require('<tencent-docs>/scripts/tdocs_cli.cjs');
 *   const data = tool('smartsheet.list_records', { file_id, sheet_id });
 */
const { execFileSync } = require('child_process');
const path = require('path');

const CLI = path.join(__dirname, 'tdocs.mjs');

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