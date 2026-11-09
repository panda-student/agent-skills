/**
 * 认证 — 凭据与 token 生命周期统一交给 auth-center。
 *
 * 禅道没有 UCenter/SSO 入口，/tokens 仍用账号密码交换；但密码不再写进配置：
 * - 凭据：~/.auth-center/apps/zentao-cli/sso-credentials.json（auth-center 弹窗/vault 注入）
 * - Token：createTokenManager 缓存到 ~/.auth-center/apps/zentao-cli/config.json
 * - leveldb 扫描关闭；CDP 仅用于浏览器登录时读取 zentaosid（HttpOnly）
 */
import { api } from './protocol/http-client.mjs';
import * as endpoints from './protocol/endpoints.mjs';
import { getBaseUrl, getWebUrl, getAccount, APP_NAME } from './config.mjs';
import {
    createTokenManager,
    loadCredentials,
    saveCredentials,
    promptAndSaveCredentials,
    loadAppConfig,
    saveAppConfig,
} from 'auth-center';

/** 读取可用凭据；占位符视为未注入 */
export function loadSsoCredentials() {
    const cred = loadCredentials(APP_NAME);
    if (!cred || !cred.account || !cred.password) return null;
    if (String(cred.password).includes('{{credential}}')) return null;
    // 配置账号变更后，旧凭据不能继续用于无头登录
    const expected = getAccount();
    if (expected && cred.account !== expected) return null;
    return cred;
}

export function hasSsoCredentials() {
    return !!loadSsoCredentials();
}

export function saveSsoCredentials(cred) {
    saveCredentials(APP_NAME, cred);
}

/** 禅道系统特定登录：账号密码 → /tokens */
async function headlessLogin(cred) {
    const r = await api(endpoints.token(getBaseUrl()), 'POST', null, {
        account: cred.account,
        password: cred.password
    });
    if (!r.token) throw new Error('禅道账号密码登录失败（请检查 auth-center 中的凭据）');
    return r.token;
}

/** 轻接口试活：my-work-task.json 能返回 tasks 即 token 有效 */
export async function validateToken(token) {
    if (!token) return false;
    try {
        const r = await api(endpoints.myWork(getWebUrl()), 'GET', token);
        let data = r && r.data;
        if (typeof data === 'string') data = JSON.parse(data);
        return !!(data && data.tasks);
    } catch {
        return false;
    }
}

let manager = null;

/** 懒加载，避免 setup/help 阶段读取配置 */
function getManager() {
    if (!manager) {
        manager = createTokenManager({
            appName: APP_NAME,
            label: '禅道',
            baseUrl: new URL(getBaseUrl()).origin,
            launchUrl: getWebUrl() + 'my-work-task',
            // 禅道浏览器登录 cookie 是 HttpOnly，必须走 CDP 读取
            cookieTokenRe: /(?:^|;\s*)zentaosid=([^;\s]+)/,
            loginPageRe: /user-login|m=user&f=login/i,
            cookieSource: 'cdp',
            leveldbScan: false,
            validateToken,
            headlessLogin,
            hasCredentials: hasSsoCredentials,
            loadCredentials: loadSsoCredentials
        });
    }
    return manager;
}

/** 缓存 token 属于哪个账号；切换账号时避免复用旧 token */
function rememberAccount(account) {
    const cfg = loadAppConfig(APP_NAME);
    if (cfg.account !== account) {
        cfg.account = account;
        saveAppConfig(APP_NAME, cfg);
    }
}

/**
 * 获取可用 Token。
 * 阶梯由 auth-center 统一编排：缓存试活 → 凭据无头登录（已录入时）→ CDP 弹窗登录 → 落盘。
 */
export async function getToken() {
    const account = getAccount();
    const cfg = loadAppConfig(APP_NAME);
    if (cfg.token && cfg.account && cfg.account !== account) {
        clearToken(); // 账号已切换，旧 token 不能复用
    }
    const token = await getManager().refreshToken();
    rememberAccount(account);
    return token;
}

/** 当前缓存 token（不触发刷新） */
export function currentToken() {
    return getManager().currentToken();
}

/** 显式登录：无凭据时打开共享 Profile 的 Edge 让用户登录，捕获 token 后落盘 */
export async function login() {
    const account = getAccount();
    const token = await getManager().login();
    rememberAccount(account);
    return token;
}

/** 一次性凭据录入（WinForms 弹窗，明文不进终端） */
export async function setupCredentials() {
    // promptAndSaveCredentials 已落盘，无需二次 saveSsoCredentials
    return promptAndSaveCredentials(APP_NAME, { windowTitle: '禅道凭据录入' });
}

/** 清除缓存 token（保留凭据） */
export function clearToken() {
    const cfg = loadAppConfig(APP_NAME);
    delete cfg.token;
    delete cfg.tokenSavedAt;
    delete cfg.tokenSource;
    saveAppConfig(APP_NAME, cfg);
}

/** token 缓存元信息（whoami 用） */
export function tokenMeta() {
    const cfg = loadAppConfig(APP_NAME);
    return {
        tokenSavedAt: cfg.tokenSavedAt || null,
        tokenSource: cfg.tokenSource || null
    };
}

/** 获取当前用户信息（无权限时用登录账号兜底） */
export async function getCurrentUser(token) {
    try {
        const r = await api(endpoints.users(getBaseUrl()), 'GET', token);
        const users = r.users || [];
        return users.find(u => u.account === getAccount()) || { account: getAccount(), realname: getAccount() };
    } catch (e) {
        return { account: getAccount(), realname: getAccount() };
    }
}