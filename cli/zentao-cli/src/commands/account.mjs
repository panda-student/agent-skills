/** 命令：账号域 — setup（配置账号）/ login（登录获取产品+执行列表） */
import { api } from '../protocol/http-client.mjs';
import * as endpoints from '../protocol/endpoints.mjs';
import { CONFIG_PATH, getBaseUrl, writeConfig } from '../config.mjs';
import { getToken, getCurrentUser } from '../auth.mjs';
import { ok } from '../utils/output.mjs';

/**
 * zentao setup --base-url <url> --account <acc> --password <pwd> [--assignee <acc>]
 * @param {{baseUrl: string, account: string, password: string, assignee?: string}} input
 */
export async function cmdSetup(input) {
    try {
        writeConfig(input);
        ok({
            status: 'ok',
            message: '账号配置已保存',
            configPath: CONFIG_PATH,
            account: input.account,
            baseUrl: input.baseUrl
        });
    } catch (e) {
        ok({ status: 'error', message: e.message });
    }
}

/** zentao login — 登录并返回产品/执行清单（供用户交互选择） */
export async function cmdLogin() {
    const token = await getToken();
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
