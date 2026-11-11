#!/usr/bin/env node
/**
 * 通用远程 MCP 命令行（Streamable HTTP）：mcp-client 自带的机制层调试入口。
 *
 * 只提供与业务无关的 tools / call；连接、session、SSE、超时由 mcp-client 核心负责。
 * 业务服务（腾讯文档、vault、dbx 等）使用各自的域 CLI。
 *
 * 用法:
 *   mcp tools [--endpoint URL] [--token-file PATH | --config PATH]
 *   mcp call <tool> [argsJson|@file|-] [--endpoint URL] [--token-file PATH | --config PATH]
 *
 * 端点: --endpoint URL 或 MCP_ENDPOINT（必填）
 * token: --token-file > --config（auth-center 风格，读 token 字段）；都没有则不带 Authorization
 * 其它: --pretty 格式化输出；--timeout=毫秒 单请求超时
 */
import fs from 'fs';
import { connect, toolResult } from '../index.js';

const rawArgv = process.argv.slice(2);
const pretty = rawArgv.includes('--pretty');
const endpoint = readGlobalFlag(rawArgv, '--endpoint') || process.env.MCP_ENDPOINT || '';
const tokenFile = readGlobalFlag(rawArgv, '--token-file') || process.env.MCP_TOKEN_FILE || '';
const configFile = readGlobalFlag(rawArgv, '--config') || process.env.MCP_AUTH_CONFIG || '';
const timeoutMs = Number((rawArgv.find(a => a.startsWith('--timeout=')) || '').slice(10)) || 120000;

function readGlobalFlag(args, flag) {
    const index = args.indexOf(flag);
    return index >= 0 ? args[index + 1] : undefined;
}

function stripGlobalFlags(args) {
    const out = [];
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--pretty') continue;
        if (args[i].startsWith('--timeout=')) continue;
        if (['--endpoint', '--token-file', '--config'].includes(args[i])) {
            i += 1;
            continue;
        }
        out.push(args[i]);
    }
    return out;
}

const cleanArgv = stripGlobalFlags(rawArgv);
const [command, subcommand, ...rest] = cleanArgv;

function readJsonArg(value, label) {
    if (value === undefined) throw new Error(`missing ${label}`);
    if (value === '-') return JSON.parse(fs.readFileSync(0, 'utf8'));
    if (value.startsWith('@')) return JSON.parse(fs.readFileSync(value.slice(1), 'utf8'));
    return JSON.parse(value);
}

function loadToken() {
    if (tokenFile) {
        const token = fs.readFileSync(tokenFile, 'utf8').trim();
        if (!token) throw new Error(`token 文件为空: ${tokenFile}`);
        return token;
    }
    if (configFile) {
        const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
        return String(config.token || '');
    }
    return '';
}

function print(value) {
    console.log(JSON.stringify(value, null, pretty ? 2 : 0));
}

async function main() {
    if (!endpoint) {
        throw new Error('缺少端点：用 --endpoint URL 或设置 MCP_ENDPOINT');
    }
    if (!command) {
        throw new Error('usage: mcp <call|tools> ...');
    }

    const token = loadToken();
    const client = await connect({
        transport: 'http',
        url: endpoint,
        headers: token ? { Authorization: token } : {},
        timeoutMs,
        clientInfo: { name: 'mcp', version: '2.0.0' },
    });

    try {
        if (command === 'tools') {
            print({ tools: await client.listTools() });
            return;
        }

        if (command === 'call') {
            if (!subcommand) throw new Error('usage: mcp call <tool> [args]');
            const args = rest.length ? readJsonArg(rest[0], 'args') : {};
            print(toolResult(await client.callTool(subcommand, args)));
            return;
        }

        throw new Error(`unknown command: ${command}`);
    } finally {
        await client.close();
    }
}

main().catch(error => {
    console.error(`ERROR: ${error.message}`);
    process.exit(1);
});