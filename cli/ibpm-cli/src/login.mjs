// 登录流程：打开浏览器 SSO 登录 → 本地 catch 服务接收控制台脚本回传的 Bearer token → 落配置
// 原理：宏天 Bearer token 存于页面 sessionStorage.currentUser.token（Cookie 拿不到，实测 401），
//       登录后在 IBPM 标签页执行一句导航脚本，token 经 GET 参数回传到本机 catch 服务。
// 体验：终端输出可能被折叠，等待回传期间弹置顶指引窗（回传命令已自动复制剪贴板）；
//       回传成功清除超时 timer（否则 Node 进程挂 timer 满 180s 才退出）并自动关闭指引窗。
import { createServer } from 'node:http';
import { exec, spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { saveEnvToken, parseJwt, ENV_PRESETS } from './config.mjs';

const TIMEOUT_MS = 180_000;

function openBrowser(url) {
  const cmd = process.platform === 'win32' ? `start "" "${url}"`
    : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd);
}

// ---------- 置顶指引窗（独立 PowerShell WinForms 进程，非阻塞） ----------
// 通信：guide.pid（弹窗进程 PID）/ guide.done（回传成功标记，弹窗轮询到即自动关闭）
function guideDir() {
  return join(tmpdir(), 'ibpm-login-guide');
}

