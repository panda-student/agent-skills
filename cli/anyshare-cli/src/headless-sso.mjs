// 执行层：anyshare 无头登录链（系统特定交换链；未实测打通，失败返回 null 回落浏览器链路）
// 链路（推测自 thirdauth 配置 + auth-center 已验证的 UCenter 端点形态）：
//   1) UCenter loginByCode（auth-center）→ 授权码 code
//   2) GET  {BASE}/sso?code=<code>&state=aishu → 跟随重定向，cookie jar 收集，
//      由 wendang 后端用其 clientSecret 向 UCenter 换票并建立 Hydra 会话
//   3) 从重定向链 / 响应体 / cookie 中提取 ory_at token
// 凭据：按 vault-ops 技能在 vault 中维护；运行时由 auth-center 取用（不落盘）
import { UCENTER_LOGIN_BY_CODE, SSO_CALLBACK } from './endpoints.mjs';
import { ucenterLoginByCode, createCookieJar, extractToken, loadCredentials } from 'auth-center';

const ANYSHARE_APP = 'anyshare-cli';

export function hasSsoCredentials() {
  try { return !!loadCredentials(ANYSHARE_APP); } catch { return false; }
}

export function loadSsoCredentials() {
  return loadCredentials(ANYSHARE_APP);
}

/** 无头登录主流程。成功返回 ory_at token，失败返回 null（不抛错，让上层回落浏览器链路） */
export async function headlessSsoLogin(cred) {
  try {
    const jar = createCookieJar();

    // 1) 账号密码 → 授权码（systemId 未知，先不带；UCenter 报缺参则换 aishu 标识再试）
    let code = null;
    for (const body of [
      { account: cred.account, password: cred.password },
      { account: cred.account, password: cred.password, systemId: 'aishu' },
    ]) {
      try {
        code = await ucenterLoginByCode({ ucenterBase: new URL(UCENTER_LOGIN_BY_CODE).origin, ...body, jar });
        break;
      } catch { /* 换参数形态重试 */ }
    }
    if (!code) return null;

    // 2) 授权码回跳 wendang /sso，跟随重定向收集 cookie（manual 模式手动跟 5 跳）
    const origin = new URL(SSO_CALLBACK).origin;
    let url = `${SSO_CALLBACK}?code=${encodeURIComponent(code)}&state=aishu`;
    for (let hop = 0; hop < 5 && url; hop++) {
      const r = await fetch(url, { redirect: 'manual', headers: jar.header(origin) });
      jar.store(r, origin);
      const body = await r.text().catch(() => '');
      const token = extractToken([(r.headers.get('location') || ''), body].join('\n'));
      if (token) return token;
      const loc = r.headers.get('location');
      url = loc ? new URL(loc, url).href : null;
    }

    // 3) cookie 里也可能直接带 token（Authorization cookie = "Bearer ory_at_..."）
    const authCookie = jar.get(origin, 'Authorization');
    if (authCookie) {
      const token = extractToken(authCookie);
      if (token) return token;
    }
    return null;
  } catch {
    return null;
  }
}

/** 验证 vault 中的凭据 + 无头登录验证（anyshare cred-setup 命令实现）。返回 token 或 null */
export async function ssoSetup() {
  const cred = loadSsoCredentials();
  if (!cred) throw new Error('vault 中未找到 AnyShare 凭据，请先在 vault 中维护（操作见 vault-ops 技能）');
  console.log(`✓ 已从 vault 读取 AnyShare 凭据（账号 ${cred.account}）`);

  console.log('\n[anyshare] 验证无头登录...');
  const token = await headlessSsoLogin(cred);
  if (!token) {
    console.log('△ 无头登录未打通（链路未实测确认），CLI 会自动回落浏览器静默回路取号，不影响使用。');
  }
  return token;
}
