# SQL 执行操作示例

## 示例 1：基础查询

### 用户指令
```
查询所有用户
```

### 执行脚本
```bash
# 生成脚本
cat > .temp.sql << 'EOF'
SELECT id, name, email, created_at FROM users ORDER BY created_at DESC;
EOF

# 执行并清理
npx prisma db execute --file .temp.sql && rm -f .temp.sql
```

---

## 示例 2：批量插入（事务）

### 用户指令
```
插入3个用户：张三、李四、王五
```

### 执行脚本
```bash
cat > .temp.sql << 'EOF'
BEGIN;
INSERT INTO users (name, email, created_at) VALUES
  ('张三', 'zhangsan@example.com', NOW()),
  ('李四', 'lisi@example.com', NOW()),
  ('王五', 'wangwu@example.com', NOW());
COMMIT;
EOF

npx prisma db execute --file .temp.sql && rm -f .temp.sql
```

---

## 示例 3：更新操作（需确认）

### 用户指令
```
把张三的状态改为激活
```

### 执行脚本
```bash
cat > .temp.sql << 'EOF'
UPDATE users SET status = 'active', updated_at = NOW()
WHERE name = '张三';
EOF

# 预览确认
echo "即将执行:"; cat .temp.sql
# 用户确认后执行
npx prisma db execute --file .temp.sql && rm -f .temp.sql
```

---

## 示例 4：删除操作（危险确认）

### 用户指令
```
删除未激活用户
```

### 执行脚本
```bash
cat > .temp.sql << 'EOF'
-- 危险操作：删除数据
DELETE FROM users WHERE status = 'inactive';
EOF

# 强制预览确认
echo "⚠️ 危险操作，即将执行:"; cat .temp.sql
read -p "确认删除？(y/n): "
# 确认后执行
npx prisma db execute --file .temp.sql && rm -f .temp.sql
```

---

## 示例 5：创建表和索引

### 用户指令
```
创建订单表，带索引
```

### 执行脚本
```bash
cat > .temp.sql << 'EOF'
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  total DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
EOF

npx prisma db execute --file .temp.sql && rm -f .temp.sql
```

---

## 示例 6：复杂事务

### 用户指令
```
创建订单并扣库存
```

### 执行脚本
```bash
cat > .temp.sql << 'EOF'
BEGIN;

-- 创建订单
INSERT INTO orders (user_id, total, status)
VALUES (1, 299.00, 'paid') RETURNING id;

-- 扣减库存
UPDATE products SET stock = stock - 1
WHERE id = 101 AND stock > 0;

-- 记录日志
INSERT INTO order_logs (order_id, action)
VALUES (currval('orders_id_seq'), 'created');

COMMIT;
EOF

npx prisma db execute --file .temp.sql && rm -f .temp.sql
```

---

## 错误处理

| 错误类型 | 处理方式 |
|---------|---------|
| 连接失败 | 检查 DATABASE_URL 配置 |
| 语法错误 | 显示错误行，提示修正 |
| 权限不足 | 提示联系 DBA |
| 外键约束 | 提示关联数据问题 |

---

## 安全检查清单

- [ ] 脚本使用 `.temp.sql` 临时文件
- [ ] 删除/更新操作已预览确认
- [ ] 批量操作使用事务包裹
- [ ] 执行后清理临时文件