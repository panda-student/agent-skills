# dbx-database 参考文档

SKILL.md 的详细规范补充：工具选择指南、参数细节、方言差异、事务与会话、统计避坑。

## dbx 工具选择指南

| 工具 | 用途 | 关键参数 |
|------|------|----------|
| `mcp_dbx_dbx_list_connections` | 列出可用连接（ID/名称/类型/主机/库） | 无参 |
| `mcp_dbx_dbx_list_tables` | 列出库下所有表 | `connection_id`、`database`/`schema` |
| `mcp_dbx_dbx_describe_table` | 查看表结构 | `connection_id`、`database`/`schema`、`table` |
| `mcp_dbx_dbx_get_schema_context` | 获取精简表/列上下文辅助写 SQL | `connection_id`、`tables`（最多 20 张） |
| `mcp_dbx_dbx_execute_query` | 执行单条 SQL / DML | `sql`（必填）、`connection_id`、`max_rows` |
| `mcp_dbx_dbx_execute_batch` | 多语句脚本（逐条执行） | `connection_id`、`sql`、`use_transaction` |
| `mcp_dbx_dbx_open_session` | 开启会话固定连接，跨调用保留 USE/SET 状态 | `connection_id` → 返回 `session_id` |

工具未加载时先 `ToolSearch` 用 `tool_names: ["mcp_dbx_dbx_execute_query"]` 形式加载，再 `DeferExecuteTool` 调用。

## 关键参数细节

- **connection_id**：优先用 `mcp_dbx_dbx_list_connections` 返回的 ID；传 `connection_name` 亦可
- **max_rows**：默认 100，最大 1000（更大的值会被钳制）；统计类查询设 `max_rows: 1` 即可
- **cell_char_limit**：单格字符串默认 200 字符，最大 4000；查看长字段时显式调大
- **session_id**：`execute_query` 传入后走会话固定连接，适合需要 `USE db`、临时变量、事务的连续操作

## 事务执行

- `mcp_dbx_dbx_execute_batch` 支持 `use_transaction: true` 整体提交/回滚
- MySQL 的 DDL（TRUNCATE/ALTER）会隐式提交，事务保护对 DDL 无效
- MySQL 需要 `USE db` 后连续操作时，用 `dbx_open_session` + `session_id`

## AI 生成 SQL 的方言差异

按连接的数据库类型判断方言：

| 场景 | Oracle | MySQL |
|------|--------|-------|
| 行数限制 | `WHERE rownum <= 10`（外层包一层） | `LIMIT 10` |
| 取前 N 按排序 | `SELECT * FROM (SELECT ... ORDER BY x) WHERE rownum <= N` | `SELECT ... ORDER BY x LIMIT N` |
| 取当前时间 | `SYSDATE` | `NOW()` |
| 字符串拼接 | `\|\|` | `CONCAT()` |
| 空值处理 | `NVL(a, b)` | `IFNULL(a, b)` / `COALESCE` |
| 日期格式化 | `TO_CHAR(d, 'YYYY-MM-DD')` | `DATE_FORMAT(d, '%Y-%m-%d')` |
| 自增主键 | 序列 + 触发器 | `AUTO_INCREMENT` |
| 布尔 | `1/0`（NUMBER） | `1/0` 或 `TRUE/FALSE` |

## 统计信息避坑（InnoDB 缓存）

`SHOW TABLE STATUS` 的 `Rows` 列是 InnoDB 估算值，`DELETE`/`TRUNCATE` 后**不会立即刷新**，仍显示旧数字。

验证清空/删除效果时用 `SELECT COUNT(*)`（精确值），两者不一致时以 `COUNT(*)` 为准。判断表是否存在用 `SHOW TABLES LIKE` 或 `mcp_dbx_dbx_list_tables`，不要依赖 information_schema 多行查询的直觉。

## 中文处理

dbx MCP 通过 JSON 返回 UTF-8 文本，无 JVM 终端编码乱码问题，SQL 中可直接写中文，无需 `UNISTR()` / `CONVERT()` 转义。

## 完整示例

```
# 危险操作完整序列（dbx_execute_batch + use_transaction）
SELECT COUNT(*) FROM sys_user WHERE last_login < SYSDATE - 30 AND status = 0;  -- 先确认影响
DELETE FROM sys_user WHERE last_login < SYSDATE - 30 AND status = 0;           -- 执行删除
SELECT COUNT(*) FROM sys_user WHERE last_login < SYSDATE - 30 AND status = 0;  -- 验证结果
```

## 扩展数据库

DBX 内置 100+ 数据库驱动（Oracle、MySQL、PostgreSQL、SQL Server、MongoDB、Redis、Kafka 等）。新数据库类型无需改技能，直接在 DBX 中新建连接即可。
