---
name: "commit"
description: "智能分析Git工作区变更并分类提交。当用户需要提交代码或使用/commit命令时触发，自动将工作区修改按类型分组并分次提交，跳过敏感/噪音文件。"
user-invocable: true
disable-model-invocation: true
allowed-tools:
  - RunCommand
  - Read
  - Grep
  - Glob
  - AskUserQuestion
---

你是 Git 提交专家。当用户使用 `/commit` 命令时，智能分析工作区变更内容，按类型分类并分次提交。

## 默认行为

- **模式**：auto（直接执行提交）
- **范围**：all（工作区全部变更，含 untracked 新文件）
- **暂存区优先（escape hatch）**：若暂存区已有 `git add` 的内容，则仅提交暂存区，尊重用户显式意图
- **排除清单**：自动跳过敏感/噪音文件（密钥、日志、IDE 配置、构建产物等，详见下方「排除清单」）

## 执行流程

1. **检测子模块变更**：执行 `bash SKILL_DIR/git-status-all.sh` 检查所有子模块
   - 如有子模块变更，纳入后续分类提交流程

2. **判断提交范围**：
   - `git diff --cached --name-only` 非空 → 仅按**暂存区**提交（escape hatch，尊重用户显式 `git add`）
   - 否则 → 取**工作区全部变更**（`git status --porcelain`，含 untracked），应用排除清单后纳入

3. **分析变更内容**：读取每个变更文件的 diff，理解修改意图

4. **智能分类**：根据变更类型进行分组

5. **分次提交**：对每组文件先 `git add <文件>`，再 `git commit`，按分类结果分次执行

## 排除清单

范围为 all 时，自动跳过以下文件（不 add、不提交），命中时提示用户已跳过：

| 模式 | 原因 | 示例 |
|------|------|------|
| `.env*` | 含密钥/敏感配置 | `.env`、`.env.local` |
| 密钥/证书 | 安全风险 | `*.pem`、`*.key`、`id_rsa`、`*.p12` |
| 日志 | 运行时噪音 | `*.log`、`logs/` |
| IDE/编辑器 | 个人环境 | `.idea/`、`.vscode/`、`*.swp` |
| 系统/临时 | 无业务意义 | `.DS_Store`、`Thumbs.db`、`*.tmp` |
| 构建产物 | 可重新生成 | `dist/`、`build/`、`target/`、`node_modules/` |

## 变更分类规则

| 类型 | 前缀 | 说明 | 示例文件 |
|------|------|------|----------|
| 功能 | `feat` | 新功能开发 | 新增组件、API、页面 |
| 修复 | `fix` | Bug 修复 | 修复逻辑错误、异常处理 |
| 文档 | `docs` | 文档更新 | README、注释、文档文件 |
| 配置 | `chore` | 配置变更 | 配置文件、依赖更新 |
| 样式 | `style` | 代码格式 | 格式化、空格、换行 |
| 重构 | `refactor` | 代码重构 | 优化结构、提取方法 |
| 测试 | `test` | 测试相关 | 单元测试、集成测试 |
| 性能 | `perf` | 性能优化 | 算法优化、缓存改进 |

## 提交信息格式

```
<zentao-id>-<type>(<scope>): <subject>

<body>

<footer>
```

### 格式说明
- **zentao-id**：禅道任务编号（从分支名提取，如分支 `18452-feat-xxx` → `18452`）
- **type**：变更类型（feat/fix/docs等）
- **scope**：影响范围（可选，如组件名、模块名）
- **subject**：简短描述（50字符以内，不以句号结尾）
- **body**：详细描述（可选，说明变更原因和内容）
- **footer**：关联信息（可选，如关闭的 issue）

### 禅道编号提取规则

从当前分支名中提取开头的数字串作为禅道编号：

| 分支名 | 提取结果 |
|--------|---------|
| `18452-feat-budget-refactor` | `18452` |
| `szq/26/03/18452-预算包清单` | `18452` |
| `feature/18900-login` | `18900` |
| `hotfix-no-number` | 无，需手动输入 |

**正则**：分支名中第一个连续数字串（`\d+`）

## Windows PowerShell 环境提交规范（硬约束）

在 Windows（PowerShell 5.1）环境执行 git commit 时：

- **禁止** bash 风格 heredoc：`git commit -m "$(cat <<'EOF' ...)"` 会报 `Missing file specification after redirection operator`
- **禁止** `&&`/`||` 链接命令：报 `'&&' is not a valid statement separator`，多命令串行改用 `;`
- **标准做法**：提交信息写入临时文件（UTF-8 无 BOM，避免中文乱码），用 `git commit -F <临时文件>` 传入，提交后删除临时文件
- **推荐路径**：`<项目>/.claude/tmp/commit-msg.txt` 或系统临时目录（提交完成后清理）

已验证：heredoc 方式在 PowerShell 5.1 必失败；`commit -F` 临时文件方式成功。

## 核心规范

- **原子提交**：每个提交只包含一个逻辑变更
- **语义化**：提交信息清晰描述变更意图
- **分类合理**：相关文件归入同一提交
- **回滚友好**：每个提交都可独立回滚
- **需求覆盖自检**：若本次提交涉及需求规格的功能实现（非纯配置/样式/文档/测试），提交前提示用户执行 `/completion-verify` 核对字段与逻辑覆盖度，避免"提交了但字段/逻辑漏"（该技能为手动型，防自动循环，故只提示不自动调）

## 上下文信息

当前分支：!`git branch --show-current`
变更文件：!`git status --porcelain`
最近提交：!`git log -5 --oneline`

## 多仓库（子模块）提交

**检测脚本**：`bash SKILL_DIR/git-status-all.sh [项目根目录] [--diff]`

**提交原则**：
- 子模块各自独立提交（切换到子模块目录执行 git add/commit）
- 主仓库提交子模块指针变更（git add 子模块目录名）

## 技能自包含结构

```
commit/
├── SKILL.md
├── reference.md
└── git-status-all.sh    # 子模块变更检测脚本
```

详细规范请参考 [reference.md](./reference.md)
