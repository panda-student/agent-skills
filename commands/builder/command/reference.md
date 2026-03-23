# 任务型 Skill 构建参考规范

# 核心理论

本技能基于核心理论构建，详细内容请参考理论文件：

- **[渐进式披露架构核心理论](./theories/progressive-disclosure.md)**：分层按需加载知识与资源，解决 Token 爆炸问题
- **[任务型 Skills 核心理论](./theories/task-skill-theory.md)**：任务型 Skill 设计原则与核心概念
- **[任务型 Skill 七步设计清单](./theories/task-skill-checklist.md)**：任务型 Skill 实践指南
- **[单一职责原则](./theories/single-responsibility.md)**：每个文件只负责一个明确的功能领域

---

# 任务型 Skill 核心特征

## 核心区别：disable-model-invocation

**这是区分两种 Skill 类型的决定性字段：**

| 类型 | disable-model-invocation | 本质 |
|------|-------------------------|------|
| **参考型** | `false` 或不设置 | 知识提供者（Claude 可主动调用） |
| **任务型** | `true` | 动作执行者（必须用户手动触发） |

任务型 Skill 绝不让 Claude 自作主张触发，必须由用户显式调用。

## 触发方式
- **斜杠命令手动触发**：用户必须使用 `/xxx` 命令显式调用
- **禁用模型调用**：必须设置 `disable-model-invocation: true`

## 适用场景
- 执行操作、部署、脚本、流程
- 代码生成、文件修改
- 系统配置、环境搭建
- 自动化任务、批处理

## 核心特点
- 包含具体执行步骤和操作指令
- 可能包含副作用操作（文件修改、部署等）
- 仅允许用户手动触发，不允许模型主动执行

## 示例
`make-app`、`run-app`、`check-code`、`fix-bug`、`test-all`

---

# Frontmatter 配置

## 标准配置
```yaml
---
name: skill-name
description: 功能描述 + 执行方式 + 触发场景
user-invocable: true
disable-model-invocation: true
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
---
```

## 配置说明
| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| name | string | 是 | Skill 名称，需与目录名一致 |
| description | string | 是 | Skill 描述，遵循公式 |
| user-invocable | boolean | **是** | 必须设置为 true |
| disable-model-invocation | boolean | **是** | 必须设置为 true |
| allowed-tools | array | 否 | 限制可使用的工具 |

---

# 命名规则

## 基本原则
- 使用小写字母
- 使用连字符分隔单词
- 使用动词+最简词形式
- 避免缩写和数字

## 命名规范（动词+最简词）
- **词性组合**：动词+最简词，强调执行动作
- **示例**：`make-app`（创建应用）、`run-app`（运行应用）、`check-code`（检查代码）
- **记忆口诀**：动词=执行
- **命名模式**：`[动作]-[对象]`，如 `build-app`、`fix-bug`、`test-all`
- **简化原则**：使用最简单的单词（make、run、check、fix、test），避免复杂词汇

## 命名示例
| ✅ 正确 | ❌ 错误 |
|---------|---------|
| `make-app`、`run-app` | `CreateApp`, `create_app`, `create-application` |
| `check-code`、`fix-bug` | `ReviewCode`, `review_code`, `review-code` |
| `test-all`、`build-app` | `RunAllTests`, `run_all_tests` |

---

# Description 编写公式

**标准公式**：`功能描述 + 执行方式 + 触发场景`

## 优化原则：提高自动触发概率

### 1. 关键词覆盖策略
- **同义词覆盖**：包含多个同义词，提高匹配概率
  - 创建、编写、制作、生成、构建、开发、设计
  - Skill、技能、命令、工具、扩展

### 2. 场景关键词
- 描述用户可能的使用场景
- 包含用户常见的表达方式
- 例如："在用户需要创建命令、编写斜杠命令、制作执行任务时自动触发"

### 3. 触发时机关键词
- 明确说明何时自动触发
- 例如："在用户...时自动触发"

## 任务型示例
- ✅ `创建、编写、制作、生成符合项目规范的 React 组件，通过斜杠命令 /make-component 触发，在用户需要创建组件、编写 UI、制作页面元素时自动提示，用于快速生成标准化组件代码`
- ❌ `创建组件`（过于简单，触发概率低）

---

# 权限控制配置

## allowed-tools
限制 Skill 可使用的工具列表

