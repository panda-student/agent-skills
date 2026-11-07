// 执行层：专用 Profile Edge + CDP 静默回路（主通道）。
// 以独立 user-data-dir 唤起 Edge 打开系统首页：会话有效时 SPA 自行走静默 SSO 换发，
// 轮询 CDP 抓 document.cookie 中的 token；落到登录页则弹置顶提示等用户登录一次。
// CDP 通道自实现最小 WebSocket 客户端（握手 + 文本帧收发），零第三方依赖。
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import crypto from 'node:crypto';
import http from 'node:http';
import { notifyTopmost } from './notify.mjs';

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const DEFAULT_LOGIN_PAGE_RE = /oauth2\/(login|auth)|\/login|\/signin/;
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

function httpGetJson(url, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, { timeout: timeoutMs }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (error) { reject(error); }
      });
    });
    request.on('timeout', () => { request.destroy(new Error('CDP 请求超时')); });
    request.on('error', reject);
  });
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

// ---------- 主流程 ----------

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function killEdgeTree(child) {
  try {
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } catch { /* 进程可能已退出 */ }
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
  } = options;
  const edge = findEdgeExe();
  if (!edge) return null;

  // 持久化专用 profile：登录一次后会话留存，后续静默换发零交互
  mkdirSync(profileDir, { recursive: true });
  const child = spawn(edge, [
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--new-window',
    launchUrl,
  ], { stdio: 'ignore', detached: true });
  child.unref();

  const cdpBase = `http://127.0.0.1:${cdpPort}`;
  const deadline = Date.now() + maxWaitMs;
  try {
    // 等 CDP 端口就绪（最多 15 秒）
    let ready = false;
    for (let i = 0; i < 30 && Date.now() < deadline; i++) {
      try { await httpGetJson(`${cdpBase}/json/version`); ready = true; break; }
      catch { await sleep(500); }
    }
    if (!ready) return null;

    while (Date.now() < deadline) {
      let targets = [];
      try { targets = await httpGetJson(`${cdpBase}/json/list`); } catch { targets = []; }
      for (const target of targets) {
        const href = target.url || '';
        if (target.type !== 'page' || !href.startsWith(baseUrl + '/') && href !== baseUrl) continue;
        if (loginPageRe.test(href)) {
          notifyTopmost(`请在弹出的 Edge 窗口中完成 ${baseUrl} 的登录，登录后 token 将自动捕获。`);
          continue;
        }
        let cookie = '';
        try { cookie = await evaluateCookie(target.webSocketDebuggerUrl); }
        catch { continue; }
        const match = cookie.match(cookieTokenRe);
        const candidate = match ? match[1] : null;
        if (candidate && await validateToken(candidate)) return candidate;
      }
      await sleep(1500);
    }
    return null;
  } finally {
    killEdgeTree(child);
    // 持久化 profile 保留（会话留存），仅关闭浏览器进程
  }
}
