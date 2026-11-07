#!/usr/bin/env node
/**
 * Token 重置后一键同步（配置即 .config/tdocs_mcp.json，唯一真相源）
 * 用法:
 *   node sync_token.mjs            # 从系统剪贴板读取新token（auth页「复制」后直接跑）
 *   node sync_token.mjs <token>    # 或直接传token
 * 流程: 校验32位hex → 更新配置文件 token 字段 → 遍历 sync_targets 更新各处（mcp.json header）
 */
import fs from 'fs';
import { execSync } from 'child_process';
import lib from './lib/config.cjs';

const CFG_FILE = lib.resolveConfigPath('tdocs_mcp.json', 'TDOCS_CONFIG');
const CFG = JSON.parse(fs.readFileSync(CFG_FILE, 'utf8'));

const token = (process.argv[2] || execSync('powershell -NoProfile -Command "Get-Clipboard"', { encoding: 'utf8' })).trim();
if (!/^[0-9a-f]{32}$/i.test(token)) {
    console.error(`[error] token 格式不合法（应为32位hex，实际 ${token.length} 字符）——请到 ${CFG.token_source} 点「复制」后重试`);
    process.exit(1);
}

// 1. 更新配置文件自身
CFG.token = token;
fs.writeFileSync(CFG_FILE, JSON.stringify(CFG, null, 2) + '\n', 'utf8');
console.log(`[sync] ${CFG_FILE} :: token 已更新 (…${token.slice(-6)})`);

// 2. 同步所有 sync_targets（本项目脚本已读 CFG.token，此处只处理外部 JSON 引用）
for (const t of CFG.sync_targets) {
    if (!fs.existsSync(t.file)) { console.warn(`[skip] ${t.file} 不存在`); continue; }
    const doc = JSON.parse(fs.readFileSync(t.file, 'utf8'));
    const keys = t.json_path.split('.');
    let node = doc;
    for (const k of keys.slice(0, -1)) {
        if (node[k] === undefined) throw new Error(`${t.file} 缺少 ${k} 节点`);
        node = node[k];
    }
    node[keys.at(-1)] = token;
    fs.writeFileSync(t.file, JSON.stringify(doc, null, 2), 'utf8');
    console.log(`[sync] ${t.file} :: ${t.json_path} 已更新 (…${token.slice(-6)})`);
}
console.log('[done] 全部同步完成；Trae 内置 MCP 需重启会话生效');
