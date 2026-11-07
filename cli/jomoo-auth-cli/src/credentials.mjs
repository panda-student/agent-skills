// 执行层：SSO 凭据安全录入与存取。
// 凭据经 WinForms 弹窗一次性录入（明文不进终端/对话），落盘 ~/.<appName>/sso-credentials.json。
// 弹窗用 PowerShell 编码命令执行，绕开引号转义问题（实测坑位）。
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { spawnSync } from 'node:child_process';

const DIALOG_ENCODINGS = { encoding: 'utf8' };

function credentialsFilePath(appName) {
  return join(homedir(), '.' + appName, 'sso-credentials.json');
}

export { credentialsFilePath };

/** 读取已保存凭据 {account, password}；无文件或结构不完整返回 null */
export function loadCredentials(appName) {
  const path = credentialsFilePath(appName);
  if (!existsSync(path)) return null;
  try {
    const cred = JSON.parse(readFileSync(path, 'utf8'));
    if (cred && cred.account && cred.password) return cred;
    return null;
  } catch {
    return null;
  }
}

/** 保存凭据文件（目录自动创建） */
export function saveCredentials(appName, cred) {
  const path = credentialsFilePath(appName);
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, JSON.stringify(cred, null, 2), 'utf8');
}

// WinForms 录入窗体脚本：账号框 + 密码框（掩码），OK 输出 JSON 到 stdout，取消输出 {}
const DIALOG_SCRIPT = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$form = New-Object System.Windows.Forms.Form
$form.Text = $args[0]
$form.Size = New-Object System.Drawing.Size(420, 200)
$form.FormBorderStyle = 'FixedDialog'
$form.StartPosition = 'CenterScreen'
$form.TopMost = $true
$form.MaximizeBox = $false
$labelAccount = New-Object System.Windows.Forms.Label
$labelAccount.Text = '账号：'
$labelAccount.Location = New-Object System.Drawing.Point(20, 22)
$labelAccount.AutoSize = $true
$inputAccount = New-Object System.Windows.Forms.TextBox
$inputAccount.Location = New-Object System.Drawing.Point(80, 18)
$inputAccount.Width = 300
$labelPassword = New-Object System.Windows.Forms.Label
$labelPassword.Text = '密码：'
$labelPassword.Location = New-Object System.Drawing.Point(20, 62)
$labelPassword.AutoSize = $true
$inputPassword = New-Object System.Windows.Forms.TextBox
$inputPassword.Location = New-Object System.Drawing.Point(80, 58)
$inputPassword.Width = 300
$inputPassword.UseSystemPasswordChar = $true
$buttonOk = New-Object System.Windows.Forms.Button
$buttonOk.Text = '确定'
$buttonOk.Location = New-Object System.Drawing.Point(220, 110)
$buttonOk.Width = 75
$buttonOk.DialogResult = [System.Windows.Forms.DialogResult]::OK
$form.AcceptButton = $buttonOk
$buttonCancel = New-Object System.Windows.Forms.Button
$buttonCancel.Text = '取消'
$buttonCancel.Location = New-Object System.Drawing.Point(305, 110)
$buttonCancel.Width = 75
$buttonCancel.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
$form.CancelButton = $buttonCancel
$form.Controls.AddRange(@($labelAccount, $inputAccount, $labelPassword, $inputPassword, $buttonOk, $buttonCancel))
$form.ActiveControl = $inputAccount
$result = $form.ShowDialog()
if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
  @{ account = $inputAccount.Text; password = $inputPassword.Text } | ConvertTo-Json -Compress
} else {
  '{}'
}
`;

function pickPowerShell() {
  const pwsh = join(process.env.LOCALAPPDATA || '', 'Programs', 'PowerShell', '7', 'pwsh.exe');
  if (existsSync(pwsh)) return pwsh;
  return join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
}

/** 弹窗录入并保存凭据。返回 {account, password}；用户取消抛错 */
export function promptAndSaveCredentials(appName, { windowTitle } = {}) {
  const script = DIALOG_SCRIPT;
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  const result = spawnSync(
    pickPowerShell(),
    ['-NoProfile', '-EncodedCommand', encoded, windowTitle || `${appName} 凭据录入`],
    DIALOG_ENCODINGS,
  );
  if (result.error) throw new Error(`凭据录入弹窗启动失败: ${result.error.message}`);
  let parsed = {};
  try {
    parsed = JSON.parse(result.stdout.trim() || '{}');
  } catch {
    throw new Error('凭据录入弹窗输出无法解析');
  }
  if (!parsed.account || !parsed.password) throw new Error('凭据录入已取消或未填写完整');
  saveCredentials(appName, parsed);
  return parsed;
}
