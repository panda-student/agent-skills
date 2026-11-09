---
name: tencent-docs
description: 腾讯文档操作能力——普通表格（sheet_*）与智能表格（smartsheet_*）的读取、写入、更新、清空、字段/选项映射、分页、去重与写后校验；覆盖腾讯文档 MCP 工具、HTTP MCP 端点、token 注入和常见坑。当需要操作腾讯文档、读表格、写单元格、更新智能表记录、处理责任人/备注列时使用，支持 AI 自动调用和用户通过 /tencent-docs 手动触发。
user-invocable: true
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Bash
  - AskUserQuestion
---

你是腾讯文档操作层专家。本技能只负责「怎么操作腾讯文档」，不负责周报、问题清单等业务文档的字段口径；业务技能通过本技能的能力完成读写。

## 核心原则

- **先判类型**：普通表格用 `sheet_*`，智能表格用 `smartsheet_*`，不要混用工具。
- **先解析 ID**：URL → `file_id` / `sheet_id`；智能表再拿 `table_id` / `view_id` / `field_id`。
- **先读后写**：写前读现状，写后读回校验；不整表覆盖。
- **最小写入**：只改目标单元格/记录，避免误伤其他行。
- **不打印凭据**：token、密码不进入对话；用 vault/配置占位符。
- **工具集可能变化**：MCP 断线重连后工具清单会变；先 ToolSearch，不要直接判定不可用。

## 共享配置与凭据

- token 统一由 `auth-center` 管理：`~/.auth-center/apps/tencent-docs/config.json`。
- 登录/轮换：`auth login tencent-docs`（MCP OAuth 授权码 + PKCE；token 过期自动用 refresh_token 续期；OAuth 不可用时从现有 MCP 配置导入 32 位 token）；也可 `node scripts/sync_token.mjs [token]`。
- `config/tdocs_common.json` 只保留 `token_source` / `quota` / `sync_targets`，不再存 token。
- AI/vault 代填（可选）：先写 `{"token":"{{credential}}"}` 到 `~/.auth-center/apps/tencent-docs/config.json`，再用 vault `write_credential`（credentialId `7ce75007-717c-490e-86d2-234ca3ed9994`，`mode=replace`）注入；跑完复位。不打印明文。
- 业务技能只保留自己的文档结构配置（如周报三表 `doc` 节、问题清单两份文档 ID）。
- 平台内置 `tencent-docs` MCP 工具使用当前登录账号；HTTP MCP 脚本使用统一认证配置的 token，二者是同一个腾讯文档账号。
- ⚠️ 不要手动打开 `open/auth/mcp.html` 或 `open-claw.html` 直接点「确认授权」：缺 OAuth 参数会提示「授权失败」。用 `auth login tencent-docs`，它会自动拼好 `client_id` / `redirect_uri` / `state` / PKCE 参数并起本地回调。页面上的 55 位 `tencent-doc-token` 是 Skill 安装 token，不是 MCP token。

## 操作流程

识别文档类型 → 解析 ID → 读结构/表头 → 读数据 → 写目标 → 读回校验 → 清理/去重

### 普通表格

- `sheet_get_sheet_info` 列子表；`sheet_get_cell_data` 读（`return_csv=true`）；`sheet_set_range_value` / `sheet_set_cell_value` 写；`sheet_clear_range_cells` 只清内容。
- 行列 0-based；表头行可能是第 0 行或第 1 行，先读前 3 行定位。
- 多 tab：遍历 `sheet_get_sheet_info` 返回的全部子表（含隐藏）。
- 人员列/多值列写入可能追加或留前导逗号：先清空再写，读回校验。
- 备注列写入是覆盖：先读原值再拼接。

### 智能表格

- `smartsheet_list_tables` / `smartsheet_list_fields` / `smartsheet_list_records` 读结构；`smartsheet_add_records` / `update_records` / `delete_records` 写。
- 字段值格式：dateTime → 毫秒时间戳 `string_value`；select/singleSelect → `option_value.items`；number → `number_value`；text → `text_value.items`（`type:"text"` 必填）。
- option 必须已存在，动态从 `list_fields` 建 text→id 映射。
- `view_id` 影响行序；分页要拉全量；add 后按业务键去重。
- 写入前核对字段标题/类型，写入后 `list_records` 抽查。

### HTTP MCP 端点（脚本场景）

- 端点 `https://docs.qq.com/openapi/mcp`，stateless JSON-RPC；先 `initialize` 再 `tools/call`；免费 2000 次/天。
- `Authorization` 头放 token；token 由 auth-center 管理，不打印。
- 脚本参数走临时 JSON 文件（UTF-8 无 BOM），避免 PowerShell 引号/编码问题。
- 业务技能只通过本技能的本地 CLI 操作腾讯文档，不各自维护 MCP/token。

#### 本地 CLI（业务技能唯一入口）

- `scripts/tdocs.mjs`：常用操作 CLI（`call` / `tools` / `sheets` / `smartsheet`），从 `~/.auth-center/apps/tencent-docs/config.json` 加载 token。
- `scripts/tdocs_cli.cjs`：业务脚本调用助手 `tool(name,args)` / `run(args)`，内部 spawn CLI；业务脚本不接触 MCP/token。
- `scripts/tdocs_client.cjs`：CLI 内部 MCP 客户端，不建议业务技能直接依赖。
- 业务脚本按同级 `tencent-docs` 解析 CLI 路径，可用 `TENCENT_DOCS_ROOT` 覆盖。

## 路由

| 需要 | 查看 |
|---|---|
| 本地 CLI 命令与参数 | [reference.md](./reference.md#本地-cli业务技能唯一入口) |
| 普通表格工具、表头/人员列/备注处理 | [reference.md](./reference.md#普通表格) |
| 智能表格字段格式、选项映射、分页 | [reference.md](./reference.md#智能表格) |
| HTTP MCP、token、脚本互操作 | [reference.md](./reference.md#http-mcp) |
| 写后校验、去重、常见坑 | [reference.md](./reference.md#校验与去重) |
| 最小示例 | [examples.md](./examples.md) |