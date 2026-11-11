/**
 * 配置管理 — 只存 baseUrl / account / defaultAssignee + token 缓存，不存密码。
 *
 * 路径：ZENTAO_CONFIG 或 ~/.auth-center/apps/zentao-cli/config.json
 * 凭据：按 vault-ops 技能在 vault 中维护，运行时由 auth-center 取用（不落盘）
 * 旧路径 ~/.zentao-cli/config.json 与 ~/.zentao/config.json 会自动/一次性迁移
 * Token：auth-center createTokenManager 缓存到同一 config.json
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { loadCredentials, configFilePath, ensureAppFile } from 'auth-center';
import { fail } from './utils/output.mjs';

export const APP_NAME = 'zentao-cli';
export const CONFIG_PATH = process.env.ZENTAO_CONFIG || configFilePath(APP_NAME);

let cfgCache = null;

/**
 * 一次性迁移旧路径：
 *   ~/.zentao-cli/config.json → ~/.auth-center/apps/zentao-cli/config.json
 *   ~/.zentao/config.json    → 合并连接信息；旧 auth.password 不再落盘，提示改由 vault 维护
 */
function ensureMigrated() {
    if (process.env.ZENTAO_CONFIG) return;
    ensureAppFile(APP_NAME, 'config.json');

    const legacy = path.join(os.homedir(), '.zentao', 'config.json');
    if (!fs.existsSync(legacy)) return;
    let old = {};
    try { old = JSON.parse(fs.readFileSync(legacy, 'utf8')); } catch { return; }

    let current = {};
    if (fs.existsSync(CONFIG_PATH)) {
        try { current = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch { current = {}; }
    }
    const account = current.auth?.account || old.auth?.account || old.defaultAssignee || '';
    const baseUrl = current.auth?.baseUrl || old.auth?.baseUrl || '';
    const merged = {
        ...current,
        "说明": "禅道 CLI 配置 — 连接信息 + token 缓存；密码由 auth-center 管理，不在此文件",
        auth: { baseUrl: String(baseUrl).replace(/\/+$/, ''), account },
        defaultAssignee: current.defaultAssignee || old.defaultAssignee || account
    };
    fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2) + '\n', 'utf8');

    const oldPassword = old.auth && old.auth.password;
    if (oldPassword && !String(oldPassword).includes('{{credential}}')) {
        console.warn('[zentao] 检测到旧配置中的密码；密码不再落盘，请在 vault 中维护禅道凭据（操作见 vault-ops 技能）');
    }

    try { fs.unlinkSync(legacy); } catch { /* 旧文件保留不影响读取 */ }
    try { fs.rmdirSync(path.dirname(legacy)); } catch { /* 目录非空则保留 */ }
    cfgCache = null;
}

/** 读取原始配置（不校验），用于 setup 比较旧账号 */
export function readConfigFile() {
    ensureMigrated();
    if (!fs.existsSync(CONFIG_PATH)) return {};
    try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')); } catch { return {}; }
}

/** 读取配置；缺失/不完整时给出 setup 引导并退出 */
function readAndValidate() {
    const cfg = readConfigFile();
    if (!fs.existsSync(CONFIG_PATH)) {
        fail(`配置文件不存在(${CONFIG_PATH})，请先运行: zentao setup --base-url <API地址> --account <账号>`);
    }
    if (!cfg.auth || !cfg.auth.baseUrl) {
        fail(`配置不完整(${CONFIG_PATH})，请重新运行: zentao setup --base-url <API地址> --account <账号>`);
    }
    return cfg;
}

/** 懒加载配置（setup/help/version 无需配置即可运行） */
export function getConfig() {
    if (!cfgCache) cfgCache = readAndValidate();
    return cfgCache;
}

export function getBaseUrl() { return getConfig().auth.baseUrl; }

/** 账号优先取配置，其次取 auth-center 凭据，最后取 defaultAssignee */
export function getAccount() {
    const cfg = getConfig();
    const account = cfg.auth.account || cfg.defaultAssignee;
    if (account) return account;
    try {
        const cred = loadCredentials(APP_NAME);
        if (cred && cred.account) return cred.account;
    } catch { /* vault 不可用或未登记时按缺少 account 处理 */ }
    fail('配置缺少 account：请运行 zentao setup --base-url <API地址> --account <账号>');
}

/** 由 API URL 推导 Web URL（用于生成禅道页面链接） */
export function getWebUrl() {
    return getBaseUrl().replace('/api.php/v1', '').replace(/\/+$/, '') + '/';
}

/**
 * 写入连接配置（setup 命令）。保留同文件里的 token 缓存字段。
 * password 不再落盘：密码统一在 vault 中维护（操作见 vault-ops 技能）。
 */
export function writeConfig(input) {
    const existing = readConfigFile();
    const account = input.account || existing.auth?.account || existing.defaultAssignee || '';
    const config = {
        ...existing,
        "说明": "禅道 CLI 配置 — 连接信息 + token 缓存；密码由 auth-center 管理，不在此文件",
        "auth": {
            "baseUrl": String(input.baseUrl || existing.auth?.baseUrl || '').replace(/\/+$/, ''),
            "account": account
        },
        "defaultAssignee": input.assignee || account
    };
    fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf-8');
    cfgCache = null;
    return config;
}