// PMS 认证适配层：通用登录生命周期与无头网页登录来自 auth-center；这里只声明 PMS 差异。
import { createTokenManager, webHeadlessLogin, validateJwtToken } from 'auth-center';

function decodeJwt(token) {
  try {
    const payload = token.split('.')[1];
    const json = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export async function validateToken(token) {
  return validateJwtToken(token);
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
  validateToken,
  headlessLogin: credential => webHeadlessLogin({
    loginUrl: 'https://uat-pms.jomoo.com/login',
    companyText: null,
    cookieName: 'nisbos_auth_token',
    credential,
  }),
  cookieTokenRe: /(?:^|;\s*)nisbos_auth_token=([^;\s]+)/,
  cdpPort: 9333,
  leveldbScan: false,
});
