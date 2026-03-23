# 参考型 Skill 构建参考规范

# 核心理论

本技能基于核心理论构建，详细内容请参考理论文件：

- **[渐进式披露架构核心理论](./theories/progressive-disclosure.md)**：分层按需加载知识与资源，解决 Token 爆炸问题
- **[参考型 Skills 核心理论](./theories/reference-skill-theory.md)**：参考型 Skill 设计原则与最佳实践
- **[单一职责原则](./theories/single-responsibility.md)**：每个文件只负责一个明确的功能领域

---

# 参考型 Skill 核心特征

## 核心区别：disable-model-invocation

**这是区分两种 Skill 类型的决定性字段：**

| 类型 | disable-model-invocation | 本质 |
|------|-------------------------|------|
| **参考型** | `false` 或不设置 | 知识提供者（Claude 可主动调用） |
| **任务型** | `true` | 动作执行者（必须用户手动触发） |

## 触发方式
- **语义自动触发**：当用户讨论相关话题时，模型会自动加载对应的 Skill
- **无需手动调用**：不需要用户使用斜杠命令显式调用

## 适用场景
- 规范、知识、风格、约定
- API 设计规范、代码风格规范
- Git 工作流规范、架构指南
- 安全规范、最佳实践

## 核心特点
- 无执行步骤，提供参考信息
- 内容以知识、规范、标准为主
- 无副作用操作
- 允许模型主动加载和引用

## 示例
`api-rule`、`style-guide`、`git-flow`、`arch-guide`、`security-rule`

---

# Frontmatter 配置

## 标准配置
```yaml
---
name: skill-name
description: 功能描述 + 执行方式 + 触发场景
allowed-tools:
  - Read
  - Grep
  - Glob
---
```

## 配置说明
| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| name | string | 是 | Skill 名称，需与目录名一致 |
| description | string | 是 | Skill 描述，遵循公式 |
| allowed-tools | array | 否 | 限制可使用的工具（默认只读） |

**注意**：参考型 Skill **不需要** `disable-model-invocation` 和 `user-invocable` 配置

---

# 命名规则

## 基本原则
- 使用小写字母
- 使用连字符分隔单词
- 使用名词+最简词形式
- 避免缩写和数字

## 命名规范（名词+最简词）
- **词性组合**：名词+最简词，强调知识领域
- **示例**：`api-rule`（API规则）、`style-guide`（风格指南）、`git-flow`（Git流程）
- **记忆口诀**：名词=知识
- **命名模式**：`[领域]-[类型]`，如 `security-rule`、`arch-guide`
- **简化原则**：使用最简单的单词（rule、guide、flow），避免复杂词汇

## 命名示例
| ✅ 正确 | ❌ 错误 |
|---------|---------|
| `api-rule`、`style-guide` | `APIConvention`, `api_convention`, `api-convention` |
| `git-flow`、`arch-guide` | `GitWorkflow`, `git_workflow`, `git-workflow` |
| `security-rule` | `SecurityGuideline`, `security_guideline` |

---

# Description 编写公式

**标准公式**：`功能描述 + 执行方式 + 触发场景`

## 优化原则：提高自动触发概率

### 1. 关键词覆盖策略
- **同义词覆盖**：包含多个同义词，提高匹配概率
  - 定义、制定、规范、标准、约定
  - Skill、技能、规范、指南

### 2. 场景关键词
- 描述用户可能的使用场景
- 包含用户常见的表达方式
- 例如："在编写/审查接口、设计新API、确定请求响应格式时自动使用"

### 3. 触发时机关键词
- 明确说明何时自动触发
- 例如："在用户...时自动使用"

## 参考型示例
- ✅ `定义、制定、规范项目 RESTful API 设计标准，包含URL命名、响应格式、状态码与鉴权规则，在编写/审查接口、设计新API、确定请求响应格式时自动使用`
- ❌ `API 规范`（过于简单，触发概率低）

---

# 权限控制配置

