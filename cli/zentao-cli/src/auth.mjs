/** 认证 — Token 获取与当前用户信息 */
import { api } from './protocol/http-client.mjs';
import * as endpoints from './protocol/endpoints.mjs';
import { getBaseUrl, getAccount, getPassword } from './config.mjs';
import { fail } from './utils/output.mjs';

/** 获取禅道 Token（失败直接退出） */
export async function getToken() {
    const r = await api(endpoints.token(getBaseUrl()), 'POST', null, {
        account: getAccount(),
        password: getPassword()
    });
    if (!r.token) fail('登录失败，请检查账号密码');
    return r.token;
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
