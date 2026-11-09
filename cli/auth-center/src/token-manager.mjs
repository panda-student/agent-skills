// 编排层：token 生命周期管理（业务 CLI 的唯一入口）。
// 刷新阶梯：配置缓存试活 → 无头 SSO（凭据已录时）→ Edge leveldb 机会扫描 → 专用 Profile CDP 静默回路 → 落盘。
// 业务 CLI 只注入系统特定项：validateToken / headlessLogin（可选 hasCredentials/loadCredentials/cookieTokenRe/cdpPort）。
import { configFilePath, loadAppConfig, saveAppConfig } from './config-store.mjs';
import { loadCredentials, promptAndSaveCredentials } from './credentials.mjs';
import { scanEdgeTokens } from './browser-token.mjs';
import { captureTokenByCdp, SHARED_PROFILE_DIR } from './cdp-edge.mjs';
import { createRefreshLock, sleep } from './refresh-lock.mjs';
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

// 统一 SSO Profile：所有需要登录的 CLI 共用同一个浏览器 profile，账号只需在里面维护一次。
// 目录由 cdp-edge.mjs 统一定义并导出（~/.auth-center/edge-profile）。
export { SHARED_PROFILE_DIR };

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
    cookieSource = 'document', // 'cdp' 读取 HttpOnly cookie
    cdpPort = 9223,
    maxWaitMs = 180_000,
    manualLoginWaitMs = 600_000, // 检测到登录页后额外等待人工登录的时长
    profileDir = SHARED_PROFILE_DIR,
    browserFallback = true, // 无 cookie token 的系统（如禅道 API token）可关闭 leveldb/CDP 兜底
    leveldbScan = true, // 禅道等 API token 系统可单独关闭 leveldb 扫描，保留 CDP
  } = options;

  // 刷新互斥：进程内单飞（inflightRefresh）+ 跨进程文件锁（refreshLock）
  // refreshLock   应用级：同一个 CLI 的多个进程只有一份刷新动作（其余等 token）
  // browserLock   profile 级：不同 CLI 共用同一个浏览器 profile 时，浏览器操作串行
  const refreshLock = createRefreshLock(join(dirname(configFilePath(appName)), 'refresh.lock'));
  const browserLock = createRefreshLock(join(profileDir, '.browser.lock'));
  const lockPollMs = 2_000;
  let inflightRefresh = null;

  // 失败冷却：登录没成时，连续命令（如 sync 的 10 个目录各是一个进程）不再各自开一次浏览器
  const cdpCooldownPath = join(dirname(configFilePath(appName)), 'cdp-cooldown.json');
  const cdpCooldownMs = 30_000;

  function cdpCooldownActive() {
    try {
      const { failedAt } = JSON.parse(readFileSync(cdpCooldownPath, 'utf8'));
      const age = Date.now() - new Date(failedAt).getTime();
      return Number.isFinite(age) && age >= 0 && age < cdpCooldownMs;
    } catch {
      return false;
    }
  }

  function markCdpFailure() {
    try {
      mkdirSync(dirname(cdpCooldownPath), { recursive: true });
      writeFileSync(cdpCooldownPath, JSON.stringify({ failedAt: new Date().toISOString(), pid: process.pid }), 'utf8');
    } catch {
      // 冷却标记写失败不影响主流程
    }
  }

  function clearCdpFailure() {
    try { unlinkSync(cdpCooldownPath); } catch { /* 无标记 */ }
  }

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

  async function tryCdpBrowser(onManualLoginRequired) {
    return captureTokenByCdp({
      baseUrl, launchUrl, validateToken,
      profileDir,
      cookieTokenRe: cookieTokenRe || undefined,
      loginPageRe: loginPageRe || undefined,
      cookieSource,
      cdpPort, maxWaitMs, manualLoginWaitMs, onManualLoginRequired,
    });
  }

  /**
 * 配置里当前可用的 token（等锁期间别的进程可能已换好并落盘）。
 * 同一 token 值的试活结果缓存：等待期每 2 秒轮询，不能每次都发远程校验请求。
 */
  let validationCache = { token: null, valid: false };
  async function readValidSavedToken() {
    const token = currentToken();
    if (!token) return null;
    if (validationCache.token !== token) {
      validationCache = { token, valid: await validateToken(token) };
    }
    return validationCache.valid ? token : null;
  }

  /** 浏览器操作串行化（profile 级）：不同应用共用同一 profile 时也排队执行。
   *  返回 {status:'token'|'failed'|'busy'}，区分「捕获到」「真失败」「另一进程占着」 */
  async function runCdpExclusive(onManualLoginRequired) {
    const waitDeadline = Date.now() + maxWaitMs + manualLoginWaitMs + 60_000;
    const staleMs = 2 * (maxWaitMs + manualLoginWaitMs) + 120_000;
    while (!browserLock.tryAcquire()) {
      if (browserLock.isStale(staleMs)) {
        browserLock.removeStale();
        await sleep(100); // 摘除失败时退避，避免忙等
        continue;
      }
      if (Date.now() > waitDeadline) return { status: 'busy' };
      await sleep(lockPollMs);
    }
    try {
      const token = await tryCdpBrowser(onManualLoginRequired);
      return token ? { status: 'token', token } : { status: 'failed' };
    } finally {
      browserLock.release();
    }
  }

  /**
   * 浏览器段（唯一会开窗口的环节）跨进程互斥执行：
   *   抢到锁 → 先复查配置（可能已被别人换好）→ 跑 CDP 捕获 → 落盘 → 释放；
   *   没抢到 → 只轮询等新 token，绝不自己再开浏览器。
   * 这是「一次同步弹出一堆登录窗口」的根因修复点。
   */
  async function captureUnderLock(failures, { bypassCooldown = false } = {}) {
    const deadline = Date.now() + maxWaitMs + manualLoginWaitMs + 30_000;
    // 持锁最坏耗时 = 等 profile 锁 + CDP 捕获（含人工登录），阈值必须覆盖这条完整路径，
    // 否则活着的进程会被误判僵死、锁被抢走后又重复刷新
    const staleMs = 2 * (maxWaitMs + manualLoginWaitMs) + 300_000;
    let sawHeld = false;
    for (;;) {
      if (refreshLock.tryAcquire()) {
        try {
          const alreadyFresh = await readValidSavedToken(); // 排队期间别人已换好
          if (alreadyFresh) return alreadyFresh;
          if (!bypassCooldown && cdpCooldownActive()) {
            failures.push('CDP 静默回路: 30 秒内刚尝试登录未成功，跳过重复打开浏览器（确认已登录后重跑命令）');
            return null;
          }
          let manualLoginRequired = false;
          const result = await runCdpExclusive(() => { manualLoginRequired = true; });
          if (result.status === 'token') {
            clearCdpFailure();
            saveToken(result.token, 'cdp-browser');
            return result.token;
          }
          if (result.status === 'busy') {
            // 本进程根本没碰浏览器，不能写冷却，也不能冒充「超时未捕获」
            failures.push('CDP 静默回路: 另一进程正占用浏览器，未重复打开');
            return null;
          }
          if (manualLoginRequired) {
            // 不写失败冷却：登录窗口已保留，下一条命令应挂载它直接读 token
            failures.push('CDP 静默回路: 已弹出登录窗口但未完成登录，窗口已保留（登录后重跑命令即可）');
            return null;
          }
          markCdpFailure();
          failures.push('CDP 静默回路: 超时未捕获到有效 token');
          return null;
        } finally {
          refreshLock.release();
        }
      }
      if (!refreshLock.exists()) {
        // 锁刚被释放：可能刚换好 token，复查一次；确实没有就再抢锁
        const fresh = await readValidSavedToken();
        if (fresh) return fresh;
        if (sawHeld) {
          failures.push('CDP 静默回路: 另一进程登录未成功，本进程不重复打开浏览器');
          return null;
        }
        await sleep(50);
        continue;
      }
      sawHeld = true;
      if (refreshLock.isStale(staleMs)) {
        refreshLock.removeStale(); // 原子摘除僵死锁，不会误删别人随后抢到的新锁
        await sleep(100);          // 摘除失败时退避，避免忙等
        if (Date.now() > deadline) {
          failures.push('CDP 静默回路: 等待其他进程登录超时');
          return null;
        }
        continue;
      }
      const fresh = await readValidSavedToken();
      if (fresh) return fresh;
      if (Date.now() > deadline) {
        failures.push('CDP 静默回路: 等待其他进程登录超时');
        return null;
      }
      await sleep(lockPollMs);
    }
  }

  /** 全量刷新：按阶梯逐层尝试，全失败抛错（消息含各层结果，便于定位） */
  function refreshToken() {
    // 进程内单飞：4 路并发下载同时 401 时只跑一次刷新链
    if (inflightRefresh) return inflightRefresh;
    inflightRefresh = doRefreshToken().finally(() => { inflightRefresh = null; });
    return inflightRefresh;
  }

  async function doRefreshToken() {
    const cached = currentToken();
    if (cached && await validateToken(cached)) return cached;

    const failures = [];
    try {
      const headless = await tryHeadless();
      if (headless) { saveToken(headless, 'headless-sso'); return headless; }
    } catch (error) { failures.push(`无头链: ${error.message}`); }

    if (browserFallback) {
      if (leveldbScan) {
        try {
          const scanned = await tryLeveldbScan();
          if (scanned) { saveToken(scanned, 'leveldb-scan'); return scanned; }
        } catch (error) { failures.push(`leveldb 扫描: ${error.message}`); }
      }

      try {
        const captured = await captureUnderLock(failures);
        if (captured) return captured;
      } catch (error) { failures.push(`CDP 静默回路: ${error.message}`); }
    }

    throw new Error(`${label} token 获取失败（${failures.join('；') || '所有途径均未尝试'}）`);
  }

  /** 强制重新登录：跳过缓存直接走获取链（落盘后返回） */
  async function login() {
    const failures = [];
    try {
      const headless = await tryHeadless();
      if (headless) { saveToken(headless, 'headless-sso'); return headless; }
    } catch (error) { failures.push(`无头链: ${error.message}`); }

    if (browserFallback) {
      try {
        // 显式登录（用户主动执行 login）不受失败冷却限制
        const captured = await captureUnderLock(failures, { bypassCooldown: true });
        if (captured) return captured;
      } catch (error) { failures.push(`CDP 静默回路: ${error.message}`); }
    }

    throw new Error(`${label} 登录失败（${failures.join('；') || '未配置任何登录途径'}）`);
  }

  /** 一次性凭据录入（WinForms 弹窗），保存到 ~/.<appName>/sso-credentials.json */
  async function setupCredentials(dialogOptions) {
    return promptAndSaveCredentials(appName, dialogOptions);
  }

  return { currentToken, refreshToken, login, saveToken, setupCredentials };
}
