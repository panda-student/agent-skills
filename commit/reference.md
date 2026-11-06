# Commit 技能参考文档

## 1. 变更分析流程

### 1.1 判断提交范围（escape hatch 优先）

**先检测暂存区是否已有内容**：

```bash
git diff --cached --name-only
```

- **非空** → 仅按暂存区提交（escape hatch，尊重用户显式 `git add` 意图），跳过下方 all 流程
- **为空** → 进入 all 模式，取工作区全部变更

**all 模式：取工作区全部变更**：

```bash
# 获取当前分支
git branch --show-current

# 获取工作区全部变更（含 untracked，前缀 ?? 表示新文件）
git status --porcelain

# 已跟踪文件的详细 diff
git diff -- <file>

# untracked 新文件内容（直接读取文件）
cat -- <new-file>

# 变更统计
git diff --stat
```

### 1.2 应用排除清单

按 SKILL.md「排除清单」剔除敏感/噪音文件（不 add、不提交），命中时提示用户已跳过。

**补充模式**（视项目情况扩展，主表见 SKILL.md）：

| 类别 | 扩展模式 |
|------|---------|
| 密钥 | `*.pfx`、`*.keystore`、`secrets.*` |
| 编辑器临时 | `*.swo` |
| 备份 | `*.bak`、`*.orig` |
| 编译产物 | `*.class`、`*.pyc` |

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
|--------|---------|
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
<zentao-id>-feat(模块): 简短描述

- 新增功能点1
- 新增功能点2

Closes #123
```

### 3.2 Bug 修复

```
<zentao-id>-fix(模块): 修复问题描述

问题描述：
- 问题现象

修复方案：
- 解决方法

Fixes #456
```

### 3.3 配置变更

```
<zentao-id>-chore: 更新依赖/配置

- 更新 xxx 到 x.x.x
- 修改 xxx 配置项
```

### 3.4 代码重构

```
<zentao-id>-refactor(模块): 重构描述

重构原因：
- 原有设计的问题

改进方案：
- 新的实现方式
```

## 4. 执行命令

**all 模式**：按分类组先 `git add` 再 `git commit`：

```bash
# 按组 add 后提交
git add <file1> <file2>
git commit -m "<zentao-id>-<type>(<scope>): <subject>"

# 多行提交信息
git commit -m "<subject>" -m "<body content>"
```

**escape hatch 模式**（暂存区已有内容）：直接 `git commit`，无需再 add。

> 提交信息前缀必须含禅道编号，格式见 SKILL.md「提交信息格式」。

## 5. 异常处理

| 异常 | 处理方式 |
|------|---------|
| 命中排除清单 | 提示已跳过该文件，不 add |
| 工作区无变更（all 模式） | 提示无可提交内容 |
| 暂存区无变更（escape hatch 触发时） | 自动回退到 all 模式 |
| 文件过大 | 警告并询问是否继续 |
| 合并冲突 | 提示先解决冲突后重试 |