function openGuideWindow(loginUrl, snippet) {
  if (process.platform !== 'win32') return null;
  const dir = guideDir();
  const snippetFile = join(dir, 'snippet.txt');
  const urlFile = join(dir, 'url.txt');
  const pidFile = join(dir, 'guide.pid');
  const doneFile = join(dir, 'guide.done');
  const ps1File = join(dir, 'guide.ps1');
  try {
    writeFileSync(snippetFile, snippet, 'utf8');
    writeFileSync(urlFile, loginUrl, 'utf8');
    // BOM 前缀：WinPS 5.1 读无 BOM 的 UTF8 中文会乱码
    writeFileSync(ps1File, '\ufeff' + [
      "Add-Type -AssemblyName System.Windows.Forms",
      "Add-Type -AssemblyName System.Drawing",
      "$dir = '" + dir.replace(/'/g, "''") + "'",
      "$snippetFile = Join-Path $dir 'snippet.txt'",
      "$pidFile     = Join-Path $dir 'guide.pid'",
      "$doneFile    = Join-Path $dir 'guide.done'",
      "$snippet = Get-Content -Raw $snippetFile",
      "$snippet = $snippet.TrimEnd()`r`n",
      "Set-Clipboard -Value $snippet",
      "$PID | Set-Content $pidFile",
      "",
      "$f = New-Object System.Windows.Forms.Form",
      "$f.Text = 'IBPM 登录指引'",
      "$f.TopMost = $true",
      "$f.StartPosition = 'CenterScreen'",
      "$f.FormBorderStyle = 'FixedDialog'",
      "$f.MaximizeBox = $false",
      "$f.Size = New-Object System.Drawing.Size(780, 400)",
      "",
      "function Add-Label($text, $x, $y, $w, $h, $bold) {",
      "  $l = New-Object System.Windows.Forms.Label",
      "  $l.Text = $text",
      "  $l.Location = New-Object System.Drawing.Point($x, $y)",
      "  $l.Size = New-Object System.Drawing.Size($w, $h)",
      "  if ($bold) { $l.Font = New-Object System.Drawing.Font('Microsoft YaHei', 9, [System.Drawing.FontStyle]::Bold) }",
      "  $f.Controls.Add($l)",
      "}",
      "",
      "Add-Label '① 在刚打开的浏览器中完成 SSO 登录' 20 15 720 22 $true",
      "Add-Label ('登录页: ' + (Get-Content -Raw (Join-Path $dir 'url.txt'))) 38 40 700 20 $false",
      "Add-Label '② 回传命令已自动复制到剪贴板 —— 登录后在 IBPM 标签页按 F12 打开控制台，Ctrl+V 回车执行' 20 70 740 22 $true",
      "",
      "$tb = New-Object System.Windows.Forms.TextBox",
      "$tb.Multiline = $true",
      "$tb.ReadOnly = $true",
      "$tb.ScrollBars = 'Vertical'",
      "$tb.Font = New-Object System.Drawing.Font('Consolas', 10)",
      "$tb.Location = New-Object System.Drawing.Point(38, 98)",
      "$tb.Size = New-Object System.Drawing.Size(690, 56)",
      "$tb.Text = $snippet",
      "$f.Controls.Add($tb)",
      "",
      "Add-Label '③ 页面提示「登录成功」后本窗口自动关闭；终端命令自动完成配置' 20 168 720 22 $true",
      "Add-Label '若窗口未自动关闭（回传已成功），点下方按钮即可。' 38 192 700 20 $false",
      "",
      "$btn = New-Object System.Windows.Forms.Button",
      "$btn.Text = '我已完成，关闭'",
      "$btn.Location = New-Object System.Drawing.Point(38, 225)",
      "$btn.Size = New-Object System.Drawing.Size(150, 32)",
      "$btn.Add_Click({ $f.Close() })",
      "$f.Controls.Add($btn)",
      "",
      "$tip = New-Object System.Windows.Forms.Label",
      "$tip.Text = '（命令同时在下方文本框内，可手动选中复制）'",
      "$tip.ForeColor = [System.Drawing.Color]::Gray",
      "$tip.Location = New-Object System.Drawing.Point(200, 232)",
      "$tip.Size = New-Object System.Drawing.Size(520, 20)",
      "$f.Controls.Add($tip)",
      "",
      "$timer = New-Object System.Windows.Forms.Timer",
      "$timer.Interval = 500",
      "$script:ticks = 0",
      "$timer.Add_Tick({",
      "  $script:ticks++",
      "  if ((Test-Path $doneFile) -or ($script:ticks -gt 480)) { $timer.Stop(); $f.Close() }",
      "})",
      "$f.Add_Shown({ $f.Activate(); $timer.Start() })",
      "[void]$f.ShowDialog()",
      "$timer.Stop()",
      "if (Test-Path $pidFile) { Remove-Item $pidFile -ErrorAction SilentlyContinue }",
    ].join("\r\n"), 'utf8');
    // detached + unref：弹窗进程独立于 CLI 存活，CLI 回传成功后可立即退出
    spawn('powershell', ['-NoProfile', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass', '-File', ps1File],
      { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    return { doneFile, pidFile };
  } catch {
    return null;
  }
}

function closeGuideWindow(win) {
  if (!win) return;
  try {
    writeFileSync(win.doneFile, '1', 'utf8');
  } catch { /* 弹窗兜底自杀，不影响主流程 */ }
}

function cleanupGuideFiles() {
  // 超时/成功后延迟清理临时文件（留给弹窗读 pid 完成；简单起见只留 done，其余下次覆盖）
}

export async function login(envName = 'uat', opts = {}) {
  const preset = ENV_PRESETS[envName];
  if (!preset) throw new Error(`未知环境: ${envName}`);
  const loginUrl = preset.baseUrl + preset.loginPath;

  return new Promise((resolve, reject) => {
    let timer = null;
    const server = createServer((req, res) => {
      const u = new URL(req.url, 'http://127.0.0.1');
      const token = u.searchParams.get('t');
      if (!token) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<meta charset="utf-8"><h3>未收到 token，请回 IBPM 页面重试控制台脚本。</h3>');
        return;
      }
      const jwt = parseJwt(token);
      if (!jwt) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<meta charset="utf-8"><h3>token 格式非法，请确认复制的是 currentUser.token。</h3>');
        return;
      }
      saveEnvToken(envName, token);
      const exp = new Date(jwt.exp * 1000).toLocaleString('zh-CN');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<meta charset="utf-8"><h2>✓ ibpm-cli 登录成功</h2><p>用户: ${jwt.sub || '?'}，token 有效期至 ${exp}，已写入 ~/.ibpm-cli/config.json</p><p>可以关闭此页并回到终端。</p>`);
      console.log(`\n✓ 登录成功：用户 ${jwt.sub || '?'}，token 有效期至 ${exp}`);
      console.log(`  已写入 ~/.ibpm-cli/config.json（env: ${envName}）`);
      if (timer) clearTimeout(timer);   // 关键：清 timer，否则进程挂满 180s 才退出
      res.on('finish', () => { server.close(); resolve(token); });
    });

    server.listen(opts.port || 0, '127.0.0.1', () => {
      const port = server.address().port;
      const snippet = `location.href='http://127.0.0.1:${port}/?t='+JSON.parse(sessionStorage.currentUser).token`;
      console.log(`\n[ibpm login] 环境: ${envName}`);
      console.log(`  1. 已打开浏览器，请完成 SSO 登录: ${loginUrl}`);
      console.log(`  2. 登录后在同一标签页按 F12 打开控制台，粘贴执行下面这句（回传 token）：\n`);
      console.log(`     ${snippet}\n`);
      console.log(`  3. 页面提示"登录成功"即可，本命令自动完成配置。等待回传中...（180 秒超时）`);
      console.log(`  ✦ 已弹出置顶指引窗（回传命令已复制到剪贴板），按窗口提示操作即可。`);
      openBrowser(loginUrl);
      const guide = openGuideWindow(loginUrl, snippet);
      timer = setTimeout(() => {
        server.close();
        closeGuideWindow(guide);
        reject(new Error('等待 token 回传超时（180 秒），请重试 ibpm login'));
      }, TIMEOUT_MS);
    });
  });
}
