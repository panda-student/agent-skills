---
name: auth-center
description: 统一登录与 token 管理入口，所有公司系统（禅道/PMS/AnyShare/IBPM/腾讯文档/API中心等）的登录、认证、鉴权、token 缓存与刷新都走 auth-center：单一 Edge Profile + ~/.auth-center/apps/<app>/ 配置。当 AI 需要登录任何系统、打开需要登录态的页面、调用需要 token/cookie 的接口、遇到 401/403 或“未登录/登录已过期/token 失效”、需要取 token 给脚本或 curl 复用、需要复用浏览器 SSO 会话、或给新 CLI 接入统一认证时，自动触发本技能；禁止自建登录页、自建浏览器 Profile 或手工复制 cookie。
---

# auth-center

所有登录的统一入口。业务技能/CLI 不再各自维护登录逻辑、token 文件或 Edge Profile。

## AI 自动触发场景（强制）

出现以下任一情况，AI 必须自动使用本技能，不得自行打开登录页、新建浏览器 Profile 或手工复制 Cookie：

- 需要调用任何公司系统的登录态接口，但当前没有 token/cookie。
- 接口返回 `401`、`403`、`未登录`、`登录已过期`、`token 失效`、`10001 登录已过期`。
- 需要打开浏览器操作已登录系统（PMS、IBPM、禅道、AnyShare、腾讯文档等）。
- 需要把 token 交给 curl、yaak、脚本或 CI 复用。
- 需要查看/刷新/清理某个系统的登录状态。
- 新系统或新 CLI 需要接入统一认证。

标准动作：`auth status <app>` 确认状态 → `auth login <app>` 登录/刷新 → `auth token <app>` 取 token 复用；不要把 token 打印到对话里。

## 登录态自动检测（强制）

- 打开登录页后，AI 必须自动轮询登录态，检测到登录成功后立即继续原任务，禁止要求用户回复“好了”。
- 轮询判据：登录页关键元素消失、URL 跳转离开登录页、页面出现用户信息/退出登录入口。
- 工具建议：`agent-browser wait <selector>`，或定时 `snapshot` 检查登录页元素；超过合理时长（如 2 分钟）才提示用户。
- 共享 Profile 登录一次后，后续系统优先复用已有会话，不要重复弹登录。
- `api-center` 优先走无头登录（账号密码 + 选择组织）；无头失败才回落可视浏览器人工登录，避免每次 token 过期都弹窗。

## 快速命令

```powershell
auth apps                  # 列出支持的 app
auth login <app>           # 登录（zentao/pms/anyshare/ibpm/tencent-docs/api-center）
auth status                # 查看所有 app 的缓存状态
auth status <app>          # 调该 app 的 whoami 做权威校验
auth token <app>           # 输出 token 供脚本/curl 复用（不要打印到对话）
auth logout <app>          # 清除本地 token（保留凭据）
```

## 统一目录

```text
~/.auth-center/
├── edge-profile/                 # 唯一 Edge Profile，所有 SSO 会话
└── apps/
    └── <app>/
        ├── config.json           # token 缓存 + 连接配置 + vault 映射
        └── sso-credentials.json  # 仅历史遗留（已停用；密码由 vault-ops 管理）
```

- 根目录可用 `AUTH_CENTER_HOME` 覆盖；Profile 可用 `AUTH_CENTER_PROFILE_DIR` 覆盖。
- 旧环境变量 `UNIFIED_AUTH_HOME` / `UNIFIED_AUTH_PROFILE_DIR`、`JOMOO_AUTH_HOME` / `JOMOO_AUTH_PROFILE_DIR` 仍兼容。
- 旧路径 `~/.<app>/config.json` 由 `ensureAppFile()` 自动迁移；`sso-credentials.json` 已停用，仅用于迁移清理。

## 支持的 app

| app | 登录方式 | 配置目录 |
|---|---|---|
| `zentao` | 共享 Edge 登录捕获 `zentaosid`；无头 `/tokens` 时密码按 `vault-ops` 技能运行时取用 | `apps/zentao-cli/` |
| `pms` | 共享 Edge SSO 静默捕获 cookie token | `apps/pms-cli/` |
| `anyshare` | 共享 Edge SSO 静默捕获；可选无头登录（密码按 `vault-ops` 技能运行时取用） | `apps/anyshare-cli/` |
| `ibpm` | UCenter 无头 SSO（密码按 `vault-ops` 技能运行时取用）；失败回落浏览器 | `apps/ibpm-cli/` |
| `tencent-docs` | MCP OAuth 授权码 + PKCE（自动 refresh）；OAuth 不可用时从现有 MCP 配置导入 32 位 token | `apps/tencent-docs/` |
| `api-center` | 默认无头登录（账号密码 + 选择组织，自动获取 `nisbos_auth_token`）；失败才回落到共享 Profile 可视浏览器人工登录；`status` 为本地 JWT 过期校验，`token` 过期会自动刷新 | `apps/api-center/` |

