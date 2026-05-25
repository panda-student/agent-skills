# Git工作树理论

## 核心定义

Git工作树理论（Git Worktrees Theory）定义了如何创建隔离工作空间的方法论框架，允许同时在多个分支上工作而不切换。

## 核心原则

**系统目录选择 + 安全验证 = 可靠隔离。**

```
┌─────────────────────────────────────────────────────────────┐
│                    工作树架构                                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   主工作目录                                                 │
│   /project/                                                  │
│   ├── main 分支                                              │
│   └── .worktrees/                                            │
│       ├── feature-auth/     ← 功能分支工作树                 │
│       │   └── feature/auth 分支                              │
│       └── bugfix-api/       ← 修复分支工作树                 │
│           └── bugfix/api 分支                                │
│                                                              │
│   每个工作树有独立的工作目录和分支                            │
│   共享同一个Git仓库                                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## 目录选择过程

### 优先级顺序

1. **检查现有目录**
   ```bash
   ls -d .worktrees 2>/dev/null     # 首选（隐藏）
   ls -d worktrees 2>/dev/null      # 替代
   ```

   **如果找到：** 使用该目录。如果两者都存在，`.worktrees`优先。

2. **检查CLAUDE.md**
   ```bash
   grep -i "worktree.*director" CLAUDE.md 2>/dev/null
   ```

   **如果指定偏好：** 不问就使用。

3. **询问用户**

   如果没有目录存在且没有CLAUDE.md偏好：
   ```
   没找到工作树目录。我应该在哪里创建工作树？

   1. .worktrees/（项目本地，隐藏）
   2. ~/.config/superpowers/worktrees/<project-name>/（全局位置）

   你偏好哪个？
   ```

## 安全验证

### 对于项目本地目录（.worktrees或worktrees）

**必须在创建工作树前验证目录被忽略：**

```bash
git check-ignore -q .worktrees 2>/dev/null || git check-ignore -q worktrees 2>/dev/null
```

**如果未被忽略：**

按规则"立即修复损坏的东西"：
1. 添加适当行到.gitignore
2. 提交更改
3. 继续创建工作树

**为什么关键：** 防止意外将工作树内容提交到仓库。

### 对于全局目录（~/.config/superpowers/worktrees）

不需要.gitignore验证 - 完全在项目外部。

## 创建步骤

### 1. 检测项目名称

```bash
project=$(basename "$(git rev-parse --show-toplevel)")
```

### 2. 创建工作树

```bash
# 确定完整路径
case $LOCATION in
  .worktrees|worktrees)
    path="$LOCATION/$BRANCH_NAME"
    ;;
  ~/.config/superpowers/worktrees/*)
    path="~/.config/superpowers/worktrees/$project/$BRANCH_NAME"
    ;;
esac

# 用新分支创建工作树
git worktree add "$path" -b "$BRANCH_NAME"
cd "$path"
```

### 3. 运行项目设置

自动检测并运行适当设置：

```bash
# Node.js
if [ -f package.json ]; then npm install; fi

# Rust
if [ -f Cargo.toml ]; then cargo build; fi

# Python
if [ -f requirements.txt ]; then pip install -r requirements.txt; fi
if [ -f pyproject.toml ]; then poetry install; fi

# Go
if [ -f go.mod ]; then go mod download; fi
```

### 4. 验证干净基线

运行测试确保工作树干净开始：

```bash
npm test
cargo test
pytest
go test ./...
```

**如果测试失败：** 报告失败，询问是否继续或调查。

**如果测试通过：** 报告准备就绪。

### 5. 报告位置

```
工作树准备就绪于<full-path>
测试通过（<N>个测试，0失败）
准备实现<feature-name>
```

## 快速参考

| 情况 | 动作 |
|------|------|
| `.worktrees/`存在 | 使用它（验证忽略） |
| `worktrees/`存在 | 使用它（验证忽略） |
| 两者都存在 | 使用`.worktrees/` |
| 都不存在 | 检查CLAUDE.md → 询问用户 |
| 目录未被忽略 | 添加到.gitignore + 提交 |
| 基线测试失败 | 报告失败 + 询问 |
| 没有package.json/Cargo.toml | 跳过依赖安装 |

## 常见错误

### 跳过忽略验证

- **问题：** 工作树内容被跟踪，污染git状态
- **修复：** 创建项目本地工作树前总是使用`git check-ignore`

### 假设目录位置

- **问题：** 创建不一致，违反项目约定
- **修复：** 遵循优先级：现有 > CLAUDE.md > 询问

### 测试失败就继续

- **问题：** 无法区分新bug和预先存在的问题
- **修复：** 报告失败，获得明确许可继续

### 硬编码设置命令

- **问题：** 在使用不同工具的项目上失败
- **修复：** 从项目文件自动检测（package.json等）

## 完成后清理

当工作完成时：

```bash
# 检查是否在工作树中
git worktree list | grep $(git branch --show-current)

# 如果是
git worktree remove <worktree-path>
```

## 红旗警告

**绝不：**
- 创建工作树不验证忽略（项目本地）
- 跳过基线测试验证
- 测试失败不询问就继续
- 位置模糊时假设目录位置
- 跳过CLAUDE.md检查

**总是：**
- 遵循目录优先级：现有 > CLAUDE.md > 询问
- 验证目录被忽略（项目本地）
- 自动检测并运行项目设置
- 验证干净测试基线

## 与其他理论的关系

| 理论 | 关系 |
|------|------|
| **头脑风暴理论** | 设计批准后创建工作树 |
| **子代理驱动开发** | 工作树提供隔离 |
| **验证理论** | 创建后验证基线 |

## 适用团队类型

| 团队类型 | 应用方式 |
|---------|---------|
| **development** | 开始工作前创建工作树 |
| **testing** | 隔离测试环境 |

## 关键要点

1. **目录优先级** - 现有 > CLAUDE.md > 询问
2. **验证忽略** - 项目本地必须忽略
3. **自动设置** - 检测项目类型
4. **验证基线** - 测试必须通过
5. **完成后清理** - 移除工作树