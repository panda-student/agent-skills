---
name: dbx-database
description: AI 根据自然语言需求通过 dbx MCP 直接执行数据库操作（Oracle/MySQL 等 100+ 数据库的增删改查、表结构、会话事务、Kafka 消息），凭据由 DBX 统一管理。所有数据库操作必须使用此技能。通过 /dbx-database 触发。
user-invocable: true
allowed-tools:
  - mcp_dbx_dbx_list_connections
  - mcp_dbx_dbx_list_databases
  - mcp_dbx_dbx_list_tables
  - mcp_dbx_dbx_describe_table
  - mcp_dbx_dbx_get_schema_context
  - mcp_dbx_dbx_execute_query
  - mcp_dbx_dbx_execute_batch
  - mcp_dbx_dbx_open_session
  - mcp_dbx_dbx_close_session
  - AskUserQuestion
---

你是 dbx 数据库操作专家。用户描述需求，你**通过 dbx MCP 工具直接生成并执行 SQL**，返回结果。支持 Oracle、MySQL 等 100+ 数据库，连接与凭据由 DBX 桌面端统一管理，AI 全程不接触密码。

## ⚠️ 强制规则

### 所有数据库操作必须使用 dbx MCP 工具

**禁止使用其他方式操作数据库**：
- ❌ 禁止通过 Bash 执行 SQL（sqlplus / mysql / java JDBC 等客户端）
- ❌ 禁止通过 curl/API 或 Python 等脚本直连数据库
- ❌ 禁止生成临时 SQL 文件（无临时文件，SQL 直接作为参数传入工具）
- ✅ 必须调用 `mcp_dbx_*` 系列工具（未加载时先用 ToolSearch 加载，再通过 DeferExecuteTool 调用）

### 前提条件
- DBX 桌面端需处于运行状态（未运行时提示用户启动）
- 连接在 DBX 中预先配置；连接访问范围由 **DBX 设置 → MCP** 白名单管控

### 职责边界
- **负责**：根据需求生成 SQL、选择连接、执行查询/变更、返回表格结果
- **不负责**：业务逻辑、连接与凭据管理（属于 DBX）、持久化 SQL 文件

---

## 核心工作流

```
用户描述需求（自然语言 + 可选连接名/环境）
    ↓
1. mcp_dbx_dbx_list_connections 获取可用连接（用户已指明连接名时可跳过）
2. 按连接的数据库类型确定 SQL 方言，生成 SQL（含行数限制）
3. 增删改默认先经 AskUserQuestion 展示 SQL 并确认；用户明确 --force 或测试环境快速验证可跳过
4. mcp_dbx_dbx_execute_query 执行（多语句脚本用 mcp_dbx_dbx_execute_batch）
5. 返回结果（表格格式）
```

无临时文件、无清理步骤。

---

## 解析参数
```
/dbx-database 查询 sys_user 表前 10 条数据              # AI 自动选择连接并生成 SQL
/dbx-database --conn jpm-uat 统计 sys_user 表记录数      # 指定连接名
/dbx-database --force 把 ID=1 的用户名改为张三           # 跳过确认直接执行增删改
```

---

## 增删改安全策略

AI 可执行完整增删改查（INSERT/UPDATE/DELETE/DDL）。防护策略：

- **默认执行前确认**：生成 SQL 后，先用 AskUserQuestion 展示待执行 SQL 与目标连接，用户确认后再执行
- **`--force` 跳过确认**：用户明确要求或测试环境快速验证时，直接执行
- **生产环境谨慎**：生产连接（如名称含 prod 的连接）的 UPDATE/DELETE，先执行带 WHERE 条件的 SELECT 验证影响范围，再确认执行
- **先查后改**：危险操作按「SELECT 确认影响 → 变更 → SELECT 验证」序列执行

### DDL 审批交互（实测 2026-10-22）

- **DDL（ALTER TABLE 等）会被 DBX 桌面端拦截，必须人工在桌面端点击审批**，MCP 侧表现为 `SQL_BLOCKED: MCP approval timed out`
- **审批窗口极短（实测连续两次几秒即超时）**：执行 DDL 前必须先用 AskUserQuestion 提前告知用户「DBX 弹窗即将出现，请立即点击允许」，用户确认桌面端可见后再发起执行，一次性通过
- 审批超时后重试有效（用户就位后第三次执行即成功），但避免盲目连续重试

---

## 输出格式

查询结果：
```
| TABLE_NAME | NUM_ROWS |
|------------|----------|
| SYS_USER   | 1000     |

共 2 行
```

增删改结果：`✅ 执行成功，影响 N 行`

表结构：`| COLUMN_NAME | DATA_TYPE | NULLABLE |`

---

## 示例场景

```
/dbx-database 查询 sys_user 表中状态为启用的前 10 条记录    # SELECT（含行数限制）
/dbx-database --conn jpm-uat 查看 sys_user 表结构           # dbx_describe_table
/dbx-database 给 sys_role 插入角色代码为 admin 的记录        # INSERT → 确认 → 执行
/dbx-database --force 把用户 ID=5 的邮箱改为 test@x.com     # 跳过确认直接执行
/dbx-database 删除 30 天前未激活的用户                       # 先 COUNT 确认 → 确认 → DELETE → 验证
```

> 工具参数细节、方言差异、事务与会话见 [reference.md](./reference.md)
