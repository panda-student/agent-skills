/** 命令：账号域 — setup（配置账号/凭据）/ login（登录）/ whoami / logout */
import { api } from '../protocol/http-client.mjs';
import * as endpoints from '../protocol/endpoints.mjs';
import { CONFIG_PATH, getAccount, getBaseUrl, readConfigFile, writeConfig } from '../config.mjs';
import { clearCredentials } from 'auth-center';
import {
    getToken,
    getCurrentUser,
    login,
    saveSsoCredentials,
    setupCredentials,
    currentToken,
    validateToken,
    tokenMeta,
    clearToken,
    loadSsoCredentials
} from '../auth.mjs';
import { ok } from '../utils/output.mjs';

/**
 * zentao setup --base-url <url> --account <acc> [--assignee <acc>] [--credentials]
 * 密码不写配置：--password 仅为兼容旧用法，会转存到 auth-center 凭据文件
 * @param {{baseUrl: string, account: string, password?: string, assignee?: string}} input
 */
export async function cmdSetup(input) {
    try {
        const before = readConfigFile();
        const config = writeConfig(input);
        let credentials = 'unchanged';
        if (before.auth?.account && input.account && before.auth.account !== input.account) {
            clearCredentials('zentao-cli');
            credentials = 'cleared';
        }
        if (input.password) {
            saveSsoCredentials({ account: input.account || config.auth.account, password: input.password });
            credentials = 'saved';
        }
        ok({
            status: 'ok',
            message: '账号配置已保存（密码由 auth-center 管理）',
            configPath: CONFIG_PATH,
            account: config.auth.account,
            baseUrl: config.auth.baseUrl,
            credentials
        });
    } catch (e) {
        ok({ status: 'error', message: e.message });
    }
}

/** zentao setup --credentials — 弹窗录入凭据并验证登录 */
export async function cmdSetupCredentials() {
    try {
        const cred = await setupCredentials();
        const token = await getToken();
        ok({
            status: 'ok',
            message: '凭据已保存并通过登录验证',
            account: cred.account,
            tokenState: token ? 'valid' : 'unknown'
        });
    } catch (e) {
        ok({ status: 'error', message: e.message });
    }
}

/** zentao login — 强制登录并返回产品/执行清单（供用户交互选择） */
export async function cmdLogin() {
    const token = await login();
    const userInfo = await getCurrentUser(token);
    const baseUrl = getBaseUrl();

    const prodData = await api(endpoints.products(baseUrl), 'GET', token);
    const products = (prodData.products || []).map(p => ({ id: p.id, name: p.name }));

    const execMap = new Map();
    try {
        const r = await api(endpoints.executions(baseUrl), 'GET', token);
        (r.executions || []).forEach(e => { if (e.id && e.name) execMap.set(e.id, { id: e.id, name: e.name }); });
    } catch (e) { /* 执行列表获取失败不阻塞登录 */ }

    ok({
        status: 'ok',
        user: { account: userInfo.account, realname: userInfo.realname },
        products,
        executions: [...execMap.values()]
    });
}

/** zentao token — 输出当前可用 token（供脚本/直接 HTTP 调用） */
export async function cmdToken() {
    const token = await getToken();
    process.stdout.write(token);
}

/** zentao whoami — 当前缓存 token 状态（不触发刷新） */
export async function cmdWhoami() {
    try {
        const token = currentToken();
        const meta = tokenMeta();
        if (!token) {
            ok({ status: 'ok', state: 'missing', message: '未登录，执行: zentao login' });
            return;
        }
        const valid = await validateToken(token);
        const cred = loadSsoCredentials();
        ok({
            status: 'ok',
            state: valid ? 'valid' : 'expired',
            account: cred ? cred.account : getAccount(),
            tokenSavedAt: meta.tokenSavedAt,
            tokenSource: meta.tokenSource,
            message: valid ? 'token 有效' : 'token 已失效，执行: zentao login'
        });
    } catch (e) {
        ok({ status: 'error', message: e.message });
    }
}

/** zentao logout — 清除缓存 token（保留配置与凭据） */
export async function cmdLogout() {
    try {
        clearToken();
        ok({ status: 'ok', message: '已清除缓存 token（凭据保留）' });
    } catch (e) {
        ok({ status: 'error', message: e.message });
    }
}