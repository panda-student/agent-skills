// 执行层：专用 Profile Edge + CDP 静默回路（主通道）。
// 以独立 user-data-dir 唤起 Edge 打开系统首页：会话有效时 SPA 自行走静默 SSO 换发，
// 轮询 CDP 抓 document.cookie 中的 token；落到登录页则弹置顶提示等用户登录一次。
// CDP 通道自实现最小 WebSocket 客户端（握手 + 文本帧收发），零第三方依赖。
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import crypto from 'node:crypto';
import http from 'node:http';
import net from 'node:net';
import { notifyTopmost } from './notify.mjs';
import { sleep } from './refresh-lock.mjs';

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
// 登录页识别（命中则弹「请接管浏览器」置顶提示）。
// 除显式 login/signin 路径外，必须覆盖 SPA 的「首页重定向登录」形态：
//   https://wendang.jomoo.com/anyshare/zh-cn?redirect=%2Fzh-cn%2Fhomepage
// 该形态不含 login 字样，曾导致登录页无人介入、静默等满 180s 超时（2026-11-07 实测）。
const DEFAULT_LOGIN_PAGE_RE = /oauth2\/(login|auth)|\/login|\/signin|[?&]redirect=/i;
const DEFAULT_COOKIE_TOKEN_RE = /(?:^|;\s*)Authorization=Bearer\s+([^;\s]+)/;

function findEdgeExe() {
  for (const candidate of [
    join(process.env['ProgramFiles(x86)'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    join(process.env['ProgramFiles'] || '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  ]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/** CDP 的 JSON HTTP 调用（新版 Chrome/Edge 的 /json/new 只接受 PUT） */
function httpJson(url, { method = 'GET', timeoutMs = 3000 } = {}) {
  return new Promise((resolve, reject) => {
    const handler = (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (error) { reject(error); }
      });
    };
    const request = method === 'GET'
      ? http.get(url, { timeout: timeoutMs }, handler)
      : http.request(url, { method, timeout: timeoutMs }, handler);
    request.on('timeout', () => { request.destroy(new Error('CDP 请求超时')); });
    request.on('error', reject);
    if (method !== 'GET') request.end();
  });
}

const httpGetJson = (url, timeoutMs = 3000) => httpJson(url, { timeoutMs });
const httpPutJson = (url, timeoutMs = 3000) => httpJson(url, { method: 'PUT', timeoutMs });

// 同一 profile 同一时刻只可能有一个浏览器实例持有调试端口：把实际端口记在 profile 目录里，
// 后续调用（含其他 CLI 配了不同 cdpPort）先挂到这个端口，避免「每次调用都 spawn 一个新窗口」。
function cdpPortRecordPath(profileDir) {
  return join(profileDir, '.cdp-port.json');
}

function readRecordedPort(profileDir) {
  try {
    const record = JSON.parse(readFileSync(cdpPortRecordPath(profileDir), 'utf8'));
    return Number.isInteger(record.port) ? record.port : null;
  } catch {
    return null;
  }
}

function recordPort(profileDir, port) {
  try {
    writeFileSync(cdpPortRecordPath(profileDir), JSON.stringify({
      port, pid: process.pid, updatedAt: new Date().toISOString(),
    }), 'utf8');
  } catch {
    // 记录失败不影响主流程
  }
}

function clearRecordedPort(profileDir) {
  try { writeFileSync(cdpPortRecordPath(profileDir), '{}', 'utf8'); } catch { /* 忽略 */ }
}

/** 探活并返回 /json/version 内容（顺带拿到浏览器级 WebSocket 地址），不可用返回 null */
async function probeCdp(port, timeoutMs = 800) {
  if (!port) return null;
  try {
    const version = await httpGetJson(`http://127.0.0.1:${port}/json/version`, timeoutMs);
    return version && typeof version === 'object' ? version : null;
  } catch {
    return null;
  }
}

async function isCdpReady(port, timeoutMs = 800) {
  return Boolean(await probeCdp(port, timeoutMs));
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port, '127.0.0.1');
  });
}

/** 首选端口被别的程序占用（实测 9223 被 IDE 占了）时顺延找空闲端口，最多试 40 个 */
async function pickFreePort(preferred) {
  if (await isPortFree(preferred)) return preferred;
  for (let port = preferred + 1; port < preferred + 40; port++) {
    if (await isPortFree(port)) return port;
  }
  return null;
}

// ---------- 最小 WebSocket 客户端（仅满足 CDP evaluate 单收发） ----------

function wsConnect(url, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const { hostname, port, pathname, search } = new URL(url);
    const key = crypto.randomBytes(16).toString('base64');
    const request = http.get({
      hostname, port, path: pathname + search,
      headers: {
        Connection: 'Upgrade',
        Upgrade: 'websocket',
        'Sec-WebSocket-Key': key,
        'Sec-WebSocket-Version': '13',
      },
      timeout: timeoutMs,
    });
    const fail = (error) => { request.destroy(); reject(error); };
    request.on('upgrade', (res, socket) => {
      const expected = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
      if (res.headers['sec-websocket-accept'] !== expected) {
        fail(new Error('WebSocket 握手校验失败'));
        return;
      }
      resolve(socket);
    });
    request.on('timeout', () => fail(new Error('WebSocket 握手超时')));
    request.on('error', fail);
  });
}

