// 业务层：anyshare token 生命周期。通用编排（读配置→试活→无头→leveldb→CDP→落盘）
// 全部在 jomoo-auth-cli 的 createTokenManager，本文件只注入 anyshare 系统特定部分：
//   - validateToken：试活端点（文档库列表）
//   - headlessLogin / 凭据存取：/sso 回跳交换链（headless-sso.mjs）
import { createTokenManager } from 'jomoo-auth-cli';
import { BASE_URL, ENDPOINTS } from './endpoints.mjs';
import { hasSsoCredentials, headlessSsoLogin, loadSsoCredentials } from './headless-sso.mjs';

/** 轻接口试活：token 是否有效（调文档库列表，网络异常按无效处理） */
export async function validateToken(token) {
  if (!token) return false;
  try {
    const res = await fetch(new URL(ENDPOINTS.docLibList, BASE_URL), {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.status === 200;
  } catch {
    return false;
  }
}

const tokenManager = createTokenManager({
  appName: 'anyshare-cli',
  label: 'AnyShare',
  baseUrl: BASE_URL,
  // 必须从首页进入让 SPA 自行发起 OAuth 流程；直接访问 /anyshare/oauth2/login 会因
  // SPA 缺少本地 state 生成 state=undefined，回调卡死在 login/callback（实测坑位）
  launchUrl: new URL(ENDPOINTS.homepage, BASE_URL).href,
  validateToken,
  headlessLogin: headlessSsoLogin,
  hasCredentials: hasSsoCredentials,
  loadCredentials: loadSsoCredentials,
});

export const currentToken = tokenManager.currentToken;
export const refreshToken = tokenManager.refreshToken;
export const login = tokenManager.login;
