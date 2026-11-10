'use strict';
const { execSync } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

/** 统一执行外部命令;非零退出码不算失败(由调用方看输出),超时/无法启动才算 */
function sh(cmd, opts = {}) {
  const { cwd, timeoutMs = 300000, maxBuffer = 50 * 1024 * 1024 } = opts;
  try {
    const stdout = execSync(cmd, {
      cwd,
      timeout: timeoutMs,
      maxBuffer,
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { ok: true, code: 0, stdout: stdout || '', stderr: '' };
  } catch (e) {
    if (e.killed || (e.signal && !e.code)) {
      return { ok: false, code: -1, stdout: e.stdout || '', stderr: `timeout after ${timeoutMs}ms`, timeout: true };
    }
    // 非零退出码:很多工具(eslint/pmd/knip)发现问题时退出非零,输出仍有效
    return { ok: true, code: e.status, stdout: e.stdout || '', stderr: e.stderr || '' };
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

module.exports = { sh, normKey, disp, mkTmpDir, inScope };
