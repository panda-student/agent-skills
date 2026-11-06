---
name: credential-secure-inject
description: "凭据安全注入：需要把密码/密钥/凭据写入本地配置文件、环境变量文件或 UI 输入框，且凭据不能明文经过 AI 对话上下文时使用。通过密码管理器 capture_fill_target + fill_credential 注入到聚焦的 UIA Edit 控件；目标控件不受支持（如 Win11 新版记事本、VS Code）时，用 PowerShell WinForms TextBox 作为注入目标中转回写目标文件。"
skill-version: V1.0.0
---

# 凭据安全注入

## 适用场景

当需要把凭据（密码/密钥/token）落到本地文件或输入框，且凭据不能明文出现在对话中时使用：

- 配置 `.env.local` / `config.json` 等本地凭据文件，凭据在密码管理器中而 AI 无法读取
- 需要「零明文外泄」地填充桌面应用输入框
- 用户明确要求凭据不进对话/仓库

## 核心机制

密码管理器提供两个 MCP 工具，凭据全程不经过 AI 上下文：

- **capture_fill_target**：捕获当前聚焦的「UI Automation Edit 控件」，返回一次性 `targetId`（30 秒有效）。不支持的目标返回 `unsupported_target`（fail-closed，不会降级泄露）
- **fill_credential**：向已捕获目标插入指定凭据字段（`account`/`secret` 等），插入位置为捕获时的光标处；`input_sent` 仅表示事件已发送

## 标准流程

**目标文件为空值占位**：把凭据行写成 `KEY=`（等号后为空、无换行），注入后值恰好接在等号后

**选择注入目标**（按优先级）：

- 目标应用本身是标准 Edit 控件（传统记事本、WinForms/WPF 输入框、浏览器页面 `<input>`）→ 直接聚焦后 capture + fill
- Win11 新版记事本、VS Code/Electron 编辑器等 → 返回 `unsupported_target`，走 WinForms 中转

**WinForms 中转方案**（实测有效）：

- 写临时 PowerShell 脚本（放 `%TEMP%`，用后删除）：创建 TopMost 窗体 + TextBox，预填 `KEY=`，`Shown` 事件中聚焦并把光标移到末尾，启动 Timer 轮询 `Text.Length` 增长
- `Start-Process powershell -STA -File <脚本>`（STA 必须，WinForms 需要）
- 等 3~4 秒窗体聚焦后 capture_fill_target → fill_credential（30 秒内完成）
- 脚本检测到长度变化即认定注入完成，自动把整行回写目标文件（UTF-8 无 BOM）并输出 `FILLED_OK`；90 秒超时输出 `FILL_TIMEOUT`
- 只校验元数据（末行长度、前缀），**禁止读取/输出文件内容**

## 验证方式

- 注入后不读内容，只校验末行 `Length > 前缀长度` 且以 `KEY=` 开头
- 2026-10-20 实测：Win11 记事本 `unsupported_target`，WinForms TextBox 注入成功（filled=True）

## 避坑提醒

- capture 与 fill 必须在 30 秒内连续完成，中间不能让目标窗口失焦
- fill 用的是捕获时的光标位置，定位光标要在 capture 之前完成
- `Start-Process powershell` 需 `-STA`；脚本事件处理器内变量用 `$script:` 作用域
- 临时脚本与凭据痕迹用后必须删除；目标文件确认已被 gitignore
- **capture 抓的是「前台窗口的聚焦控件」**——AI 会话里每次工具调用（Shell/子代理轮次结束）都可能把 IDE/工具宿主拉回前台，导致 capture 抓错窗口：fill 报 `input_sent` 但内容落到别处或落空。2026-10-22 浏览器页面实测：连续注入成功率约 1/3，且失败无报错
- **浏览器页面注入的可靠性差**：页面上有多个 `input[type=password]` 时，evaluate 读长度可能读到错误元素（误判「未注入」）；SPA 重渲染会替换 input 节点丢值；「记住密码」功能会回填其他环境密码（登录前必须核对框内内容是否为目标环境凭据）
- **推荐模式（浏览器登录场景）**：把一切自动化准备好（cookie 清理、账号键入、密码框聚焦、验证环境指向），然后用浏览器 handoff 机制留给用户单步输密码+提交——比反复重试 UIA 注入更快更可靠；密码核对与验证码/组织选择本来就依赖人眼
