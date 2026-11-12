---
name: tencent-docs-ops
description: 通过 tencent-docs CLI 操作腾讯文档——普通表格与智能表格（smartsheet）的读取、写入、清空、追加记录、字段格式、分页拉全量与写后校验；token 由 auth-center / vault-ops 管理，AI 不接触明文。当用户要读/写腾讯文档、在线表格、智能表格、问题清单、周报三表，或提到 tab/子表/单元格/记录/字段/人员列/备注列时使用；本技能是腾讯文档通用操作能力的单一来源，供上层业务 SOP 复用；也可通过 /tencent-docs-ops 手动触发。
user-invocable: true
allowed-tools:
  - Read
  - Bash
---

# tencent-docs CLI（普通表格 / 智能表格）

> **单一来源约定**：所有技能不得各自复述腾讯文档的命令、字段格式与踩坑；只声明「文档 / 子表 / 列名 + 业务规则」，操作方式统一引用本技能。命令与字段细节以 [CLI reference](../../cli/tencent-docs-cli/reference.md) 为准。

## 入口

| 项 | 值 |
|---|---|
| 命令 | `tencent-docs`（全局，落在 `/d/nodejs`） |
| 源码 | `~/.agents/cli/tencent-docs-cli/` |
| 机制层 | `~/.agents/cli/mcp-client/`（Streamable HTTP：initialize、session、SSE、超时） |
| 换机还原 | 在 `~/.agents/cli/tencent-docs-cli/` 执行 `npm install && npm link` |
| 默认端点 | `https://docs.qq.com/openapi/mcp` |
| token | `--token-file` → `--config` → `~/.auth-center/apps/tencent-docs/config.json` |

## 边界与红线

- 腾讯文档操作只走 `tencent-docs`；其它远程 MCP 走 `mcp`（`mcp-client` 自带命令），本地 stdio MCP 走 `dbx` / `vault`
- token 不打印、不进命令参数、不写进仓库；默认由 CLI 从 auth-center 读取，临时 token 文件按 `vault-ops` 注入并即用即删
- 不手写 JSON-RPC / fetch；initialize、session、SSE、超时都由 `mcp-client` 处理
- 免费配额 2000 次/天，每次 `tools/call` 计一次；批量前先算调用次数
- 写入前先读现状，写入后读回校验；不整表覆盖

## 命令速查

```powershell
tencent-docs tools                                  # 工具清单（工具集变化时先查）
tencent-docs call <tool> [argsJson|@file|-]         # 通用调用，- 从 stdin 读 JSON

tencent-docs sheets list <file_id>
tencent-docs sheets read <file_id> <sheet_id> [--start-row N --end-row N --start-col N --end-col N]
tencent-docs sheets write <file_id> <sheet_id> --values <json|@file|->
tencent-docs sheets clear <file_id> <sheet_id> --start-row N --end-row N --start-col N --end-col N

tencent-docs smartsheet tables <file_id>
tencent-docs smartsheet fields <file_id> <sheet_id>
tencent-docs smartsheet records <file_id> <sheet_id> [--view-id ID] [--all]
tencent-docs smartsheet add <file_id> <sheet_id> --records <json|@file|->
tencent-docs smartsheet update <file_id> <sheet_id> --records <json|@file|->
tencent-docs smartsheet delete <file_id> <sheet_id> --ids id1,id2
```

参数大、含中文或引号时，写到 UTF-8 临时 JSON 文件用 `@file`，或经 stdin 传 `-`；不要依赖 PowerShell 内嵌引号。

## 普通表格

### 定位与读取

- 先用 `sheets list` 拿全部子表（含隐藏），确认目标 `sheet_id`
- `sheets read` 返回 CSV，行列均 **0-based**
- 表头行不固定：先读前 3 行，找同时含业务关键列名的行（可能是第 0 行或第 1 行）
- 多值责任列按包含判断筛选，不要用等值

### 写入与清空

- `sheets write` 批量写单元格：每项带 `row` / `col` / `value_type` / `string_value`
- `sheets clear` 只清内容、保留样式；内容和样式一起清的能力慎用
- 写入后必须 `sheets read` 读回目标区域

### 人员列与备注列

- 人员/多值列直接写会**追加**，出现「张三,李四」或前导逗号「,李四」
- 正确顺序：清空目标格 → 写入目标值 → 读回确认无旧值与前导逗号
- 备注列写入是**覆盖**：先读原备注 → 按换行追加新内容 → 写回 → 读回
- 备注条目分隔用换行或全角空格，不用半角空格

## 智能表格

### 结构

- `smartsheet tables` 拿 `table_id` / `sheet_id`
- `smartsheet fields` 拿字段标题、类型、单选项 id
- `smartsheet records --all` 自动分页拉全量；`--view-id` 会影响返回行序

### 字段值格式

- dateTime：`string_value` = 毫秒时间戳字符串
- select / singleSelect：`option_value.items[]` 带 `id` 与 `text`，选项必须已存在
- number：`number_value`
- text：`text_value.items[]`，每项 `type: "text"`

不要硬编码 option id；每次先 `fields` 拉当前选项，建 text→id 映射。

### 新增、更新、删除

- `add` 追加记录，日期分组由服务端归位
- `update` 按 `record_id` 更新，只传要改的字段
- `delete --ids` 按 `record_id` 删除，删除前先读出并确认目标

## 写后校验与去重

- 单元格/记录写后读回，核对值、类型、行列位置
- 批量写入后核对行数；智能表按业务键（如日期 + 成员 + 内容）本地去重
- 失败先查字段名、字段类型、option id，不要盲目重试

## 常见坑

- 工具集在重连后可能变化：先 `tencent-docs tools`，不要直接判定工具缺失
- 人员列直接写会追加：清空后重写
- 备注列直接写会覆盖：先读再拼
- 行列 0-based；表头行可能是 0 或 1
- 隐藏子表容易漏扫：遍历 `sheets list` 全部结果
- 智能表格是 canvas 渲染：浏览器自动化只作兜底，优先 CLI
- 智能表选项必须已存在；不要硬编码 option id
- token 过期先 `auth login tencent-docs`，再重试
- 读取外部 UTF-8 输出前设置 `[Console]::OutputEncoding = [Text.Encoding]::UTF8`

## 被其它技能引用（复用契约）

调用方只声明四件事：

- **文档定位**：`file_id` 或文档 URL
- **子表定位**：`sheet_id` 或 tab 名
- **列 / 字段**：表头名、字段标题
- **业务规则**：筛选条件、写入值、去重键

统一引用句：

> 腾讯文档读写见 `tencent-docs-ops` 技能；本技能只声明文档 / 子表 / 列名与业务规则。

调用方禁止复制本技能的命令、字段格式与坑；口径变更只改本技能。

## 文档

- [reference.md](../../cli/tencent-docs-cli/reference.md)：命令、字段格式、人员列 / 备注列、校验规则
- [examples.md](../../cli/tencent-docs-cli/examples.md)：常用调用示例
- [mcp-client](../../cli/mcp-client/)：stdio / HTTP 机制层