## allowed-tools
参考型 Skill 默认使用只读权限，确保不会对项目产生副作用：

```yaml
allowed-tools:
  - Read
  - Grep
  - Glob
```

## disable-model-invocation
参考型 Skill **不设置此字段**（或设置为 false），允许模型作为"知识提供者"主动调用。

---

# 上下文注入配置

## 概述

上下文注入（Context Injection）允许在参考型 Skill 加载时预执行命令并注入上下文，使 Skill 能够基于项目实际状态提供更精准的建议，减少运行时查询。

## 核心优势

| 优势 | 说明 |
|------|------|
| **上下文感知** | 基于项目实际状态提供建议，而非通用规则 |
| **一致性保证** | 了解现有代码风格，确保建议与项目一致 |
| **减少重复查询** | 预加载常用信息，避免每次都重新查询 |
| **提高建议质量** | 有上下文的建议更精准、更有针对性 |

## 配置格式

```yaml
context-injection:
  - name: context-name        # 上下文标识符（唯一）
    command: shell-command    # 要执行的命令
    description: 用途说明      # 该上下文的用途描述
```

## 配置示例

### 示例 1：API 规范类 Skill
```yaml
context-injection:
  - name: existing-api-files
    command: find . -type f \( -name "*api*" -o -name "*route*" \) | head -10
    description: 现有 API 文件列表
  - name: api-base-url
    command: cat .env 2>/dev/null | grep API_BASE || echo "No API base URL"
    description: API 基础 URL 配置
```

### 示例 2：代码风格类 Skill
```yaml
context-injection:
  - name: lint-config
    command: cat .eslintrc.* 2>/dev/null || cat .prettierrc* 2>/dev/null || echo "No lint config"
    description: 现有 lint 配置
  - name: tsconfig
    command: cat tsconfig.json 2>/dev/null || echo "No tsconfig"
    description: TypeScript 配置
  - name: existing-style-patterns
    command: find . -name "*.ts" | head -5 | xargs head -50 2>/dev/null
    description: 现有代码风格样本
```

### 示例 3：Git 工作流类 Skill
```yaml
context-injection:
  - name: current-branch
    command: git branch --show-current 2>/dev/null || echo "Not a git repo"
    description: 当前分支
  - name: branch-list
    command: git branch -a 2>/dev/null | head -10 || echo "No branches"
    description: 分支列表
  - name: recent-commits
    command: git log --oneline -5 2>/dev/null || echo "No commits"
    description: 最近提交记录
```

### 示例 4：安全规范类 Skill
```yaml
context-injection:
  - name: auth-config
    command: find . -name "*auth*" -o -name "*security*" | head -5
    description: 现有认证相关文件
  - name: env-template
    command: cat .env.example 2>/dev/null || echo "No .env.example"
    description: 环境变量模板
  - name: dependency-audit
    command: npm audit --json 2>/dev/null | head -50 || echo "No audit data"
    description: 依赖安全审计结果
```

## 设计原则

### 1. 相关性原则
注入的上下文应与 Skill 的知识领域直接相关。

```yaml
# ✅ 正确：API 规范 Skill 注入 API 相关信息
context-injection:
  - name: existing-api-files
    command: find . -name "*api*"
    description: 现有 API 文件

# ❌ 错误：API 规范 Skill 注入无关信息
context-injection:
  - name: database-schema
    command: cat schema.sql
    description: 数据库 schema
```

### 2. 轻量化原则
参考型 Skill 可能被频繁触发，注入内容应保持简洁。

```yaml
# ✅ 正确：限制输出
context-injection:
  - name: recent-commits
    command: git log --oneline -5
    description: 最近5次提交

# ❌ 错误：输出过多
context-injection:
  - name: all-commits
    command: git log --oneline
    description: 所有提交
```

### 3. 容错性原则
命令应具备容错能力，避免因环境差异导致加载失败。

