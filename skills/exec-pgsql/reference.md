# PostgreSQL 操作指南

## 一、快速开始

### 环境配置
```env
# .env 文件（项目根目录）
DATABASE_URL="postgresql://user:password@localhost:5432/mydb?schema=public"
```

### 连接测试
```bash
# 测试连接
npx prisma db pull

# 查看数据库版本
echo "SELECT version();" | npx prisma db execute --stdin
```

---

## 二、执行流程

```
用户指令 → 生成 .temp.sql → 预览确认 → 执行 → 清理
```

### 标准模式
```bash
# 1. 生成脚本
cat > .temp.sql << 'EOF'
你的 SQL 语句
EOF

# 2. 执行并清理
npx prisma db execute --file .temp.sql && rm -f .temp.sql
```

---

## 三、常用操作速查

### 查询
```sql
SELECT * FROM users WHERE status = 'active' ORDER BY created_at DESC;
```

### 插入
```sql
INSERT INTO users (name, email) VALUES ('张三', 'zhang@example.com');
```

### 更新
```sql
UPDATE users SET status = 'active' WHERE id = 1;
```

### 删除
```sql
DELETE FROM users WHERE id = 1;  -- 需确认
```

### 建表
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE
);
```

### 索引
```sql
CREATE INDEX idx_users_email ON users(email);
```

---

## 四、安全规范

### 权限控制
| 操作类型 | 权限要求 | 确认级别 |
|---------|---------|---------|
| SELECT | 只读 | 无需确认 |
| INSERT | 写入 | 无需确认 |
| UPDATE | 写入 | 预览确认 |
| DELETE | 写入 | **强制确认** |
| DROP/TRUNCATE | DDL | **强制确认** |

### SQL 注入防护
```bash
# ✅ 正确：使用脚本文件
cat > .temp.sql << EOF
SELECT * FROM users WHERE name = '${escaped_name}';
EOF

# ❌ 错误：命令行拼接
npx prisma db execute --stdin <<< "SELECT * FROM users WHERE name = '$name'"
```

---

## 五、性能优化

### 查询优化
```sql
-- 使用 EXPLAIN 分析
EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'test@example.com';

-- 查看索引使用
SELECT * FROM pg_stat_user_indexes WHERE tablename = 'users';
```

### 索引建议
| 场景 | 索引类型 |
|-----|---------|
| 等值查询 | B-tree |
| 模糊查询 | GIN/GiST |
| JSON 字段 | GIN |
| 全文搜索 | GIN |

---

## 六、事务处理

```sql
BEGIN;

-- 操作1
INSERT INTO orders (user_id, total) VALUES (1, 100.00);

-- 操作2
UPDATE accounts SET balance = balance - 100.00 WHERE user_id = 1;

-- 操作3
INSERT INTO logs (action) VALUES ('order_created');

COMMIT;  -- 或 ROLLBACK 回滚
```

---

## 七、常用工具

| 命令 | 用途 |
|-----|-----|
| `npx prisma studio` | 可视化管理 |
| `npx prisma migrate dev` | 数据库迁移 |
| `npx prisma db pull` | 同步 schema |
| `npx prisma db push` | 推送 schema |

---

## 八、故障排除

| 问题 | 解决方案 |
|-----|---------|
| 连接失败 | 检查 DATABASE_URL、确认 PostgreSQL 运行中 |
| 认证失败 | 检查用户名密码、pg_hba.conf 配置 |
| 超时 | 检查网络、增加连接池配置 |
| 权限不足 | 联系 DBA 授予权限 |