### 任务型 Skill（读写）
```yaml
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
  - AskUserQuestion
```

### 精确权限控制（推荐）
```yaml
allowed-tools:
  - Read
  - Write
  - Bash(npm run build)
  - Bash(git push)
```

**原则**：不使用 `Bash(*)`，遵循最小权限原则

## disable-model-invocation
禁用模型调用能力（任务型 Skill **必需**）

**核心逻辑**：此字段决定了 Skill 是"知识提供者"还是"动作执行者"。任务型绝不让 Claude 自作主张触发。

```yaml
disable-model-invocation: true
```

## user-invocable
是否允许用户直接调用
```yaml
user-invocable: true
```

---

# 上下文注入配置

## 概述

上下文注入（Context Injection）允许在 Skill 加载时预执行命令并注入上下文，减少运行时的模型调用次数，提高响应效率。

## 核心优势

| 优势 | 说明 |
|------|------|
| **减少模型调用** | 预加载所需信息，避免运行时重复查询 |
| **提高响应速度** | 上下文随 Skill 加载，无需等待额外命令执行 |
| **统一信息基准** | 确保 Skill 执行时拥有完整的项目上下文 |
| **降低 Token 消耗** | 一次注入，多次使用 |

## 配置格式

```yaml
context-injection:
  - name: context-name        # 上下文标识符（唯一）
    command: shell-command    # 要执行的命令
    description: 用途说明      # 该上下文的用途描述
```

## 配置示例

### 示例 1：部署类 Skill
```yaml
context-injection:
  - name: git-branch
    command: git branch --show-current
    description: 当前 Git 分支
  - name: recent-commits
    command: git log -3 --oneline
    description: 最近提交记录
  - name: uncommitted-changes
    command: git status --short
    description: 未提交的更改
```

### 示例 2：代码审查类 Skill
```yaml
context-injection:
  - name: project-structure
    command: find . -type f \( -name "*.ts" -o -name "*.tsx" \) | head -20
    description: 项目文件结构概览
  - name: package-info
    command: cat package.json
    description: 项目依赖和配置
  - name: lint-errors
    command: npm run lint 2>&1 || true
    description: 当前 lint 错误
```

### 示例 3：数据库操作类 Skill
```yaml
context-injection:
  - name: db-schema
    command: cat schema.sql 2>/dev/null || echo "No schema file"
    description: 数据库 schema 定义
  - name: db-config
    command: cat .env 2>/dev/null | grep DB_ || echo "No DB config"
    description: 数据库连接配置
```

## 设计原则

### 1. 必要性原则
只注入 Skill 执行**必需**的上下文，避免冗余信息。

```yaml
# ✅ 正确：只注入必要信息
context-injection:
  - name: git-branch
    command: git branch --show-current
    description: 当前分支

# ❌ 错误：注入过多冗余信息
context-injection:
  - name: full-git-log
    command: git log --all --oneline
    description: 所有提交历史
```

### 2. 轻量化原则
命令输出应保持简洁，避免大量输出消耗 Token。

```yaml
# ✅ 正确：限制输出行数
context-injection:
  - name: recent-commits
    command: git log -3 --oneline
    description: 最近3次提交

# ❌ 错误：无限制输出
context-injection:
  - name: all-commits
    command: git log --oneline
    description: 所有提交
```

### 3. 容错性原则
命令应具备容错能力，避免因文件不存在等原因导致加载失败。

```yaml
# ✅ 正确：提供默认值
context-injection:
  - name: db-schema
    command: cat schema.sql 2>/dev/null || echo "No schema file"
    description: 数据库 schema

# ❌ 错误：无容错处理
context-injection:
  - name: db-schema
    command: cat schema.sql
    description: 数据库 schema
```

### 4. 安全性原则
避免注入敏感信息，对敏感数据进行脱敏处理。

```yaml
# ✅ 正确：过滤敏感信息
context-injection:
  - name: db-config
    command: cat .env | grep DB_HOST || echo "No config"
    description: 数据库主机配置

# ❌ 错误：暴露敏感信息
context-injection:
  - name: db-config
    command: cat .env
    description: 数据库配置（包含密码）
```

## 上下文类型分类

