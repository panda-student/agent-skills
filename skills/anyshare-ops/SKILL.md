---
name: anyshare-ops
description: 通过 anyshare CLI 操作爱数 AnyShare 文档云（wendang.jomoo.com）：列文档库、逐级浏览目录、下载文件、按更新时间增量同步目录、查询 token 供 curl 复用，token 失效自动走刷新链（无头 UCenter → 浏览器静默 SSO 回路）。**直接调用本技能且未指定其他操作时，默认执行 PMS 需求文档同步脚本（见「默认同步约定」）**。当用户要查/浏览/搜索/下载/同步 AnyShare 文档库或目录、提到「文档系统/文档云/wendang/AnyShare」、或需要 AnyShare token 调 API 时使用。
---

# AnyShare 文档云操作（anyshare CLI）

## 默认动作（先看这里）

**本技能被直接调用且用户未指定其他操作时，不询问、不确认，立即执行：**

```powershell
& "C:\Users\JOMOO\.agents\skills\anyshare-ops\scripts\sync-pms-requirement.ps1"
```

执行完向用户汇报各目录同步结果即可。仅当用户明确提出浏览/下载/查 token 等其他操作时，才走下方对应流程。

## 背景（AI 不知道的部分）

- AnyShare 7.0 API 网关：`https://wendang.jomoo.com/api/<服务>/v1/...`，认证 `Authorization: Bearer ory_at_...`（Hydra opaque token，**非 JWT**，无法本地解析 exp，只能靠 API 试活判断有效性）。
- CLI 已实现并 npm link（源码：`code_workspace/anyshare-cli/`），token 落盘 `~/.anyshare-cli/config.json`；SSO 凭据在 `~/.anyshare-cli/sso-credentials.json`（WinForms 弹窗录入，明文不进终端/对话，输入框为标准 UIA Edit 控件 `AccessibleName=账号/密码`，可被密码管理器注入）。
- **token 刷新链**（CLI 401 时全自动，无需人工干预）：
  1. 配置 token 试活；
  2. 已配凭据 → 无头 UCenter 链（`loginByCode` → `/sso` 回跳，链路未实测打通，失败静默回落）；
  3. 先扫 Edge leveldb（机会性复用日常浏览器的残留 token，命中即免开浏览器）；
  4. 仍失败 → 唤起**专用 Profile Edge**（`%LOCALAPPDATA%\.anyshare-cli\edge-profile`，与日常浏览器隔离）打开**首页**触发静默 SSO 回路自动换发，CDP（9223 端口）轮询捕获 Authorization cookie（180s 超时）。会话有效时零交互；**检测到登录页时自动弹置顶系统提示框提醒人工介入**（终端输出易被忽略，实测反馈）。首次使用在窗口登录一次后会话持久化，之后永久自动。

## 命令速查

```bash
anyshare whoami               # token 状态（有效性/来源/保存时间）——排查认证问题先跑这个
anyshare libs                 # 文档库列表（name/type/gns id）
anyshare ls [路径]             # 列目录。路径 = "文档库名/子目录/..." 或 gns:// id；d=目录 f=文件（文件行附 gns id）；缺省列默认目录
anyshare dir [路径]            # 查看/设置默认进入目录（写入配置 default_dir，附网页入口 URL）；ls 无参时列默认目录
anyshare download <路径> [目标] # 下载文件（别名 dl）。路径 = gns:// id 或 "文档库名/子目录/文件名"；
                              # 目标为已存在目录时落到该目录（用云端文件名），否则视为文件路径；缺省落当前目录
anyshare sync <云端路径> <本地目录> [--dry-run]
                              # 递归同步云端目录到本地。只对比更新时间（云端 mtime 晚于本地才下载，
                              # 不看大小）；本地缺失也下载；云端「历史版本」子目录默认跳过；
                              # 本地多出的文件不删除；下载后本地 mtime 对齐云端时间；--dry-run 仅预览
anyshare token [--refresh]    # 输出 token 供 curl 复用；--refresh 强制走刷新链
anyshare login                # 登录/换号（无头优先 → 浏览器捕获）
anyshare cred-setup           # 一次性弹窗录入 SSO 凭据（启用无头刷新）
anyshare logout               # 清除本地 token
```

## 操作流程

1. 先 `anyshare whoami` 确认认证状态。
2. `anyshare libs` 拿文档库 gns id；`anyshare ls "库名/目录"` 逐级浏览（路径片段支持模糊匹配：精确名优先，否则 includes）。
3. **下载文件优先用 CLI**：`anyshare download "库名/目录/文件名.xlsx" "D:\目标目录"`——自动走 metadata → 签名 → 下载，并按云端大小校验。禁止再手拼 curl 调下载接口。
4. 需要直调其他 API 时：`$tok = anyshare token`，再 `curl -H "Authorization: Bearer $tok" https://wendang.jomoo.com/api/document/v1/...`（注意 PowerShell 5.1 的 curl 引号坑，见 Memory）。
5. 命令报 401/认证失败时 CLI 已自动刷新重试；若最终报错，让用户在 Edge 里打开 wendang.jomoo.com 登录一次，再重跑命令即可。
6. **AI 会话注意**：执行 `anyshare login` 或已知会触发浏览器登录链路的命令时，必须同步调用 browser_waiting_for_user_interaction 弹「接管浏览器」提示（写明「请在弹出的专用 Edge 窗口完成登录」），禁止默默后台等待——用户曾因不知道要介入而卡住（2026-11-04 反馈）。