function wsSend(socket, text) {
  const payload = Buffer.from(text, 'utf8');
  const mask = crypto.randomBytes(4);
  const masked = Buffer.from(payload);
  for (let i = 0; i < masked.length; i++) masked[i] ^= mask[i % 4];
  let header;
  if (payload.length < 126) {
    header = Buffer.from([0x81, 0x80 | payload.length]);
  } else if (payload.length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81; header[1] = 0x80 | 126;
    header.writeUInt16BE(payload.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81; header[1] = 0x80 | 127;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
  }
  socket.write(Buffer.concat([header, mask, masked]));
}

function wsRecv(socket, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('WebSocket 响应超时')), timeoutMs);
    let buffer = Buffer.alloc(0);
    const onData = (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (buffer.length < 2) return;
      let offset = 2;
      const length0 = buffer[1] & 0x7f;
      let payloadLength = length0;
      if (length0 === 126) {
        if (buffer.length < 4) return;
        payloadLength = buffer.readUInt16BE(2); offset = 4;
      } else if (length0 === 127) {
        if (buffer.length < 10) return;
        payloadLength = Number(buffer.readBigUInt64BE(2)); offset = 10;
      }
      if (buffer.length < offset + payloadLength) return;
      clearTimeout(timer);
      socket.off('data', onData);
      const opcode = buffer[0] & 0x0f;
      const payload = buffer.subarray(offset, offset + payloadLength);
      if (opcode === 0x8) { reject(new Error('WebSocket 已关闭')); return; }
      if (opcode === 0x9) { // ping → pong
        wsSend(socket, ''); // 保持连接（CDP 不要求严格 pong，静默容错）
        resolve('');
        return;
      }
      resolve(payload.toString('utf8'));
    };
    socket.on('data', onData);
    socket.on('error', (error) => { clearTimeout(timer); socket.off('data', onData); reject(error); });
  });
}

async function evaluateCookie(wsUrl) {
  const socket = await wsConnect(wsUrl);
  try {
    wsSend(socket, JSON.stringify({
      id: 1,
      method: 'Runtime.evaluate',
      params: { expression: 'document.cookie', returnByValue: true },
    }));
    for (;;) {
      const reply = JSON.parse(await wsRecv(socket));
      if (reply.id !== 1) continue;
      const value = reply.result && reply.result.result && reply.result.result.value;
      return typeof value === 'string' ? value : '';
    }
  } finally {
    socket.destroy();
  }
}