## 通用能力与系统差异（强制）

- auth-center 只提供通用接口和能力：`createTokenManager`、`webHeadlessLogin`、`validateJwtToken`、`loadCredentials`、`ucenterLoginByCode`、`createCookieJar`、`extractToken` 等。
- 各业务 CLI 在自己的 `auth.mjs` 里声明系统差异（`baseUrl`、`launchUrl`、`cookieTokenRe`、`headlessLogin` 的登录地址/组织名），复用上述通用能力。
- 禁止在 CLI 里复制通用登录逻辑（刷新阶梯、cookie 采集、无头浏览器驱动、JWT 校验）；通用逻辑变更只改 auth-center，系统差异变更只改对应 CLI。
- 新增系统：CLI 侧组合 `createTokenManager` + `webHeadlessLogin` 等通用能力；只有确实通用的能力才加到 auth-center。

## 给新 CLI 接入

1. 从 auth-center 引入通用能力：`createTokenManager`、`webHeadlessLogin`、`validateJwtToken`、`loadCredentials` 等。
2. 在 CLI 的 `auth.mjs` 组合系统差异：
   - `baseUrl` / `launchUrl` / `cookieTokenRe` / `cdpPort`
   - `validateToken(token)`：JWT exp 判定或轻量接口试活
   - `headlessLogin(credential)`：网页账号密码系统直接 `webHeadlessLogin({ loginUrl, companyText, cookieName, credential })`
3. 共享 Profile 唯一定义在 auth-center 的 `SHARED_PROFILE_DIR`；CLI 不要另建 profile。
4. 凭据不落盘：按 `vault-ops` 技能维护条目，并在 `apps/<app>/config.json` 的 `vault` 字段声明映射。
5. 在 `auth-center/bin/auth.mjs` 的 `APPS` 里注册 app 的 login/status（如果该 app 也作为 auth-center 的顶层入口）。

## 凭据映射（vault-ops）

密码统一按 `vault-ops` 技能维护，auth-center 运行时按 app 映射取用，**不再写 `sso-credentials.json`**。

- 默认检索词：app 名去掉 `-cli`（如 `zentao-cli` → `zentao`），取 `kind=password` 且含密码的唯一条目。
- 条目不唯一、需指定环境或多环境时，在 `apps/<app>/config.json` 增加映射：

```json
{ "vault": { "entryId": "<id>", "groupId": "default", "field": "password" } }
{ "vault": { "query": "ibpm", "title": "IBPM 平台 Web 登录" } }
{ "vault": { "uat": { "query": "ibpm", "title": "IBPM 平台 Web 登录" } } }
```

- `vault-ops` 的 CLI 默认取 PATH 中的 `vault`，可用 `AUTH_CENTER_VAULT_CLI` 覆盖。
- `vault-ops` 的 CLI 不可用或条目缺失时，无头登录失败并在错误信息中提示；浏览器登录态不受影响。

## 腾讯文档

- 登录：`auth login tencent-docs`，走标准 MCP OAuth 授权码 + PKCE：
  1. 首次自动动态注册 OAuth 客户端（`/openapi/mcp/oauth/register`）。
  2. 本地起 8765 回调服务，打开 `open-claw.html?authType=2` 并带上 `client_id` / `redirect_uri` / `state` / `code_challenge` 等参数。
  3. 在浏览器点「确认授权」，回调拿 code，换 `access_token` + `refresh_token`。
  4. 保存到 `~/.auth-center/apps/tencent-docs/config.json`。
- token 过期：`auth token tencent-docs` / `auth login tencent-docs` 自动用 `refresh_token` 续期，无需再开浏览器。
- OAuth 不可用时兜底：从现有 MCP 客户端配置（`~/.claude.json` / Trae）导入 32 位 token。
- **不要**手动打开 `open/auth/mcp.html` 或 `open-claw.html` 直接点「确认授权」：缺 OAuth 参数会提示「授权失败」。`auth login` 会自动拼好参数。
- 页面上 55 位的 `tencent-doc-token` 是 Skill 安装 token，不是 MCP token。
- 业务配置由调用方技能维护；腾讯文档走 `tencent-docs`，其它远程 MCP 走 `mcp`（`mcp-client` 自带命令）。
- 轮换/同步：`auth login tencent-docs`（过期自动 refresh）；`tencent-docs tools` 可验证 token 是否可用。

## 安全约定

- 不在对话中打印 token/密码。
- 密码只在 `vault-ops` 中维护；auth-center 运行时取用，不写入 `sso-credentials.json`。该文件仅历史遗留，可删除。
- 浏览器自身保存的登录态（Edge Profile）不纳入 `vault-ops` 管理。
- 共享 Profile 只保留登录会话，不手工复制/迁移到其他目录。
- Windows 下调用 vault 时直接执行 `vault-cli/bin/vault.js`（Node），不经过 `cmd.exe`/PowerShell；子进程统一 `windowsHide: true`，避免弹出 cmd 控制台窗口。
