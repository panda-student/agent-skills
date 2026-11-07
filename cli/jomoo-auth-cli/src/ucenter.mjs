// 执行层：UCenter OAuth2 无头链（纯 HTTP，零浏览器）。
//   1) loginByCode：POST JSON {account,password,systemId} → data 即授权码（32位hex）
//   2) tokenByCode：GET ?code&systemId&clientSecret&grantType&redirectUri → 302 Location
//      query 携带 {userId, expireTime, ssoToken(JWT), refreshToken}
// 形态于 2026-11-06 对 api-ucenter-uat-jmbos 实测校准（IBPM systemId=210, clientSecret=jomoo）；
// POST /oauth2/tokenByCode 返回 not handle，必须 GET；无 redirectUri 时报服务端异常。
import { createCookieJar, extractToken } from './cookie-jar.mjs';

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

/** 账号密码换授权码。jar 由调用方传入以复用 UCenter 会话 cookie */
export async function ucenterLoginByCode({ ucenterBase, account, password, systemId, jar }) {
  const cookieJar = jar || createCookieJar();
  const url = new URL('/oauth2/loginByCode', ucenterBase).href;
  const body = { account, password };
  if (systemId) body.systemId = systemId;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': BROWSER_UA, ...cookieJar.header(url) },
    body: JSON.stringify(body),
  });
  cookieJar.store(res, url);
  const payload = await res.json();
  if (!res.ok || payload.success === false) {
    throw new Error(`UCenter loginByCode 失败: ${JSON.stringify(payload).slice(0, 200)}`);
  }
  if (typeof payload.data !== 'string' || !payload.data) {
    throw new Error(`UCenter loginByCode 未返回授权码: ${JSON.stringify(payload).slice(0, 200)}`);
  }
  return payload.data;
}

/** 授权码换 token 对。返回 { ssoToken, refreshToken, expireTime?, userId? } */
export async function ucenterTokenByCode({ ucenterBase, systemId, clientSecret, grantType, code, redirectUri, jar }) {
  const cookieJar = jar || createCookieJar();
  const query = new URLSearchParams({ code, clientSecret, grantType: grantType || 'authorizationCode' });
  if (systemId) query.set('systemId', systemId);
  if (redirectUri) query.set('redirectUri', redirectUri);
  const url = new URL('/oauth2/tokenByCode', ucenterBase).href;
  const res = await fetch(`${url}?${query}`, {
    redirect: 'manual',
    headers: { 'User-Agent': BROWSER_UA, ...cookieJar.header(url) },
  });
  cookieJar.store(res, url);
  const location = res.headers.get('location');
  if (!location) {
    throw new Error(`UCenter tokenByCode 未重定向: HTTP ${res.status} ${JSON.stringify(await res.text().catch(() => '')).slice(0, 200)}`);
  }
  const tokenQuery = new URL(new URL(location, url).href).searchParams;
  const ssoToken = tokenQuery.get('ssoToken') || extractToken(location);
  const refreshToken = tokenQuery.get('refreshToken');
  if (!ssoToken) {
    throw new Error(`UCenter tokenByCode 重定向未携带 token: ${location.slice(0, 200)}`);
  }
  const result = { ssoToken, refreshToken };
  if (tokenQuery.get('expireTime')) result.expireTime = tokenQuery.get('expireTime');
  if (tokenQuery.get('userId')) result.userId = tokenQuery.get('userId');
  return result;
}