/** 长连接帧解析（服务端帧无 mask，支持分片/控制帧） */
function createFrameReader(onText) {
  let buffer = Buffer.alloc(0);
  let fragments = [];
  const flush = () => {
    const text = Buffer.concat(fragments).toString('utf8');
    fragments = [];
    if (text) onText(text);
  };
  return (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    for (;;) {
      if (buffer.length < 2) return;
      const fin = (buffer[0] & 0x80) !== 0;
      const opcode = buffer[0] & 0x0f;
      const length0 = buffer[1] & 0x7f;
      let offset = 2;
      let payloadLength = length0;
      if (length0 === 126) {
        if (buffer.length < 4) return;
        payloadLength = buffer.readUInt16BE(2); offset = 4;
      } else if (length0 === 127) {
        if (buffer.length < 10) return;
        payloadLength = Number(buffer.readBigUInt64BE(2)); offset = 10;
      }
      const masked = (buffer[1] & 0x80) !== 0;
      const need = offset + (masked ? 4 : 0) + payloadLength;
      if (buffer.length < need) return;
      const mask = masked ? buffer.subarray(offset, offset + 4) : null;
      const start = offset + (masked ? 4 : 0);
      const payload = Buffer.from(buffer.subarray(start, start + payloadLength));
      if (mask) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i % 4];
      buffer = buffer.subarray(need);
      if (opcode === 0x8) return; // close
      if (opcode === 0x9 || opcode === 0xa) continue; // ping/pong
      if (opcode === 0x0) {
        fragments.push(payload);
        if (fin) flush();
        continue;
      }
      fragments = [payload];
      if (fin) flush();
    }
  };
}

/**
 * 订阅浏览器级目标事件（登录成功的瞬间就能感知，而不是等下一轮轮询）：
 * Target.setDiscoverTargets 会对所有标签页推送 targetCreated / targetInfoChanged，
 * 登录回跳导致的 URL 变化、SSO 新开标签页都会立即触发回调。
 * 返回 { close } ；不支持浏览器级 CDP 时返回 null（调用方退回轮询）。
 */
async function watchTargetEvents(cdpBase, onEvent, version = null) {
  // 复用调用方已经拿到的 /json/version，避免重复探测
  const info = version || await probeCdp(Number(new URL(cdpBase).port), 2000);
  const wsUrl = info && info.webSocketDebuggerUrl;
  if (!wsUrl) return null;
  let socket;
  try {
    socket = await wsConnect(wsUrl);
  } catch {
    return null;
  }
  socket.on('error', () => { /* 连接断开时靠轮询兜底 */ });
  socket.on('data', createFrameReader((text) => {
    let message;
    try { message = JSON.parse(text); } catch { return; }
    if (!message.method) return; // 命令响应，忽略
    if (message.method.startsWith('Target.')) {
      try { onEvent(message); } catch { /* 回调失败不影响监听 */ }
    }
  }));
  wsSend(socket, JSON.stringify({ id: 1, method: 'Target.setDiscoverTargets', params: { discover: true } }));
  return {
    close: () => { try { socket.destroy(); } catch { /* 已关闭 */ } },
    /** 通过 CDP 优雅关闭整个浏览器（本进程拉起的才有权关） */
    closeBrowser(timeoutMs = 1500) {
      return new Promise((resolve) => {
        let settled = false;
        const finish = (ok) => { if (!settled) { settled = true; resolve(ok); } };
        socket.once('close', () => finish(true));
        try {
          wsSend(socket, JSON.stringify({ id: 99, method: 'Browser.close' }));
        } catch {
          finish(false);
          return;
        }
        setTimeout(() => finish(false), timeoutMs);
      });
    },
  };
}

// ---------- 主流程 ----------

function killEdgeTree(child) {
  try {
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
      .on('error', () => { /* taskkill 缺失/已被清理时忽略 */ });
  } catch { /* 进程可能已退出 */ }
}

/**
 * 按调试端口反查浏览器主进程并结束它。
 * Edge 启动器常把浏览器交给新进程后自己退出，spawn 拿到的 pid 早就不在了，
 * 所以「按壳进程 pid 杀」会留下整棵浏览器进程（2026-11-07 实测）。
 * 只在该端口确实归 msedge.exe 时才动手，避免误杀后来占用端口的其他程序。
 */
function killPortOwner(port) {
  try {
    const netstat = execFileSync('netstat', ['-ano'], { encoding: 'utf8' });
    const pattern = new RegExp(`:${port}\\s`);
    const line = netstat.split(/\r?\n/).find((item) => pattern.test(item) && /LISTENING/i.test(item));
    if (!line) return false;
    const pid = Number(line.trim().split(/\s+/).pop());
    if (!Number.isInteger(pid) || pid <= 0) return false;
    const tasklist = execFileSync('tasklist', ['/FI', `PID eq ${pid}`, '/NH'], { encoding: 'utf8' });
    if (!/msedge\.exe/i.test(tasklist)) return false;
    spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' })
      .on('error', () => { /* 忽略 */ });
    return true;
  } catch {
    return false;
  }
}

