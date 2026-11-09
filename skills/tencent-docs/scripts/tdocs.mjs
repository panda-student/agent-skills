#!/usr/bin/env node
/**
 * 腾讯文档本地 CLI（腾讯文档远程 MCP 的封装）
 *
 * 业务技能只调用本 CLI，不再各自维护 MCP 客户端、token 加载和 JSON-RPC。
 *
 * 用法:
 *   node tdocs.mjs call <tool> [argsJson|@file|-]        # 通用 MCP 工具调用，- 表示从 stdin 读 JSON
 *   node tdocs.mjs tools                                # 列出远程 MCP 工具
 *   node tdocs.mjs sheets list <file_id>
 *   node tdocs.mjs sheets read <file_id> <sheet_id> [--start-row N --end-row N --start-col N --end-col N]
 *   node tdocs.mjs sheets write <file_id> <sheet_id> --values <json|@file|->
 *   node tdocs.mjs sheets clear <file_id> <sheet_id> --start-row N --end-row N --start-col N --end-col N
 *   node tdocs.mjs smartsheet tables <file_id>
 *   node tdocs.mjs smartsheet fields <file_id> <sheet_id>
 *   node tdocs.mjs smartsheet records <file_id> <sheet_id> [--view-id ID] [--all]
 *   node tdocs.mjs smartsheet add <file_id> <sheet_id> --records <json|@file|->
 *   node tdocs.mjs smartsheet update <file_id> <sheet_id> --records <json|@file|->
 *   node tdocs.mjs smartsheet delete <file_id> <sheet_id> --ids <id1,id2>
 *
 * 可选: --pretty 输出格式化 JSON
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { createTdocsClient } = require('./tdocs_client.cjs');

const argv = process.argv.slice(2);
const pretty = argv.includes('--pretty');
const cleanArgv = argv.filter(a => a !== '--pretty');
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

/** 统一认证目录（auth-center 管理） */
function authConfigFile() {
    const home = process.env.AUTH_CENTER_HOME || process.env.UNIFIED_AUTH_HOME || process.env.JOMOO_AUTH_HOME || path.join(os.homedir(), '.auth-center');
    return path.join(home, 'apps', 'tencent-docs', 'config.json');
}

function loadToken() {
    // 首选统一认证库保存的 token
    let token = '';
    try {
        const auth = JSON.parse(fs.readFileSync(authConfigFile(), 'utf8'));
        token = String(auth.token || '');
    } catch {
        token = '';
    }

    // 兼容旧共享配置（迁移期）
    if (!token) {
        const legacyFile = path.join(ROOT, 'config', 'tdocs_common.json');
        if (fs.existsSync(legacyFile)) {
            try {
                const legacy = JSON.parse(fs.readFileSync(legacyFile, 'utf8'));
                token = String(legacy.token || '');
            } catch { /* 旧配置损坏则忽略 */ }
        }
    }

    if (!token || token.includes('{{credential}}')) {
        throw new Error('腾讯文档 token 未注入，请先运行: auth login tencent-docs');
    }
    return token;
}

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
            return await client.tool(variant, args);
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
        throw new Error('usage: node tdocs.mjs <call|tools|sheets|smartsheet> ...');
    }
    const client = createTdocsClient(loadToken(), { clientName: 'tencent-docs-cli' });

    if (command === 'tools') {
        await client.initialize();
        print(await client.call('tools/list', {}));
        return;
    }

    if (command === 'call') {
        if (!subcommand) throw new Error('usage: node tdocs.mjs call <tool> [args]');
        const args = rest.length ? readJsonArg(rest[0], 'args') : {};
        print(await callTool(client, subcommand, args));
        return;
    }

    if (command === 'sheets') {
        const { positional, options } = parseOptions(rest, ['start-row', 'end-row', 'start-col', 'end-col', 'row', 'col', 'value', 'values']);
        const [fileId, sheetId] = positional;
        if (subcommand === 'list') {
            if (!fileId) throw new Error('usage: sheets list <file_id>');
            print(await callTool(client, 'sheet_get_sheet_info', { file_id: fileId }));
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
            print(await callTool(client, 'sheet_get_cell_data', args));
            return;
        }
        if (subcommand === 'write') {
            if (!fileId || !sheetId) throw new Error('usage: sheets write <file_id> <sheet_id> --values <json>');
            print(await callTool(client, 'sheet_set_range_value', {
                file_id: fileId,
                sheet_id: sheetId,
                values: readJsonArg(options.values, '--values'),
            }));
            return;
        }
        if (subcommand === 'clear') {
            if (!fileId || !sheetId) throw new Error('usage: sheets clear <file_id> <sheet_id> --start-row ...');
            const args = {
                file_id: fileId,
                sheet_id: sheetId,
                ...numericRange(options, 'sheets clear', true),
            };
            print(await callTool(client, 'sheet_clear_range_cells', args));
            return;
        }
        throw new Error(`unknown sheets subcommand: ${subcommand}`);
    }

    if (command === 'smartsheet') {
        const { positional, options } = parseOptions(rest, ['view-id', 'records', 'ids']);
        const [fileId, sheetId] = positional;
        if (subcommand === 'tables') {
            if (!fileId) throw new Error('usage: smartsheet tables <file_id>');
            print(await callTool(client, 'smartsheet.list_tables', { file_id: fileId }));
            return;
        }
        if (subcommand === 'fields') {
            if (!fileId || !sheetId) throw new Error('usage: smartsheet fields <file_id> <sheet_id>');
            print(await callTool(client, 'smartsheet.list_fields', { file_id: fileId, sheet_id: sheetId }));
            return;
        }
        if (subcommand === 'records') {
            if (!fileId || !sheetId) throw new Error('usage: smartsheet records <file_id> <sheet_id>');
            const base = { file_id: fileId, sheet_id: sheetId };
            if (options['view-id']) base.view_id = options['view-id'];
            if (!options.all) {
                print(await callTool(client, 'smartsheet.list_records', base));
                return;
            }
            const records = [];
            let offset = 0;
            let hasMore = true;
            let pages = 0;
            while (hasMore) {
                const page = await callTool(client, 'smartsheet.list_records', { ...base, limit: 100, offset });
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
            print(await callTool(client, tool, {
                file_id: fileId,
                sheet_id: sheetId,
                records: readJsonArg(options.records, '--records'),
            }));
            return;
        }
        if (subcommand === 'delete') {
            if (!fileId || !sheetId) throw new Error('usage: smartsheet delete <file_id> <sheet_id> --ids <id1,id2>');
            print(await callTool(client, 'smartsheet.delete_records', {
                file_id: fileId,
                sheet_id: sheetId,
                record_ids: String(options.ids || '').split(',').filter(Boolean),
            }));
            return;
        }
        throw new Error(`unknown smartsheet subcommand: ${subcommand}`);
    }

    throw new Error(`unknown command: ${command}`);
}

main().catch(error => {
    console.error(`ERROR: ${error.message}`);
    process.exit(1);
});