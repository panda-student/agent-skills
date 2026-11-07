// 编排层：token 生命周期管理（业务 CLI 的唯一入口）。
// 刷新阶梯：配置缓存试活 → 无头 SSO（凭据已录时）→ Edge leveldb 机会扫描 → 专用 Profile CDP 静默回路 → 落盘。
// 业务 CLI 只注入系统特定项：validateToken / headlessLogin（可选 hasCredentials/loadCredentials/cookieTokenRe/cdpPort）。
import { loadAppConfig, saveAppConfig } from './config-store.mjs';
import { loadCredentials, promptAndSaveCredentials } from './credentials.mjs';
import { scanEdgeTokens } from './browser-token.mjs';
import { captureTokenByCdp } from './cdp-edge.mjs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export function createTokenManager(options) {
  const {
    appName,
    label = appName,
    baseUrl,
    launchUrl = baseUrl,
    validateToken,
    headlessLogin = null,
    hasCredentials = null,
    loadCredentials: loadCred = null,
    cookieTokenRe = null,
    loginPageRe = null,
    cdpPort = 9223,
    maxWaitMs = 180_000,
  } = options;

  function currentToken() {
    return loadAppConfig(appName).token || null;
  }

  function saveToken(token, source) {
    const config = loadAppConfig(appName);
    config.token = token;
    config.tokenSavedAt = new Date().toISOString();
    config.tokenSource = source;
    saveAppConfig(appName, config);
  }

  async function tryHeadless() {
    if (!headlessLogin) return null;
    const cred = loadCred ? loadCred() : loadCredentials(appName);
    const usable = hasCredentials ? hasCredentials() : !!cred;
    if (!usable || !cred) return null;
    const token = await headlessLogin(cred);
    return token || null;
  }

  async function tryLeveldbScan() {
    const candidates = await scanEdgeTokens();
    for (const candidate of candidates) {
      if (await validateToken(candidate)) return candidate;
    }
    return null;
  }

  async function tryCdpBrowser() {
    return captureTokenByCdp({
      baseUrl, launchUrl, validateToken,
      profileDir: join(homedir(), '.' + appName, 'edge-sso-profile'),
      cookieTokenRe: cookieTokenRe || undefined,
      loginPageRe: loginPageRe || undefined,
      cdpPort, maxWaitMs,
    });
  }

  /** 全量刷新：按阶梯逐层尝试，全失败抛错（消息含各层结果，便于定位） */
  async function refreshToken() {
    const cached = currentToken();
    if (cached && await validateToken(cached)) return cached;

    const failures = [];
    try {
      const headless = await tryHeadless();
      if (headless) { saveToken(headless, 'headless-sso'); return headless; }
    } catch (error) { failures.push(`无头链: ${error.message}`); }

    try {
      const scanned = await tryLeveldbScan();
      if (scanned) { saveToken(scanned, 'leveldb-scan'); return scanned; }
    } catch (error) { failures.push(`leveldb 扫描: ${error.message}`); }

    try {
      const captured = await tryCdpBrowser();
      if (captured) { saveToken(captured, 'cdp-browser'); return captured; }
      failures.push('CDP 静默回路: 超时未捕获到有效 token');
    } catch (error) { failures.push(`CDP 静默回路: ${error.message}`); }

    throw new Error(`${label} token 获取失败（${failures.join('；') || '所有途径均未尝试'}）`);
  }

  /** 强制重新登录：跳过缓存直接走获取链（落盘后返回） */
  async function login() {
    const failures = [];
    try {
      const headless = await tryHeadless();
      if (headless) { saveToken(headless, 'headless-sso'); return headless; }
    } catch (error) { failures.push(`无头链: ${error.message}`); }

    try {
      const captured = await tryCdpBrowser();
      if (captured) { saveToken(captured, 'cdp-browser'); return captured; }
      failures.push('CDP 静默回路: 超时未捕获到有效 token');
    } catch (error) { failures.push(`CDP 静默回路: ${error.message}`); }

    throw new Error(`${label} 登录失败（${failures.join('；') || '未配置任何登录途径'}）`);
  }

  /** 一次性凭据录入（WinForms 弹窗），保存到 ~/.<appName>/sso-credentials.json */
  async function setupCredentials(dialogOptions) {
    return promptAndSaveCredentials(appName, dialogOptions);
  }

  return { currentToken, refreshToken, login, saveToken, setupCredentials };
}
