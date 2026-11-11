// SSO 全自动登录：UCenter OAuth2 授权码链路的纯 HTTP 实现（零浏览器、零人工）
// 链路（自 IBPM mvue 前端 ssoConfig + jsapp 反推，2026-10-27 实测探活）：
//   1) UCenter loginByCode（auth-center）→ 授权码 code
//   2) UCenter tokenByCode（auth-center）→ ssoToken/refreshToken
//   3) GET  {ibpm}/uc/sso/auth?ticket=<refreshToken>&code=<ssoToken>&service=<页面URL> → 顶层含 JWT token
//      （第 3 步为 IBPM 系统特定交换链，保留在本文件）
// 凭据：按 vault-ops 技能在 vault 中维护；运行时由 auth-center 取用（不落盘）
import { parseJwt, ENV_PRESETS, saveEnvToken } from './config.mjs';
import {
  ucenterLoginByCode,
  ucenterTokenByCode,
  createCookieJar,
  loadCredentials,
} from 'auth-center';

// UCenter SSO 参数（按环境扩展）；clientSecret/grantType 与 IBPM mvue/sso.js 一致
const SSO_PRESETS = {
  uat: { ucenter: 'https://api-ucenter-uat-jmbos.jomoo.com', systemId: '210', clientSecret: 'jomoo', grantType: 'authorizationCode' },
};

const IBPM_APP = 'ibpm-cli';

// ---------- 凭据存取（vault 运行时取用，多环境通过 config.json 的 vault 映射区分） ----------

export function hasSsoCredentials(envName = 'uat') {
  try { return !!loadSsoCredentials(envName); } catch { return false; }
}

function loadSsoCredentials(envName = 'uat') {
  return loadCredentials(IBPM_APP, { env: envName });
}

// ---------- 纯 HTTP SSO 链路（1/2 步走 auth-center，第 3 步为 IBPM 特定） ----------

// ssoToken/refreshToken → IBPM JWT（多形态尝试，取第一个能解析出 exp 的 JWT）
async function exchangeJwt(baseUrl, tokens, service) {
  const tries = [];
  if (tokens.refreshToken) tries.push(`${baseUrl}/uc/sso/auth?ticket=${encodeURIComponent(tokens.refreshToken)}&code=${encodeURIComponent(tokens.ssoToken)}&service=${encodeURIComponent(service)}`);
  if (tokens.ssoToken) tries.push(`${baseUrl}/uc/sso/getJwtTokenByAccessToken?accessToken=${encodeURIComponent(tokens.ssoToken)}`);
  if (tokens.ssoToken) tries.push(`${baseUrl}/uc/sso/getTokenBySsoCode?ssoCode=${encodeURIComponent(tokens.ssoToken)}`);
  for (const url of tries) {
    try {
      const r = await fetch(url);
      const j = await r.json().catch(() => null);
      const t = findJwt(j);
      if (t) return t;
    } catch { /* 尝试下一形态 */ }
  }
  throw new Error('ssoToken 换 JWT 失败（所有已知端点均未返回有效 token）');
}

function findJwt(node, depth = 0) {
  if (depth > 5 || node == null) return null;
  if (typeof node === 'string') {
    return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(node) && parseJwt(node) ? node : null;
  }
  if (typeof node === 'object') {
    for (const v of Object.values(node)) {
      const hit = findJwt(v, depth + 1);
      if (hit) return hit;
    }
  }
  return null;
}

/** 全自动登录主流程：凭据 → 授权码 → ssoToken → JWT → 落盘配置 */
export async function ssoLogin(envName = 'uat') {
  const sso = SSO_PRESETS[envName];
  const preset = ENV_PRESETS[envName];
  if (!sso || !preset) throw new Error(`未知环境: ${envName}`);
  const cred = loadSsoCredentials(envName);
  if (!cred) throw new Error(`vault 中未找到 IBPM 凭据，请先按 vault-ops 技能维护，再执行: ibpm sso-setup -e ${envName}`);

  const jar = createCookieJar();
  const redirectUri = preset.baseUrl + preset.loginPath;

  // 1) 账号密码 → 授权码
  const code = await ucenterLoginByCode({
    ucenterBase: sso.ucenter, account: cred.account, password: cred.password, systemId: sso.systemId, jar,
  });

  // 2) 授权码 → ssoToken/refreshToken
  const tokens = await ucenterTokenByCode({
    ucenterBase: sso.ucenter, systemId: sso.systemId, clientSecret: sso.clientSecret,
    grantType: sso.grantType, code, redirectUri, jar,
  });

  // 3) ssoToken → IBPM JWT → 落盘
  const token = await exchangeJwt(preset.baseUrl, tokens, redirectUri);
  const jwt = parseJwt(token);
  saveEnvToken(envName, token);
  return { token, jwt };
}

// ---------- 凭据验证（密码统一由 vault 管理） ----------

/** 验证 vault 中的 IBPM 凭据并执行全自动登录 */
export async function ssoSetup(envName = 'uat') {
  const preset = ENV_PRESETS[envName];
  if (!preset) throw new Error(`未知环境: ${envName}`);

  const cred = loadSsoCredentials(envName);
  if (!cred) throw new Error('vault 中未找到 IBPM 凭据，请先在 vault 中维护（操作见 vault-ops 技能）');
  console.log(`✓ 已从 vault 读取 IBPM 凭据（账号 ${cred.account}）`);

  console.log('\n[ibpm] 验证全自动登录...');
  const { jwt } = await ssoLogin(envName);
  const exp = new Date(jwt.exp * 1000).toLocaleString('zh-CN');
  console.log(`✓ 全自动登录成功：用户 ${jwt.sub || '?'}，token 有效期至 ${exp}`);
  console.log('  已写入 ~/.auth-center/apps/ibpm-cli/config.json。此后 `ibpm login` 无需浏览器与人工操作。');
}
