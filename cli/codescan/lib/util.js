'use strict';
const { exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const os = require('os');
const fs = require('fs');

const execAsync = promisify(exec);

const NOT_FOUND_RE = /is not recognized as an internal or external command|command not found|不是内部或外部命令|无法将.*识别为/i;

/**
 * 判断 stderr 是否是"命令不存在"。
 * 中文 Windows 的 cmd 输出是 GBK,被按 utf8 解码会变成 � 乱码,
 * 此时靠"乱码 + 命令名"兜底识别。
 */
function looksLikeMissingCommand(stderr, cmd) {
  if (!stderr) return false;
  if (NOT_FOUND_RE.test(stderr)) return true;
  const first = (cmd.match(/^\s*("[^"]+"|\S+)/) || [])[1] || '';
  const token = first.replace(/^"|"$/g, '');
  if (!token) return false;
  return stderr.includes('�') && stderr.includes(token);
}

/**
 * 统一执行外部命令。
 *
 * 语义约定:
 * - 工具"发现问题"时通常返回非零退出码,输出仍然有效 → ok:true + code
 * - 命令根本没能启动 / 超时 / 输出溢出 → ok:false(调用方必须据此报 error,不能当成"没问题")
 * - 命令不存在:Unix 是 ENOENT,Windows cmd 是退出码 1/9009 + "not recognized"
 */
async function sh(cmd, opts = {}) {
  const { cwd, timeoutMs = 300000, maxBuffer = 50 * 1024 * 1024 } = opts;
  try {
    const { stdout, stderr } = await execAsync(cmd, {
      cwd,
      timeout: timeoutMs,
      maxBuffer,
      encoding: 'utf8',
      windowsHide: true,
    });
    return { ok: true, code: 0, stdout: stdout || '', stderr: stderr || '' };
  } catch (e) {
    const stdout = e.stdout || '';
    const stderr = e.stderr || '';

    if (e.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
      return {
        ok: false, code: -1, stdout, stderr,
        error: `输出超过 maxBuffer(${maxBuffer} bytes)`,
        spawnError: true,
      };
    }
    if (e.code === 'ENOENT' || e.code === 'EACCES' || e.code === 'EINVAL') {
      return { ok: false, code: -1, stdout, stderr, error: e.message, spawnError: true };
    }
    // Windows cmd.exe 对不存在的命令不抛 ENOENT,而是退出码 1/9009 + 固定提示
    if (looksLikeMissingCommand(stderr, cmd)) {
      return { ok: false, code: -1, stdout, stderr, error: '命令不存在: ' + cmd.split(/\s+/)[0], spawnError: true };
    }
    if (e.killed || e.signal === 'SIGTERM' || e.signal === 'SIGKILL') {
      return {
        ok: false, code: -1, stdout,
        stderr: stderr || `timeout after ${timeoutMs}ms`,
        timeout: true, error: `timeout after ${timeoutMs}ms`,
      };
    }
    // exec 的错误对象把退出码放在 code(数字),execSync 放在 status
    const exitCode = typeof e.status === 'number'
      ? e.status
      : (typeof e.code === 'number' ? e.code : null);
    if (exitCode === null || (process.platform === 'win32' && exitCode === 9009)) {
      return { ok: false, code: -1, stdout, stderr, error: e.message, spawnError: true };
    }
    // 非零退出码:很多工具(eslint/pmd/knip)发现问题时退出非零,输出仍有效
    return { ok: true, code: exitCode, stdout, stderr };
  }
}

/** 比较用的规范 key:绝对路径 + 正斜杠 + 小写(Windows 大小写不敏感) */
function normKey(p) {
  return path.resolve(p).replace(/\\/g, '/').toLowerCase();
}

/** 展示用路径:正斜杠 */
function disp(p) {
  return path.resolve(p).replace(/\\/g, '/');
}

function mkTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'codescan-'));
}

/** 判断 absPath 是否位于 target(文件或目录)范围内 */
function inScope(targetKey, absPath) {
  const k = normKey(absPath);
  if (targetKey === k) return true;
  return k.startsWith(targetKey.endsWith('/') ? targetKey : targetKey + '/');
}

/**
 * 从可能混有前置日志的 stdout 中提取 JSON。
 * 一些工具在 JSON 前面打印配置加载日志(如 knip + vue.config.js)。
 */
function extractJson(s) {
  const text = String(s || '').trim();
  if (!text) return null;
  const obj = text.indexOf('{');
  const arr = text.indexOf('[');
  let start = -1;
  if (obj === -1) start = arr;
  else if (arr === -1) start = obj;
  else start = Math.min(obj, arr);
  if (start === -1) return null;
  try { return JSON.parse(text.slice(start)); } catch { /* 继续尝试裁剪尾部 */ }
  const end = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
  if (end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch { /* ignore */ }
  }
  return null;
}

/** 从冗长的 stderr 中挑出有意义的错误行 */
function summarizeError(text, max = 300) {
  const raw = String(text || '');
  const lines = raw.split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !/^npm (info|verbose|http|notice|warn)\b/i.test(l))
    .filter((l) => /error|cannot|failed|not found|invalid|exception|错误|失败/i.test(l));
  const picked = lines.slice(-3).join(' | ');
  return (picked || raw.trim()).slice(0, max);
}

/** 限制并发地执行任务,保持结果顺序 */
async function pool(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const size = Math.max(1, Math.min(limit || 1, items.length || 1));
  await Promise.all(Array.from({ length: size }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }));
  return results;
}

module.exports = { sh, normKey, disp, mkTmpDir, inScope, pool, extractJson, summarizeError };