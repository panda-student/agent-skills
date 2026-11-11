# tencent-docs-cli

腾讯文档业务 CLI：普通表格 / 智能表格读写与通用工具调用。连接、握手、JSON-RPC 全部复用 [mcp-client](../mcp-client/)（Streamable HTTP），本包只保留腾讯文档的端点、token 来源、工具名兼容与表格语义。

## 入口

| 项 | 值 |
|---|---|
| 命令 | `tencent-docs`（全局，落在 `/d/nodejs`） |
| 源码 | `~/.agents/cli/tencent-docs-cli/` |
| 换机还原 | 在该目录执行 `npm install && npm link` |
| 默认端点 | `https://docs.qq.com/openapi/mcp`（`--endpoint` 或 `TENCENT_DOCS_MCP_ENDPOINT` 覆盖） |
| 默认 token | `~/.auth-center/apps/tencent-docs/config.json` 的 `token` |

## 用法

```powershell
tencent-docs tools                                  # 列出远程 MCP 工具
tencent-docs call <tool> [argsJson|@file|-]         # 通用工具调用，- 表示从 stdin 读 JSON

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

通用选项：`--pretty` 格式化输出；`--timeout=毫秒` 调整单请求超时。

## token 来源

优先级：`--token-file PATH` → `--config PATH`（auth-center 风格，读其中的 `token`）→ 默认 auth-center 的 `tencent-docs` 配置。

- token 不打印、不进命令参数；临时 token 文件由 `vault-ops` 技能注入，用完立即删除
- 登录与刷新走 `auth-center`：`auth login tencent-docs`
- 环境变量：`TENCENT_DOCS_TOKEN_FILE`、`TENCENT_DOCS_AUTH_CONFIG`

## 约束

- 写入前先读现状，写入后读回校验；不整表覆盖
- 普通表格坐标 0-based，表头行需按文档实际结构定位
- 腾讯文档免费额度 2000 次/天，每次 `tools/call` 计一次
- 本 CLI 只管腾讯文档；其它远程 MCP 用 `mcp`（mcp-client 自带命令），本地 stdio MCP 用对应的域 CLI

## 文档

- [reference.md](./reference.md)：普通表格/智能表格读写、字段值格式、人员列与备注列、常见坑
- [examples.md](./examples.md)：常用调用示例