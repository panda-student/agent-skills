# Commit 技能参考文档

## 1. 变更分析流程

### 1.1 获取变更状态

```bash
# 获取当前分支
git branch --show-current

# 获取变更文件列表
git status --porcelain

# 获取暂存区变更
git diff --cached --name-only

# 获取工作区变更
git diff --name-only

# 获取未跟踪文件
git ls-files --others --exclude-standard
```

### 1.2 分析变更内容

```bash
# 获取文件详细变更
git diff -- <file>

# 获取暂存区详细变更
git diff --cached -- <file>

# 获取变更统计
git diff --stat
```

## 2. 分类策略

### 2.1 文件类型识别

| 文件模式 | 分类建议 |
|----------|----------|
| `*.md` | docs |
| `package.json`, `*.lock` | chore |
| `*.config.js`, `*.json`, `.env*` | chore |
| `*.css`, `*.scss`, `*.less` | style |
| `*.test.*`, `*.spec.*` | test |
| `src/**/*` | 根据内容判断 |

### 2.2 内容分析关键词

| 关键词 | 类型推断 |
|--------|----------|
| 新增、添加、实现 | feat |
| 修复、解决、修正 | fix |
| 优化、重构、改进 | refactor |
| 更新文档、注释 | docs |
| 格式化、缩进 | style |
| 性能、缓存、加速 | perf |

### 2.3 分组原则

1. **功能内聚**：同一功能的修改放在一个提交
2. **层级一致**：同一模块的修改优先归组
3. **依赖顺序**：有依赖关系的修改按顺序提交
4. **大小适中**：单个提交包含 1-10 个文件为宜

## 3. 提交信息模板

### 3.1 功能开发

```
feat(模块): 简短描述

- 新增功能点1
- 新增功能点2

Closes #123
```

### 3.2 Bug 修复

```
fix(模块): 修复问题描述

问题描述：
- 问题现象

修复方案：
- 解决方法

Fixes #456
```

### 3.3 配置变更

```
chore: 更新依赖/配置

- 更新 xxx 到 x.x.x
- 修改 xxx 配置项
```

### 3.4 代码重构

```
refactor(模块): 重构描述

重构原因：
- 原有设计的问题

改进方案：
- 新的实现方式
```

## 4. 执行命令

### 4.1 暂存文件

```bash
# 暂存指定文件
git add <file1> <file2> ...

# 暂存目录
git add <directory>/

# 交互式暂存
git add -p
```

### 4.2 提交变更

```bash
# 提交暂存区
git commit -m "type(scope): subject"

# 提交并添加详细描述
git commit -m "type(scope): subject" -m "body content"

# 使用多行提交信息
git commit -F- <<EOF
type(scope): subject

body content

footer
EOF
```

## 5. 交互流程

### 5.1 展示分类结果

```
📋 变更分类结果：

提交 1 [feat(user)]: 新增用户登录功能
  - src/components/Login.vue
  - src/api/user.js
  - src/store/user.js

提交 2 [fix(cart)]: 修复购物车数量计算错误
  - src/utils/cart.js

提交 3 [docs]: 更新 README 文档
  - README.md
  - docs/api.md

提交 4 [chore]: 更新项目配置
  - package.json
  - vite.config.js
```

### 5.2 确认选项

- **确认提交**：按分类结果执行提交
- **调整分类**：修改文件分组
- **合并提交**：将多个分组合并
- **取消操作**：放弃本次提交

## 6. 异常处理

### 6.1 无变更

```
⚠️ 当前没有需要提交的变更
```

### 6.2 文件过大

```
⚠️ 以下文件变更较大，建议检查：
  - large-file.js (+500/-200 行)

是否继续？
```

### 6.3 合并冲突

```
❌ 存在合并冲突，请先解决：
  - conflicted-file.js

解决方法：
1. 手动编辑冲突文件
2. git add <resolved-file>
3. 重新执行 /commit
```

## 7. 最佳实践

### 7.1 提交粒度

- **太小**：单个文件的小改动可合并
- **适中**：一个完整的功能点
- **太大**：多个功能应拆分提交

### 7.2 提交时机

- 功能完成一个单元时
- 修复一个 Bug 时
- 重构一个模块时
- 下班前保存进度时

### 7.3 避免的情况

- 提交半成品代码
- 提交无法运行的代码
- 一个提交包含多个不相关修改
- 提交信息模糊不清
