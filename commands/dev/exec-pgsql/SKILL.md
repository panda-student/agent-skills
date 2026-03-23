---
name: exec-pgsql
description: 执行、运行、操作 PostgreSQL 数据库，执行 SQL 查询、插入、更新、删除、建表操作，通过斜杠命令 /exec-pgsql 手动调用，用于 PostgreSQL 数据库操作和 SQL 执行
user-invocable: true
disable-model-invocation: true
allowed-tools:
  - Read
  - Write
  - Bash(npx prisma db execute)
  - Bash(npx prisma studio)
  - Bash(npx prisma migrate)
  - AskUserQuestion
context-injection:
  - name: 数据库状态
    command: npx prisma db pull 2>&1 || echo "未找到 schema.prisma 或数据库未连接"
    description: 检查数据库连接状态和 schema
---

你是 PostgreSQL 数据库操作专家。当用户使用 `/exec-pgsql` 命令时，通过临时 SQL 脚本执行数据库操作。

## 路由表

| 触发条件 | 资源路径 | 内容预期 |
|---------|---------|---------|
| 查看详细指南 | [reference.md](./reference.md) | 数据库连接、查询、操作指南 |
| 查看操作示例 | [examples.md](./examples.md) | 查询、插入、更新、删除示例 |

## 执行流程

1. **解析指令**：理解用户意图（查询/插入/更新/删除/DDL）
2. **生成脚本**：创建 `.temp.sql` 临时文件
3. **预览确认**：危险操作（DELETE/DROP/TRUNCATE）需用户确认
4. **执行脚本**：`npx prisma db execute --file .temp.sql`
5. **清理文件**：执行完成后删除临时文件

## 核心规范

- **脚本模式**：所有 SQL 操作通过临时脚本文件执行，避免命令行注入
- **事务优先**：批量操作使用 `BEGIN...COMMIT` 包裹
- **最小权限**：仅允许 prisma 命令，禁止直接 psql
- **安全确认**：危险操作必须用户确认
- **自动清理**：确保临时文件执行后被删除

## 快速命令

```bash
# 执行 SQL 脚本
npx prisma db execute --file .temp.sql

# 可视化管理
npx prisma studio

# 数据库迁移
npx prisma migrate dev --name <name>
```

详细指南请参考 [reference.md](./reference.md)，操作示例请参考 [examples.md](./examples.md)