| 类型 | 典型命令 | 适用场景 |
|------|---------|---------|
| **项目信息** | `cat package.json` | 了解技术栈、依赖版本 |
| **Git 状态** | `git branch --show-current` | 部署、发布类 Skill |
| **文件结构** | `find . -type f ...` | 代码审查、重构类 Skill |
| **配置信息** | `cat tsconfig.json` | 类型检查、构建类 Skill |
| **运行状态** | `npm run lint 2>&1` | 质量检查类 Skill |

## 在 SKILL.md 中使用注入的上下文

注入的上下文会作为 Skill 加载时的前置信息，可在 Skill 的提示词中直接引用：

```markdown
---
name: run-app
context-injection:
  - name: git-branch
    command: git branch --show-current
    description: 当前分支
---

你是应用部署专家。当前分支信息已预加载，请根据分支状态决定部署策略。

## 安全检查
- 当前分支必须为 main 才能部署到生产环境
- 如有未提交更改，需提醒用户
```

---

# 目录结构标准

```
.claude/skills/
├── [skill-name]/
│   ├── SKILL.md          # 主入口文件（必需，≤500行）
│   ├── reference.md      # 参考文档（可选）
│   ├── examples.md       # 示例文档（可选）
│   ├── theories/         # 理论文件（可选）
│   └── templates/        # 模板文件（可选）
```

## 文件职责（遵循单一职责原则）
- **SKILL.md**：智能路由器，只负责路由和核心提示
- **reference.md**：详细规范，只负责规范说明
- **examples.md**：示例文档，只负责示例展示
- **theories/**：理论文件，只负责理论阐述
- **templates/**：模板文件，只负责模板定义

---

# 交互流程详解

## 第一步：确认类型（1个问题）
确认用户要创建任务型 Skill

## 第二步：收集核心信息（2-3个问题）

### 2.1 Skill 名称
- 输入 Skill 名称（遵循命名规则：动词+最简词）
- 系统自动验证命名规范

### 2.2 Skill 描述与功能（合并）
- 输入 Skill 描述（遵循 Description 公式：功能描述 + 执行方式 + 触发场景）
- 系统自动提取主要功能

### 2.3 功能用途（可选）
- 如描述不够清晰，询问主要功能用途
- 提供常见选项供快速选择

## 第三步：智能配置（0-1个问题）

### 任务型 Skill（自动配置）
系统自动设置：
- `disable-model-invocation: true`
- `user-invocable: true`
- `allowed-tools`: 根据功能用途智能推荐

**可选问题**：
- 是否需要自定义权限配置？（默认使用智能推荐）

## 第四步：文件结构选择（1个问题）
需要创建哪些文件？
- A. 仅 SKILL.md（快速模式）
- B. SKILL.md + reference.md（标准模式）
- C. SKILL.md + reference.md + examples.md（完整模式）
- D. SKILL.md + reference.md + examples.md + templates/（最完整）

## 第五步：输出完整内容（自动）
一次性输出：
- 标准目录结构
- 完整可复制 SKILL.md（frontmatter + markdown 正文）
- 触发方式与使用示例
- 工程化优化建议

## 第六步：测试验证（引导）
创建完成后，引导用户测试命令是否满足预期：
- 提供测试清单链接
- 指导测试方法
- 提供问题排查建议

---

# 最佳实践建议

## 1. 遵循渐进式披露原则
SKILL.md 定位为智能路由器，只包含核心提示和路由表，避免冗长的详细内容。

## 2. 遵循单一职责原则
每个文件只负责一个明确的功能领域，避免职责混杂。

## 3. 必须设置 disable-model-invocation
任务型 Skill 必须设置 `disable-model-invocation: true`，防止模型主动执行。

## 4. 遵循最小权限原则
精确授权到子命令，不使用 `Bash(*)`，避免安全风险。

## 5. 合理拆分内容
- 高频核心语义 → SKILL.md（内联）
- 低频细节、示例、数据 → reference.md、examples.md（外置）
- 核心理论 → theories/（独立管理）
- 可复用模板 → templates/

## 6. 提供清晰的使用说明
在 SKILL.md 中明确说明触发方式和使用场景。

## 7. 定期维护更新
随着项目发展，及时更新 Skill 内容以保持其有效性。

## 8. 遵循行数规范
- SKILL.md：≤500 行（遵循 500 行上限原则）
- reference.md：按需设置
- examples.md：按需设置