/**
 * CDP 静默回路主入口。
 * @param options {baseUrl, launchUrl, cookieTokenRe?, loginPageRe?, cdpPort?, validateToken, maxWaitMs?}
 * @returns token 或 null（超时/启动失败）
 */
export async function captureTokenByCdp(options) {
  const {
    baseUrl, launchUrl, validateToken,
    profileDir = join(homedir(), '.jomoo-auth-cli', 'edge-sso-profile'),
    cookieTokenRe = DEFAULT_COOKIE_TOKEN_RE,
    loginPageRe = DEFAULT_LOGIN_PAGE_RE,
    cdpPort = 9223,
    maxWaitMs = 180_000,
    // 检测到登录页（需要人工介入）后额外等待的时长
    manualLoginWaitMs = 600_000,
    // 首次检测到登录页时回调（上层据此不写失败冷却、提示用户接管）
    onManualLoginRequired = null,
    // 置顶提示通道（可注入，测试/无桌面环境时替换）
    notify = notifyTopmost,
  } = options;
  // 持久化专用 profile：登录一次后会话留存，后续静默换发零交互
  mkdirSync(profileDir, { recursive: true });

  // 先探活：本 profile 的专用 Edge 还开着就直接挂上去轮询，绝不再 spawn。
  // 同 profile 再启动时 Edge 会把命令行转交给已有实例并立刻退出——结果是每次调用多一个窗口，
  // 而 finally 里 kill 的只是那个早已退出的壳进程，窗口全留着（2026-11-07 实测）。
  let port = cdpPort;
  let cdpVersion = await probeCdp(port); // 探活结果复用，避免同一端口反复请求
  if (!cdpVersion) {
    const recorded = readRecordedPort(profileDir);
    if (recorded && recorded !== port) {
      const recordedVersion = await probeCdp(recorded);
      if (recordedVersion) { port = recorded; cdpVersion = recordedVersion; }
    }
  }

  let child = null;
  if (!cdpVersion) {
    const edge = findEdgeExe();
    if (!edge) return null;
    // 端口要么被别的程序占着（Edge 起不来调试口，调用方只会白等），要么空闲：
    // 统一在启动前确认可用，被占用就顺延，避免「每次重试都开一个连不上的窗口」
    const freePort = await pickFreePort(port);
    if (!freePort) return null;
    port = freePort;
    child = spawn(edge, [
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profileDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--new-window',
      launchUrl,
    ], { stdio: 'ignore', detached: true });
    child.on('error', () => { /* 启动失败由下面的就绪等待兜底，别抛未捕获异常 */ });
    child.unref();
    recordPort(profileDir, port);
  }
  const cdpBase = `http://127.0.0.1:${port}`;

  const startedAt = Date.now();
  let deadline = startedAt + maxWaitMs;
  let lastTabAttemptAt = 0;
  let manualLoginSeen = false;
  let capturedToken = null;
  let watcher = null;
  try {
    // 等 CDP 端口就绪（最多 15 秒）
    let ready = false;
    for (let i = 0; i < 30 && Date.now() < deadline; i++) {
      if (cdpVersion || await isCdpReady(port, 1000)) { ready = true; break; }
      await sleep(500);
    }
    if (!ready) {
      // 端口始终没起来：清掉记录，避免下次调用反复挂到一个死端口
      if (readRecordedPort(profileDir) === port) clearRecordedPort(profileDir);
      return null;
    }
    if (!cdpVersion) cdpVersion = await probeCdp(port, 2000);

    // 事件驱动：登录回跳/新标签页的瞬间立即检查，不再干等轮询周期
    let eventPending = true;
    watcher = await watchTargetEvents(cdpBase, () => { eventPending = true; }, cdpVersion);
    let lastScanAt = 0;
    const fallbackPollMs = 5000; // 事件通道不可用或漏事件时的兜底
    const minEventScanMs = 1000; // 事件可能密集推送，扫描限流防止空转

    while (Date.now() < deadline) {
      const eventDue = eventPending && Date.now() - lastScanAt >= minEventScanMs;
      const pollDue = Date.now() - lastScanAt >= fallbackPollMs;
      if (eventDue || pollDue) {
        eventPending = false;
        lastScanAt = Date.now();
        const scan = await scanTargets({ cdpBase, baseUrl, cookieTokenRe, loginPageRe, validateToken });
        if (scan.token) { capturedToken = scan.token; break; }
        if (scan.sawLoginPage && !manualLoginSeen) {
          manualLoginSeen = true;
          // 需要人工介入：延长等待，给用户留出登录时间
          deadline = Math.max(deadline, Date.now() + manualLoginWaitMs);
          if (typeof onManualLoginRequired === 'function') {
            try { onManualLoginRequired(); } catch { /* 回调失败不影响主流程 */ }
          }
          // 每次刷新只提示一次：登录期间反复弹框会盖住用户正在操作的页面
          notify(`请在弹出的 Edge 窗口中完成 ${baseUrl} 的登录，登录后 token 将自动捕获。`);
        }
        // 复用已有浏览器但没有目标页（例如只开了别的站点）：在同一个窗口里开一个标签页，
        // 而不是再 spawn 一个窗口；失败允许稍后重试，不在整轮里只试一次
        if (!scan.matchedPage && !child && Date.now() - startedAt > 5000 && Date.now() - lastTabAttemptAt > 5000) {
          lastTabAttemptAt = Date.now();
          try { await httpPutJson(`${cdpBase}/json/new?${encodeURIComponent(launchUrl)}`); } catch { /* 无标签页时继续等同页打开 */ }
        }
      }
      await sleep(250);
    }
    return capturedToken;
  } finally {
    // 只有「本进程拉起的浏览器」才由本进程负责关闭：
    //   - 捕获成功 → 关闭（收尾）
    //   - 超时且从未出现登录页（静默失效场景）→ 关闭
    //   - 出现过登录页但用户还没登完 → 保留窗口，别再关掉用户正在操作的登录页
    if (child && !(manualLoginSeen && !capturedToken)) {
      let closed = false;
      if (watcher) {
        try { closed = await watcher.closeBrowser(); } catch { closed = false; }
      }
      if (!closed) killPortOwner(port); // 壳进程 pid 可能早已失效，按调试端口找真正的浏览器主进程
      killEdgeTree(child);
    }
    if (watcher) watcher.close();
    // 持久化 profile 保留（会话留存），仅关闭浏览器进程
  }
}