```yaml
# ✅ 正确：提供默认值
context-injection:
  - name: lint-config
    command: cat .eslintrc.* 2>/dev/null || echo "No lint config"
    description: lint 配置

# ❌ 错误：无容错处理
context-injection:
  - name: lint-config
    command: cat .eslintrc.json
    description: lint 配置
```

### 4. 安全性原则
避免注入敏感信息，参考型 Skill 应只加载脱敏后的配置。

```yaml
# ✅ 正确：使用模板文件
context-injection:
  - name: env-template
    command: cat .env.example
    description: 环境变量模板

# ❌ 错误：加载实际环境变量
context-injection:
  - name: env-actual
    command: cat .env
    description: 环境变量（包含敏感信息）
```

## 上下文类型分类

| 类型 | 典型命令 | 适用 Skill 类型 |
|------|---------|----------------|
| **配置文件** | `cat .eslintrc.*` | 代码风格、规范类 |
| **项目结构** | `find . -type f ...` | 架构、API 规范类 |
| **Git 状态** | `git branch --show-current` | Git 工作流类 |
| **依赖信息** | `cat package.json` | 技术栈、框架类 |
| **安全审计** | `npm audit --json` | 安全规范类 |

## 参考型 vs 任务型上下文注入差异

| 维度 | 参考型 Skill | 任务型 Skill |
|------|-------------|-------------|
| **触发频率** | 高（语义自动触发） | 低（手动触发） |
| **注入内容** | 轻量、只读 | 可更详细 |
| **主要目的** | 提供上下文感知建议 | 减少执行时确认步骤 |
| **安全要求** | 更严格（避免敏感信息） | 相对宽松 |

## 在 SKILL.md 中使用注入的上下文

注入的上下文会作为 Skill 加载时的前置信息，可在提示词中直接引用：

```markdown
---
name: style-guide
context-injection:
  - name: lint-config
    command: cat .eslintrc.* 2>/dev/null || echo "No lint config"
    description: 现有 lint 配置
---

你是项目的代码风格规范专家。已预加载项目的 lint 配置，请基于现有配置提供风格建议。

## 核心规范
- 遵循项目已有的 lint 规则
- 保持与现有代码风格一致
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
确认用户要创建参考型 Skill

## 第二步：收集核心信息（2-3个问题）

### 2.1 Skill 名称
- 输入 Skill 名称（遵循命名规则：名词+最简词）
- 系统自动验证命名规范

### 2.2 Skill 描述与功能（合并）
- 输入 Skill 描述（遵循 Description 公式：功能描述 + 执行方式 + 触发场景）
- 系统自动提取主要功能

### 2.3 功能用途（可选）
- 如描述不够清晰，询问主要功能用途
- 提供常见选项供快速选择

## 第三步：智能配置（自动）

### 参考型 Skill（自动配置）
系统自动设置：
- `allowed-tools`: [Read, Grep, Glob]
- 无需 `disable-model-invocation`
- 无需 `user-invocable`

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
创建完成后，引导用户测试规范是否满足预期：
- 提供测试清单链接
- 指导测试方法
- 提供问题排查建议

---

# 最佳实践建议

## 1. 遵循渐进式披露原则
SKILL.md 定位为智能路由器，只包含核心提示和路由表，避免冗长的详细内容。

## 2. 遵循单一职责原则
每个文件只负责一个明确的功能领域，避免职责混杂。

## 3. 无需禁用模型调用
参考型 Skill 不需要设置 `disable-model-invocation`，应该允许模型主动加载和引用。

## 4. 合理拆分内容
- 高频核心语义 → SKILL.md（内联）
- 低频细节、示例、数据 → reference.md、examples.md（外置）
- 核心理论 → theories/（独立管理）
- 可复用模板 → templates/

## 5. 提供清晰的使用说明
在 SKILL.md 中明确说明触发方式和使用场景。

## 6. 定期维护更新
随着项目发展，及时更新 Skill 内容以保持其有效性。

## 7. 遵循行数规范
- SKILL.md：≤500 行（遵循 500 行上限原则）
- reference.md：按需设置
- examples.md：按需设置