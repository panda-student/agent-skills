# 腾讯文档操作参考

## 普通表格

### 识别与读取

- `sheet_get_sheet_info`：返回子表 `sheet_id` / `sheet_name` / 行列数；先确认目标子表。
- `sheet_get_cell_data`：读取区域；`return_csv=true` 直接拿 CSV；行列均 0-based。
- 表头行定位：读前 3 行，找同时含「序号」「问题描述」或业务关键列名的行；不同文档表头可能在 0 行或 1 行。
- 多 tab：遍历 `sheet_get_sheet_info` 的全部子表，包括隐藏子表。
- 多值责任列：单元格可能是「张三,李四」；筛选用包含判断，不用等值。

### 写入与清空

- `sheet_set_range_value`：批量写多个单元格；`values` 里每项带 `row` / `col` / `value_type` / `string_value`。
- `sheet_set_cell_value`：单单元格写；工具集变化时可能不可用。
- `sheet_clear_range_cells`：只清内容，保留样式。
- `sheet_clear_range_all`：内容和样式一起清，慎用。

### 人员列与备注列

- 人员列/多值列直接写可能**追加**，出现「张三,李四」或前导逗号「,李四」。
  正确顺序：`sheet_clear_range_cells` 清空目标格 → `sheet_set_range_value` 写目标值 → `sheet_get_cell_data` 读回校验。
- 备注列写入是**覆盖**：先读原备注 → 追加新内容 → 写回 → 读回。
- 写备注时不要用半角空格做条目分隔；用换行或全角空格。

## 智能表格

### 读结构

- `smartsheet_list_tables`：拿 `table_id` / `sheet_id`。
- `smartsheet_list_fields`：拿字段标题、类型、`singleSelect` 选项 id。
- `smartsheet_list_records`：按 `sheet_id` + 可选 `view_id` 读记录；分页拉全量。
- `smartsheet_list_views`：拿视图 id；`view_id` 会影响返回行序。

### 写记录

- `smartsheet_add_records`：追加记录；日期分组自动归位。
- `smartsheet_update_records`：按 `record_id` 更新；`field_values` 只传要改的字段。
- `smartsheet_delete_records`：按 `record_id` 删除。

### 字段值格式

- dateTime：`string_value` = 毫秒时间戳字符串（+08:00 零点）。
- select / singleSelect：`option_value: {items:[{id,text}]}`；option 必须已存在。
- number：`number_value` 整数/小数。
- text：`text_value: {items:[{text, type:"text"}]}`；`type` 必填。

示例：

```json
{
  "fields": {
    "日期": { "string_value": "1793980800000" },
    "成员": { "option_value": { "items": [{ "id": "opt_1", "text": "张三" }] } },
    "工时": { "number_value": 8 },
    "内容": { "text_value": { "items": [{ "text": "禅道：12345-修复问题", "type": "text" }] } }
  }
}
```

### 选项映射与分页

- 不要硬编码 option id；先 `list_fields` 拉当前表选项，建 text→id 映射。
- `list_records` 分页要拉全量；按业务键（日期+成员+内容等）在本地去重。
- 写入后 `list_records` 抽查，确认字段落位。

## 连接机制

腾讯文档 MCP 走 Streamable HTTP；连接、initialize、session、SSE 与超时统一由 `mcp-client` 机制层负责，业务侧只有两种入口：

- **CLI（业务技能唯一入口）**：`tencent-docs`（源码 `~/.agents/cli/tencent-docs-cli/`）
  - `call <tool> [args|@file|-]`
  - `tools`
  - `sheets list/read/write/clear`
  - `smartsheet tables/fields/records/add/update/delete`
- **脚本内调用**：用 `cli-helper.cjs` 调 CLI（`tool(name, args)` / `run(args)`），不接触 token；不要手写 JSON-RPC

约定：

- 端点：`https://docs.qq.com/openapi/mcp`（`--endpoint` 覆盖）
- token 来源：`--token-file` → `--config` → auth-center 的 `tencent-docs` 配置
- 配额：免费 2000 次/天，每次 `tools/call` 计一次

### 共享配置

token 由 `auth-center` 统一管理：

```json
// ~/.auth-center/apps/tencent-docs/config.json
{
  "token": "<32位hex>",
  "tokenSavedAt": "2026-11-09T...",
  "tokenSource": "https://docs.qq.com/open/auth/mcp.html"
}
```

- 登录/轮换：`auth login tencent-docs`（MCP OAuth 授权码 + PKCE，自动 refresh；OAuth 不可用时从现有 MCP 配置导入 32 位 token）。
- ⚠️ 不要手动打开 `open/auth/mcp.html` / `open-claw.html` 点「确认授权」：缺 OAuth 参数会「授权失败」；用 `auth login` 自动拼参数并起本地回调。55 位 `tencent-doc-token` 是 Skill 安装 token，不是 MCP token。
- 只有 CLI 读取 token；业务技能只保留自己的文档结构配置（周报三表 `doc` 节、问题清单文档 ID），不各自存 token。
- 其它远程 MCP 改用 `mcp`（`mcp-client` 自带命令，通用 `tools` / `call`）；临时 token 文件由 `vault-ops` 注入、用完即删。

约定：

- token 不打印；需要 vault 注入时按 `vault-ops` 的占位符范式写到 auth-center 配置，跑完复位。
- 脚本参数一律走临时 JSON 文件（UTF-8 无 BOM），避免 PowerShell 内嵌引号被剥离。
- 中文参数不要在 PowerShell 命令行直接传；写文件或 Node 内部构造。
- 读外部 UTF-8 输出前设 `[Console]::OutputEncoding = [Text.Encoding]::UTF8`。

## 校验与去重

- 写入后读回目标单元格/记录，确认值、类型、行位置。
- 批量写入后核对行数；智能表按业务键去重，保留最早或最新一条（按业务规则）。
- 跨表/跨文档复制：先读源、再写目标、最后对比关键字段。
- 失败时先检查字段名/类型/option id，不要盲目重试。

## 常见坑

- MCP 工具集在断线重连后可能变化：先 ToolSearch，别直接判定缺失。
- 人员列直接写会追加或留前导逗号：清空后重写。
- 备注列直接写会覆盖：先读再拼。
- 行列 0-based；表头行可能是 0 或 1。
- 隐藏子表容易被漏扫：遍历 `sheet_get_sheet_info` 全部结果。
- 智能表格是 canvas 渲染：浏览器自动化只作兜底，优先 MCP。
- 智能表 option 必须已存在；不要硬编码 option id。
- token 过期会报认证错误；先刷新 token，再重试。
- 免费配额 2000 次/天；批量操作注意调用次数。