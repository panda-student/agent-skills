#!/usr/bin/env node
/**
 * tencent-docs CLI：腾讯文档 MCP 业务命令（普通表格 / 智能表格 / 通用工具调用）。
 *
 * 机制层（连接、握手、JSON-RPC、session、SSE）由 mcp-client 提供；
 * 本 CLI 只负责腾讯文档的端点、token 来源、工具名兼容与表格业务参数。
 *
 * 用法:
 *   tencent-docs tools [--json]                              列出远程 MCP 工具
 *   tencent-docs call <tool> [argsJson|@file|-]              通用工具调用
 *   tencent-docs sheets list <file_id>
 *   tencent-docs sheets read <file_id> <sheet_id> [--start-row N --end-row N --start-col N --end-col N]
 *   tencent-docs sheets write <file_id> <sheet_id> --values <json|@file|->
 *   tencent-docs sheets clear <file_id> <sheet_id> --start-row N --end-row N --start-col N --end-col N
 *   tencent-docs smartsheet tables <file_id>
 *   tencent-docs smartsheet fields <file_id> <sheet_id>
 *   tencent-docs smartsheet records <file_id> <sheet_id> [--view-id ID] [--all]
 *   tencent-docs smartsheet add <file_id> <sheet_id> --records <json|@file|->
 *   tencent-docs smartsheet update <file_id> <sheet_id> --records <json|@file|->
 *   tencent-docs smartsheet delete <file_id> <sheet_id> --ids <id1,id2>
 *
 * 通用选项: --pretty  格式化 JSON；--timeout=毫秒  单请求超时
 * 端点: --endpoint URL 或 TENCENT_DOCS_MCP_ENDPOINT
 * token: --token-file PATH | --config PATH | auth-center 的 tencent-docs 配置
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { connect, toolResult } from 'mcp-client';

const DEFAULT_ENDPOINT = 'https://docs.qq.com/openapi/mcp';

const rawArgv = process.argv.slice(2);
const pretty = rawArgv.includes('--pretty');
const endpoint = readGlobalFlag(rawArgv, '--endpoint')
    || process.env.TENCENT_DOCS_MCP_ENDPOINT
    || DEFAULT_ENDPOINT;
const tokenFile = readGlobalFlag(rawArgv, '--token-file') || process.env.TENCENT_DOCS_TOKEN_FILE;
const configFile = readGlobalFlag(rawArgv, '--config') || process.env.TENCENT_DOCS_AUTH_CONFIG;
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
    if (value === '-') return readStdinJson();
    if (value.startsWith('@')) return JSON.parse(fs.readFileSync(value.slice(1), 'utf8'));
    return JSON.parse(value);
}

function readStdinJson() {
    return JSON.parse(fs.readFileSync(0, 'utf8'));
}

const RANGE_KEYS = ['start-row', 'end-row', 'start-col', 'end-col'];

/** 校验范围参数：read 可选但必须四个一起给；clear 必填 */
function numericRange(options, label, required) {
    const provided = RANGE_KEYS.filter(k => options[k] !== undefined && options[k] !== true);
    if (required && provided.length !== RANGE_KEYS.length) {
        throw new Error(`usage: ${label} 需要 --start-row/--end-row/--start-col/--end-col`);
    }
    if (!required && provided.length && provided.length !== RANGE_KEYS.length) {
        throw new Error(`usage: ${label} 的范围参数必须四个一起提供`);
    }
    const out = {};
    for (const key of provided) {
        const n = Number(options[key]);
        if (!Number.isFinite(n)) throw new Error(`usage: ${label} 的 --${key} 必须是数字`);
        out[key.replace(/-/g, '_')] = n;
    }
    return out;
}

function parseOptions(args, valueFlags) {
    const positional = [];
    const options = {};
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg.startsWith('--')) {
            const key = arg.slice(2);
            if (valueFlags.includes(key)) {
                options[key] = args[++i];
            } else {
                options[key] = true;
            }
        } else {
            positional.push(arg);
        }
    }
    return { positional, options };
}

/** auth-center 管理的腾讯文档配置 */
function authConfigFile() {
    if (configFile) return configFile;
    const home = process.env.AUTH_CENTER_HOME || process.env.UNIFIED_AUTH_HOME || process.env.JOMOO_AUTH_HOME || path.join(os.homedir(), '.auth-center');
    return path.join(home, 'apps', 'tencent-docs', 'config.json');
}

function loadToken() {
    if (tokenFile) {
        const token = fs.readFileSync(tokenFile, 'utf8').trim();
        if (!token) throw new Error(`token 文件为空: ${tokenFile}`);
        return token;
    }

    let token = '';
    try {
        const auth = JSON.parse(fs.readFileSync(authConfigFile(), 'utf8'));
        token = String(auth.token || '');
    } catch {
        token = '';
    }

    if (!token || token.includes('{{credential}}')) {
        throw new Error('腾讯文档 token 未注入：用 --token-file 指定，或先运行 auth login tencent-docs');
    }
    return token;
}

/** 腾讯文档工具名同时存在点号与下划线两种写法 */
function toolNameVariants(name) {
    if (name.includes('.')) return [name, name.replace(/\./g, '_')];
    if (name.includes('_')) {
        const parts = name.split('_');
        if (parts.length >= 2) return [name, parts[0] + '.' + parts.slice(1).join('_')];
    }
    return [name];
}

