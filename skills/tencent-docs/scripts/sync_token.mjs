#!/usr/bin/env node
/**
 * 腾讯文档 token 同步（唯一存储：auth-center 的 apps/tencent-docs/config.json）
 *
 * 用法:
 *   node sync_token.mjs                 # 从系统剪贴板读取新 token
 *   node sync_token.mjs <token>         # 或直接传 token
 *   node sync_token.mjs --from-auth     # 读取 auth-center 已保存的 token，仅同步外部 MCP
 *
 * 流程: 校验 32 位 hex → 写入 auth-center 配置 → 遍历 tdocs_common.json 的 sync_targets
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COMMON_FILE = path.join(SKILL_ROOT, 'config', 'tdocs_common.json');
const AUTH_HOME = process.env.AUTH_CENTER_HOME || process.env.UNIFIED_AUTH_HOME || process.env.JOMOO_AUTH_HOME || path.join(os.homedir(), '.auth-center');
const AUTH_FILE = path.join(AUTH_HOME, 'apps', 'tencent-docs', 'config.json');

const common = fs.existsSync(COMMON_FILE)
    ? JSON.parse(fs.readFileSync(COMMON_FILE, 'utf8'))
    : {};

const args = process.argv.slice(2);
const fromAuth = args.includes('--from-auth');
const tokenArg = args.find(a => !a.startsWith('--'));

let token = '';
if (fromAuth) {
    if (!fs.existsSync(AUTH_FILE)) {
        console.error(`[error] 统一认证配置不存在: ${AUTH_FILE}；请先运行 auth login tencent-docs`);
        process.exit(1);
    }
    token = String(JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8')).token || '');
} else {
    token = (tokenArg || execSync('powershell -NoProfile -Command "Get-Clipboard"', { encoding: 'utf8' })).trim();
}

if (!/^[0-9a-f]{32}$/i.test(token)) {
    console.error(`[error] token 格式不合法（应为32位hex，实际 ${token.length} 字符）——请到 ${common.token_source || '腾讯文档 MCP 授权页'} 点「复制」后重试`);
    process.exit(1);
}

if (!fromAuth) {
    const auth = fs.existsSync(AUTH_FILE)
        ? JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'))
        : {};
    auth.token = token;
    auth.tokenSavedAt = new Date().toISOString();
    auth.tokenSource = common.token_source || '腾讯文档 MCP 授权页';
    fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
    fs.writeFileSync(AUTH_FILE, JSON.stringify(auth, null, 2) + '\n', 'utf8');
    console.log(`[sync] ${AUTH_FILE} :: token 已更新 (…${token.slice(-6)})`);
}

for (const t of common.sync_targets || []) {
    if (!fs.existsSync(t.file)) {
        console.warn(`[skip] ${t.file} 不存在`);
        continue;
    }
    try {
        const doc = JSON.parse(fs.readFileSync(t.file, 'utf8'));
        const keys = t.json_path.split('.');
        let node = doc;
        let missing = null;
        for (const k of keys.slice(0, -1)) {
            if (node[k] === undefined) { missing = k; break; }
            node = node[k];
        }
        if (missing) {
            console.warn(`[skip] ${t.file} 缺少 ${missing} 节点（该 MCP 客户端未配置 tencent-docs）`);
            continue;
        }
        node[keys.at(-1)] = token;
        fs.writeFileSync(t.file, JSON.stringify(doc, null, 2), 'utf8');
        console.log(`[sync] ${t.file} :: ${t.json_path} 已更新 (…${token.slice(-6)})`);
    } catch (error) {
        console.warn(`[skip] ${t.file}: ${error.message}`);
    }
}
console.log('[done] 全部同步完成；Trae 内置 MCP 需重启会话生效');