## 默认同步约定（PMS 需求文档，2026-11-05 约定）

用户调用本技能说「同步/更新需求文档」时，**直接执行技能自带脚本**（映射与路径已固化在脚本内，无需现场拼命令）：

```powershell
& "C:\Users\JOMOO\.agents\skills\anyshare-ops\scripts\sync-pms-requirement.ps1"
```

- 脚本内容：对云端基路径 `九牧集团信息化/48-项目管理系统V1.0/04产品研发&测试/需求规格说明书` 与本地基路径 `d:\IdeaProjects\jomoo-ai-coding\code_workspace\docs\requirement` 的 10 组目录映射（`1-项目规划及变更`→`项目规划及变更`、`2-立项申请`→`项目立项`、`项目变更`→`变更`、`项目效益`→`效益`、`项目权限`→`离职人员预警`、`工程项目采购申请流程`→`工程采购`，其余同名）逐条执行 `anyshare sync`
- 注意：**禁止 `sync 需求规格说明书` 整库根目录**（云端目录名与本地不一致且含 0-历史，会生成错误结构）；本地 `流程自动化测试\` 无云端对应，保持不动；云端根目录游离旧版 `项目信息_..._V0.1.xlsx` 不会被循环拉取，属正常
- 稳态表现：无变化时 10 个目录约 3 秒跑完，全部「已是最新 0 下载」；云端有改动时只增量下载变化文件
- 云端目录结构变化（新增/改名子目录）时，先改脚本内 `$map` 再执行
- **脚本编码硬规则**：`.ps1` 含中文必须存为 **UTF-8 with BOM**（Windows PowerShell 5.1 对无 BOM 文件按 GBK 解析，中文全乱码报解析错误）；用工具改完脚本后若报「意外的标记」，先补 BOM 再跑

## 坑位（勿重试清单，2026-11-04 实测）

- `POST /oauth2/token`（grant_type=refresh_token + signin/aud client_id）→ 401 invalid_client（confidential，secret 在后端）——**不存在纯 HTTP refresh_token 换号**。
- `/api/eacp/v1/auth1/token|refresh` → 404；`/af/api/session/v1/*` → 503。
- **leveldb 扫描通道不可靠**（2026-11-04 修正）：token 实际存于 `Authorization` cookie（Cookies SQLite，非 leveldb）和 SPA 内存，leveldb 里只能扫到偶发残留且会被 compaction 清除——只作机会性复用，主通道是 CDP。
- **state=undefined 坑位**：直接导航 `/anyshare/oauth2/login?...` 时 SPA 缺少本地 state 生成 `state=dW5kZWZpbmVk`（base64 "undefined"），回调卡死在 login/callback，token 不下发。**必须从首页进入让 SPA 自行发起 OAuth 流程**（已实测验证）。
- Cookies SQLite 被日常 Edge 独占锁（FileShare ReadWrite 与 esentutl /y 均失败），DPAPI 解 key 可行但读不到文件——因此用专用 Profile + CDP，不走 cookie 解密。
- 不要用剪贴板方案回传 token（页面失焦时 clipboard 全被拒）；不要改 Authorization cookie 做实验（SPA 会陷入 chunk 重载死循环）。
- **同步/比对只看更新时间，不看文件大小**（2026-11-05 用户拍板）：云端列表接口的 KB 显示值与本地字节比对不可靠（舍入误差），且同大小可能内容已变——判定「是否需要下载」的唯一依据是云端 `modified_at` vs 本地 mtime；大小只用于下载后完整性校验。

## 已验证 API（可直调）

| 端点 | 说明 |
|---|---|
| `GET /api/document/v1/entry-doc-lib?sort=doc_lib_name&direction=asc` | 文档库列表（顶层 JSON 数组，字段 `id`(gns://)、`name`、`type`） |
| `GET /api/document/v1/folders/{urlencode(gns id)}/sub_objects?limit=100&sort=name&direction=asc[&marker=]` | 子对象列表（`dirs[]`/`files[]`/`next_marker` 翻页） |
| `POST /api/efast/v1/file/metadata`，body `{"docid":"gns://..."}` | 文件元信息（返回 `rev`/`file_name`/`size`/`docid`） |
| `POST /api/efast/v1/file/osdownload`，body `{docid, authtype:"0", savename, usehttps:"1", rev}` | 下载签名。**所有字段必须字符串类型**，传数字报「参数不合法」；返回 `authrequest:[GET, 签名URL, "Authorization: AWS ...", "x-amz-date: ..."]`，携带后两个头 GET 签名 URL 即得文件内容 |

## 下载链路（2026-11-05 实测打通，已集成 CLI）

- 顺序：`fileMetadata(docid)` 取 `rev` → `fileOsDownload({docid, savename, rev})` 取签名 → GET 签名 URL 下载 → 按 `size` 校验完整性。
- **authrequest 第 3/4 项是完整 HTTP 头行**：node fetch 需按第一个冒号拆成 name/value，整串当值发送会 403；curl 用 `-H "整行"` 直接过。
- 签名 URL 有时效（含 x-amz-date 签名窗口），取得后立即下载，不要缓存复用。
- 网页目录入口 URL 模板：`https://wendang.jomoo.com/anyshare/zh-cn/dir/<gns id 去掉 gns:// 前缀>`（`anyshare dir` 命令会直接输出）。
