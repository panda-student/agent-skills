/**
 * 配置管理 — %USERPROFILE%\.zentao\config.json 的读取/校验/写入
 * 可用环境变量 ZENTAO_CONFIG 覆盖路径（测试或多配置场景）
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fail } from './utils/output.mjs';

export const CONFIG_PATH = process.env.ZENTAO_CONFIG || path.join(os.homedir(), '.zentao', 'config.json');

let cfgCache = null;

/** 读取并校验配置；缺失/不完整时给出 setup 引导并退出 */
function readAndValidate() {
    if (!fs.existsSync(CONFIG_PATH)) {
        fail(`配置文件不存在(${CONFIG_PATH})，请先运行: zentao setup --base-url <API地址> --account <账号> --password <密码>`);
    }
    const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    if (!cfg.auth || !cfg.auth.baseUrl || !cfg.auth.account || !cfg.auth.password) {
        fail(`配置不完整(${CONFIG_PATH})，请重新运行: zentao setup --base-url <API地址> --account <账号> --password <密码>`);
    }
    return cfg;
}

/** 懒加载配置（setup/help/version 无需配置即可运行） */
export function getConfig() {
    if (!cfgCache) cfgCache = readAndValidate();
    return cfgCache;
}

export function getBaseUrl() { return getConfig().auth.baseUrl; }
export function getAccount() { return getConfig().auth.account; }
export function getPassword() { return getConfig().auth.password; }

/** 由 API URL 推导 Web URL（用于生成禅道页面链接） */
export function getWebUrl() {
    return getBaseUrl().replace('/api.php/v1', '').replace(/\/+$/, '') + '/';
}

/** 写入配置（setup 命令） */
export function writeConfig(input) {
    const config = {
        "说明": "禅道 CLI 配置文件 — 由 zentao setup 写入",
        "auth": {
            "baseUrl": String(input.baseUrl).replace(/\/+$/, ''),
            "account": input.account,
            "password": input.password
        },
        "defaultAssignee": input.assignee || input.account
    };
    fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf-8');
    return config;
}
