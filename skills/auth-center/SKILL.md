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
        ├── config.json           # token 缓存 + 该 app 的连接配置
        └── sso-credentials.json  # 可选：账号密码（WinForms/vault-ops 录入）
```

- 根目录可用 `AUTH_CENTER_HOME` 覆盖；Profile 可用 `AUTH_CENTER_PROFILE_DIR` 覆盖。
- 旧环境变量 `UNIFIED_AUTH_HOME` / `UNIFIED_AUTH_PROFILE_DIR`、`JOMOO_AUTH_HOME` / `JOMOO_AUTH_PROFILE_DIR` 仍兼容。
- 旧路径 `~/.<app>/config.json`、`~/.<app>/sso-credentials.json` 由 `ensureAppFile()` 自动迁移。

## 支持的 app

| app | 登录方式 | 配置目录 |
|---|---|---|
| `zentao` | 共享 Edge 登录捕获 `zentaosid`；有凭据时无头 `/tokens` | `apps/zentao-cli/` |
| `pms` | 共享 Edge SSO 静默捕获 cookie token | `apps/pms-cli/` |
| `anyshare` | 共享 Edge SSO 静默捕获；可选无头登录 | `apps/anyshare-cli/` |
| `ibpm` | UCenter 无头 SSO；失败回落浏览器 | `apps/ibpm-cli/` |
| `tencent-docs` | MCP OAuth 授权码 + PKCE（自动 refresh）；OAuth 不可用时从现有 MCP 配置导入 32 位 token | `apps/tencent-docs/` |
| `api-center` | 共享 Edge 捕获 `nisbos_auth_token` cookie；登录页在共享 Profile 中人工登录一次；`status` 为本地 JWT 过期校验，`token` 过期会自动刷新 | `apps/api-center/` |
| `github` | 共享 Edge 捕获 HttpOnly `user_session`（网页登录态，供 PR 图片上传等网页操作复用；API 仍用 PAT） | `apps/github/` |

## 给新 CLI 接入

1. **优先复用库**：`import { createTokenManager, loadAppConfig, saveAppConfig, configFilePath, credentialsFilePath } from 'auth-center';`
2. 实现系统特定项：
   - `validateToken(token)`：轻量接口试活。
   - `headlessLogin(cred)`：可选，无头登录返回 token。
   - `cookieTokenRe` / `cookieSource`：cookie 型 token 用；`cookieSource: 'cdp'` 可读 HttpOnly cookie。
3. `createTokenManager({ appName, label, baseUrl, launchUrl, validateToken, headlessLogin, ... })` 自动完成「缓存试活 → 无头 → Edge leveldb → CDP 弹窗 → 落盘」。
4. 凭据录入用 `promptAndSaveCredentials(appName)`；不要自己写 `~/.<app>` 路径。
5. 在 `auth-center/bin/auth.mjs` 的 `APPS` 里注册 app 的 login/status（或自定义登录函数），让 `auth login <app>` 可用。

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
- 业务配置 `tencent-docs/config/tdocs_common.json` 只保留 `token_source` / `quota` / `sync_targets`。
- 轮换/同步：`node ~/.agents/skills/tencent-docs/scripts/sync_token.mjs [token]` 或 `--from-auth`。

## 安全约定

- 不在对话中打印 token/密码。
- 凭据写入 `apps/<app>/sso-credentials.json`，用 WinForms 弹窗或按 `vault-ops` 技能注入；占位符 `{{credential}}` 视为未注入。
- 共享 Profile 只保留登录会话，不手工复制/迁移到其他目录。