async function callTool(client, name, args) {
    let lastError;
    for (const variant of toolNameVariants(name)) {
        try {
            return await client.callTool(variant, args);
        } catch (error) {
            lastError = error;
            if (!/tool|not found|unknown/i.test(error.message)) throw error;
        }
    }
    throw lastError;
}

function print(value) {
    console.log(JSON.stringify(value, null, pretty ? 2 : 0));
}

async function main() {
    if (!command) {
        throw new Error('usage: tencent-docs <call|tools|sheets|smartsheet> ...');
    }

    const client = await connect({
        transport: 'http',
        url: endpoint,
        headers: { Authorization: loadToken() },
        timeoutMs,
        clientInfo: { name: 'tencent-docs-cli', version: '1.0.0' },
    });

    try {
        if (command === 'tools') {
            const tools = await client.listTools();
            print({ tools });
            return;
        }

        if (command === 'call') {
            if (!subcommand) throw new Error('usage: tencent-docs call <tool> [args]');
            const args = rest.length ? readJsonArg(rest[0], 'args') : {};
            print(toolResult(await callTool(client, subcommand, args)));
            return;
        }

        if (command === 'sheets') {
            const { positional, options } = parseOptions(rest, ['start-row', 'end-row', 'start-col', 'end-col', 'row', 'col', 'value', 'values']);
            const [fileId, sheetId] = positional;
            if (subcommand === 'list') {
                if (!fileId) throw new Error('usage: sheets list <file_id>');
                print(toolResult(await callTool(client, 'sheet_get_sheet_info', { file_id: fileId })));
                return;
            }
            if (subcommand === 'read') {
                if (!fileId || !sheetId) throw new Error('usage: sheets read <file_id> <sheet_id>');
                const args = {
                    file_id: fileId,
                    sheet_id: sheetId,
                    return_csv: true,
                    ...numericRange(options, 'sheets read', false),
                };
                print(toolResult(await callTool(client, 'sheet_get_cell_data', args)));
                return;
            }
            if (subcommand === 'write') {
                if (!fileId || !sheetId) throw new Error('usage: sheets write <file_id> <sheet_id> --values <json>');
                print(toolResult(await callTool(client, 'sheet_set_range_value', {
                    file_id: fileId,
                    sheet_id: sheetId,
                    values: readJsonArg(options.values, '--values'),
                })));
                return;
            }
            if (subcommand === 'clear') {
                if (!fileId || !sheetId) throw new Error('usage: sheets clear <file_id> <sheet_id> --start-row ...');
                const args = {
                    file_id: fileId,
                    sheet_id: sheetId,
                    ...numericRange(options, 'sheets clear', true),
                };
                print(toolResult(await callTool(client, 'sheet_clear_range_cells', args)));
                return;
            }
            throw new Error(`unknown sheets subcommand: ${subcommand}`);
        }

        if (command === 'smartsheet') {
            const { positional, options } = parseOptions(rest, ['view-id', 'records', 'ids']);
            const [fileId, sheetId] = positional;
            if (subcommand === 'tables') {
                if (!fileId) throw new Error('usage: smartsheet tables <file_id>');
                print(toolResult(await callTool(client, 'smartsheet.list_tables', { file_id: fileId })));
                return;
            }
            if (subcommand === 'fields') {
                if (!fileId || !sheetId) throw new Error('usage: smartsheet fields <file_id> <sheet_id>');
                print(toolResult(await callTool(client, 'smartsheet.list_fields', { file_id: fileId, sheet_id: sheetId })));
                return;
            }
            if (subcommand === 'records') {
                if (!fileId || !sheetId) throw new Error('usage: smartsheet records <file_id> <sheet_id>');
                const base = { file_id: fileId, sheet_id: sheetId };
                if (options['view-id']) base.view_id = options['view-id'];
                if (!options.all) {
                    print(toolResult(await callTool(client, 'smartsheet.list_records', base)));
                    return;
                }
                const records = [];
                let offset = 0;
                let hasMore = true;
                let pages = 0;
                while (hasMore) {
                    const page = toolResult(await callTool(client, 'smartsheet.list_records', { ...base, limit: 100, offset }));
                    const batch = Array.isArray(page.records) ? page.records : [];
                    records.push(...batch);
                    hasMore = Boolean(page.has_more);
                    if (!hasMore) break;
                    if (!batch.length) {
                        throw new Error(`smartsheet.list_records 返回空页但 has_more=true（offset=${offset}），已中止避免死循环`);
                    }
                    offset += batch.length;
                    if (++pages > 1000) {
                        throw new Error('smartsheet.list_records 分页超过 1000 页，已中止');
                    }
                }
                print({ records, has_more: false });
                return;
            }
            if (subcommand === 'add' || subcommand === 'update') {
                if (!fileId || !sheetId) throw new Error(`usage: smartsheet ${subcommand} <file_id> <sheet_id> --records <json>`);
                const tool = subcommand === 'add' ? 'smartsheet.add_records' : 'smartsheet.update_records';
                print(toolResult(await callTool(client, tool, {
                    file_id: fileId,
                    sheet_id: sheetId,
                    records: readJsonArg(options.records, '--records'),
                })));
                return;
            }
            if (subcommand === 'delete') {
                if (!fileId || !sheetId) throw new Error('usage: smartsheet delete <file_id> <sheet_id> --ids <id1,id2>');
                print(toolResult(await callTool(client, 'smartsheet.delete_records', {
                    file_id: fileId,
                    sheet_id: sheetId,
                    record_ids: String(options.ids || '').split(',').filter(Boolean),
                })));
                return;
            }
            throw new Error(`unknown smartsheet subcommand: ${subcommand}`);
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