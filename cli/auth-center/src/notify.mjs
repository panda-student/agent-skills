// 执行层：置顶系统提示框（登录页检测时提醒用户接管浏览器，同一轮只弹一次）。
// PowerShell -EncodedCommand 传参，绕开引号转义（实测坑位）。
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

let lastMessageAt = new Map();

function pickPowerShell() {
  const pwsh = join(process.env.LOCALAPPDATA || '', 'Programs', 'PowerShell', '7', 'pwsh.exe');
  if (existsSync(pwsh)) return pwsh;
  return join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
}

/** 弹出置顶提示框。同一 message 60 秒内不重复弹；失败静默（提示只是辅助通道） */
export function notifyTopmost(message, { title = '需要人工介入' } = {}) {
  const now = Date.now();
  if (now - (lastMessageAt.get(message) || 0) < 60_000) return;
  lastMessageAt.set(message, now);
  try {
    const script = `
Add-Type -AssemblyName System.Windows.Forms
$form = New-Object System.Windows.Forms.Form
$form.TopMost = $true
[System.Windows.Forms.MessageBox]::Show($form, $args[0], $args[1], 'OK', 'Information')
`;
    const encoded = Buffer.from(script, 'utf16le').toString('base64');
    const child = spawn(pickPowerShell(), ['-NoProfile', '-EncodedCommand', encoded, message, title], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.unref();
  } catch {
    // 提示失败不影响主流程
  }
}
