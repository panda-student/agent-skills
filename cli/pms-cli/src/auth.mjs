// PMS 认证适配层：只提供系统特定项，生命周期交给 jomoo-auth-cli。
// 统一 SSO Profile 由认证库默认提供（所有登录 CLI 共用一个 Edge profile）。
import { createTokenManager, SHARED_PROFILE_DIR } from 'jomoo-auth-cli';

function decodeJwt(token) {
  try {
    const payload = token.split('.')[1];
    const json = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** nisbos_auth_token 是 JWT，按 exp 判定有效性，不额外依赖需要鉴权的接口 */
export async function validateToken(token) {
  const jwt = decodeJwt(token);
  return Boolean(jwt && jwt.exp && jwt.exp * 1000 > Date.now());
}

export function describeToken(token) {
  const jwt = decodeJwt(token);
  if (!jwt) return { valid: false };
  let user = null;
  try {
    user = JSON.parse(jwt.user);
  } catch {
    // user 字段缺失或非 JSON 时只报告 JWT 基础信息
  }
  return {
    valid: Boolean(jwt.exp && jwt.exp * 1000 > Date.now()),
    subject: jwt.sub,
    employeeCode: user && (user.userCode || user.employeeCode),
    companyId: user && user.companyId,
    expiresAt: jwt.exp ? new Date(jwt.exp * 1000).toISOString() : null,
  };
}

export const tokenManager = createTokenManager({
  appName: 'pms-cli',
  label: 'PMS',
  baseUrl: 'https://uat-pms.jomoo.com',
  launchUrl: 'https://uat-pms.jomoo.com/engineeringProject/list',
  cookieTokenRe: /(?:^|;\s*)nisbos_auth_token=([^;\s]+)/,
  cdpPort: 9333,
  // 统一 SSO Profile：所有登录 CLI 共用一个 Edge profile，账号在里面维护一次
  profileDir: SHARED_PROFILE_DIR,
  validateToken,
});