/**
 * 扫一遍目标页：读 cookie → 校验 → 返回 token；同时报告是否见到登录页/目标页。
 * 判定顺序固定为「先 cookie 后 URL」：登录完成后 SPA 可能仍停在 `?redirect=` 形态。
 */
async function scanTargets({ cdpBase, baseUrl, cookieTokenRe, loginPageRe, validateToken }) {
  let targets = [];
  try { targets = await httpGetJson(`${cdpBase}/json/list`); } catch { targets = []; }
  let matchedPage = false;
  let sawLoginPage = false;
  for (const target of targets) {
    if (target.type !== 'page') continue;
    const href = target.url || '';
    // 登录页判定必须放在同源过滤之前：跨域 SSO 登录页（如 ucenter 域）不在 baseUrl 下，
    // 旧顺序会漏判 → 不提示、不延长等待，用户不知情地等满超时（2026-11-07 评审发现）
    if (loginPageRe.test(href)) sawLoginPage = true;
    if (href !== baseUrl && !href.startsWith(baseUrl + '/')) continue;
    matchedPage = true;
    let cookie = '';
    try { cookie = await evaluateCookie(target.webSocketDebuggerUrl); } catch { continue; }
    const match = cookie.match(cookieTokenRe);
    const candidate = match ? match[1] : null;
    if (candidate && await validateToken(candidate)) return { token: candidate, matchedPage, sawLoginPage };
  }
  return { token: null, matchedPage, sawLoginPage };
}
