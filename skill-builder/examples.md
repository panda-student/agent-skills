# Skill 构建示例

> ⚠️ **规则引用原则**：本文件仅展示示例，所有规则定义以 [reference.md](./reference.md) 为权威源。

## 📋 目录导航

| 示例类型 | 跳转链接 |
|---------|---------|
| **完整交互流程** | [完整交互流程示例](#完整交互流程示例) |
| **双模式型 Skill** | [双模式型 Skill 示例](#双模式型-skill-示例) ⭐ 推荐 |
| **参考型 Skill** | [参考型 Skill 示例](#参考型-skill-示例) |
| **任务型 Skill** | [任务型 Skill 示例](#任务型-skill-示例) |
| **常见错误** | [常见错误示例](#常见错误示例) |
| **技能重命名** | [reference.md - 重命名流程](./reference.md#重命名流程) ⚠️ 重要 |

---

# 自动类型判断示例

**类型判断规则和关键词分类见** [reference.md - Skill 类型自动判断](./reference.md#skill-类型自动判断)，**类型对比见** [reference.md - Skill 类型对比](./reference.md#skill-类型对比)

以下仅展示判断结果示例，判断逻辑以 reference.md 为权威源：

| 用户描述 | 类型判断 | 命名建议 | 判断依据 |
|---------|---------|---------|---------|
| "创建一个 API 设计规范" | 参考型 | api-rule | 含"规范" |
| "创建一个生成组件的命令" | 任务型 | make-component | 含"生成" |
| "部署应用到生产环境" | 任务型 | deploy-app | 含"部署" |
| "定义代码风格指南" | 参考型 | style-guide | 含"指南" |
| "检查代码质量并提供建议" | 任务型 | check-code | 含"检查" |

---

# 完整交互流程示例

## 双模式型 Skill 创建（默认推荐）

**描述功能**：用户输入 → "创建一个 API 设计规范，提供 RESTful 接口指导"

**确认类型**：系统判断类型
> 判断结果：**【双模式型】**（默认推荐）
> 触发方式：AI 自动调用 + 用户手动调用（`/api-rule`）
> 确认类型？ A.确认双模式型（推荐） B.切换为参考型 C.切换为任务型

**确认命名**：`api-rule`（名词+最简词，命名规则见 [reference.md - 命名规则](./reference.md#命名规则)）

**生成结果**：配置形态见下方 [双模式型 Skill 示例 - API 规范](#双模式型-skill-示例)（配置规则见 [reference.md - 类型对比](./reference.md#skill-类型对比)）

---

## 任务型 Skill 创建（敏感操作）

**描述功能**：用户输入 → "创建一个部署命令，执行构建和发布流程"

**确认类型**：系统判断类型
> 判断结果：**【任务型】**（含"部署"操作关键词）
> ⚠️ 敏感操作覆盖：建议设置 `disable-model-invocation: true` 防止 AI 自动执行部署
> 确认类型？ A.确认任务型 + 敏感操作覆盖（推荐） B.确认任务型（允许AI自动触发） C.切换为双模式型

**确认命名**：`deploy-app`（动词+最简词）

**生成结果**：配置形态见下方 [任务型 Skill 示例 - 部署应用](#任务型-skill-示例)

---

## 参考型 Skill 创建

**描述功能**：用户输入 → "创建一个代码风格规范，用户不需要手动调用，只想让AI自动提供参考"

**确认类型**：系统判断类型
> 判断结果：**【参考型】**（明确"不需要手动调用"，纯知识）
> 触发方式：仅 AI 自动调用（无斜杠命令）

**确认命名**：`style-guide`（名词+最简词）

**生成结果**：配置形态见下方 [参考型 Skill 示例](#参考型-skill-示例)

---

# 双模式型 Skill 示例 ⭐ 推荐

**配置规则见** [reference.md - Skill 类型对比](./reference.md#skill-类型对比)

## API 规范

```
.claude/skills/api-rule/
├── SKILL.md
└── reference.md
```

```yaml
---
name: api-rule
description: 定义项目 RESTful API 设计规范，包含URL命名、响应格式、状态码与鉴权规则，支持 AI 自动调用和用户通过斜杠命令 `/api-rule` 手动触发，在编写/审查接口、设计新API、确定请求响应格式时使用
user-invocable: true
allowed-tools:
  - Read
  - Grep
  - Glob
---

你是项目的 API 设计规范专家。当用户讨论 API 设计或使用 `/api-rule` 命令时，提供符合项目标准的指导。

## 双模式触发说明
- **AI 自动调用**：讨论 API 设计时自动加载
- **用户手动调用**：使用 `/api-rule` 命令主动触发

## 核心原则
- 遵循 RESTful 设计规范
- 使用统一的响应格式
- 实施版本控制策略
- 保证接口安全性

详细规范请参考 [reference.md](./reference.md)
```

## 组件生成器

```yaml
---
name: make-component
description: 创建符合项目规范的组件，支持 AI 自动调用和用户通过斜杠命令 `/make-component` 手动触发，用于快速生成标准化组件代码
user-invocable: true
allowed-tools:
  - Read
  - Write
  - Edit
  - AskUserQuestion
---

你是组件创建专家。当用户讨论创建组件或使用 `/make-component` 命令时，引导用户创建组件。

## 双模式触发说明
- **AI 自动调用**：讨论创建组件时自动加载
- **用户手动调用**：使用 `/make-component` 命令主动触发

## 执行流程（手动调用时）
- 询问组件名称和类型
- 确认组件功能需求
- 生成组件代码文件
```

---

# 参考型 Skill 示例

**配置规则见** [reference.md - Skill 类型对比](./reference.md#skill-类型对比)

> **注意**：参考型仅用于**纯知识规范**，用户明确不需要手动调用的情况。大多数情况下推荐使用双模式型。

## API 规范（参考型）

```yaml
---
name: api-rule
description: 定义项目 RESTful API 设计规范，包含URL命名、响应格式、状态码与鉴权规则，在编写/审查接口、设计新API、确定请求响应格式时自动使用
allowed-tools:
  - Read
  - Grep
  - Glob
---

你是项目的 API 设计规范专家。当用户讨论 API 设计、接口定义或 RESTful 规范时，提供符合项目标准的指导。

详细规范请参考 [reference.md](./reference.md)
```

## Git 工作流规范

```yaml
---
name: git-flow
description: 定义项目 Git 工作流规范，包含分支策略、提交规范、合并流程，在使用Git、创建分支、提交代码、合并请求时自动使用
allowed-tools:
  - Read
  - Grep
  - Glob
---

你是项目的 Git 工作流规范专家。当用户讨论 Git 工作流、分支策略或提交规范时，提供符合项目标准的指导。

详细规范请参考 [reference.md](./reference.md)
```

---

# 任务型 Skill 示例

**配置规则见** [reference.md - Skill 类型对比](./reference.md#skill-类型对比)

> **注意**：任务型适用于**流程编排/操作类**技能。默认 AI 也可自动触发；仅当涉及**敏感操作**（删除、部署、发布等）时，额外设置 `disable-model-invocation: true` 防止 AI 自动执行。

## 部署应用（任务型 + 敏感操作覆盖）

```yaml
---
name: deploy-app
description: 部署应用到生产环境，通过斜杠命令触发，用于自动化部署流程（敏感操作，仅用户手动调用）
user-invocable: true
disable-model-invocation: true
allowed-tools:
  - Read
  - Bash(npm run build)
  - Bash(docker build)
  - Bash(docker push)
  - Bash(kubectl apply)
---

你是应用部署专家。当用户使用 `/deploy-app` 命令时，执行标准化的部署流程。

## 部署流程
- 构建项目：`npm run build`
- 构建 Docker 镜像：`docker build -t ...`
- 推送镜像：`docker push ...`
- 应用 Kubernetes 配置：`kubectl apply -f ...`
```

## 检查代码（任务型，非敏感操作）

```yaml
---
name: check-code
description: 执行代码质量审查并提供改进建议，通过斜杠命令触发，用于提升代码质量
user-invocable: true
allowed-tools:
  - Read
  - Grep
  - Glob
---

你是专业的代码审查专家。当用户使用 `/check-code` 命令时，对指定代码进行全面审查。

## 审查维度
- **代码质量**：可读性、可维护性、复杂度
- **安全性**：潜在漏洞、敏感信息泄露
- **性能**：性能瓶颈、资源浪费
- **规范性**：编码规范、最佳实践
```

---

# 常见错误示例 {#常见错误示例}

> **正确配置规则见** [reference.md - Skill 类型对比](./reference.md#skill-类型对比)

## 类型配置错误

### ❌ 双模式型 Skill 设置了 disable-model-invocation: true
```yaml
user-invocable: true
disable-model-invocation: true  # 错误！双模式型不应禁用模型调用
```
**问题**：AI 无法自动调用，变成了任务型。

### ❌ 任务型敏感操作缺少 disable-model-invocation: true
```yaml
name: deploy-service
user-invocable: true
# 错误！部署是敏感操作，缺少 disable-model-invocation: true
```
**问题**：AI 可能自动执行部署。

### ❌ 参考型 Skill 设置了 user-invocable: true
```yaml
name: style-guide
user-invocable: true  # 错误！参考型不需要用户手动调用
```
**问题**：参考型是纯知识规范，不需要用户手动调用。

---

## 权限配置不当

**权限规则见** [reference.md - 权限控制配置](./reference.md#权限控制配置)

```yaml
# ❌ 错误
allowed-tools:
  - Bash(*)  # 违反最小权限原则

# ✅ 正确
allowed-tools:
  - Read
  - Bash(npm run build)
  - Bash(git push)
```

---

## Description 过于简单

**Description 编写规则见** [reference.md - Description 编写公式](./reference.md#description-编写公式)

```yaml
# ❌ 错误
description: API 规范  # 过于简单，触发概率低

# ✅ 正确
description: 定义项目 RESTful API 设计规范，包含URL命名、响应格式、状态码与鉴权规则，在编写/审查接口、设计新API、确定请求响应格式时自动使用
```

---

## 命名不符合规范

**命名规则见** [reference.md - 命名规则](./reference.md#命名规则)

```
# ❌ 错误
CreateComponent  # 大写字母
create_component  # 下划线
createComp       # 缩写

# ✅ 正确
api-rule、style-guide、make-component、deploy-app
```

---

# 技能重命名流程 {#技能重命名流程}

**重命名执行顺序与避坑提醒见** [reference.md - 重命名流程](./reference.md#重命名流程)
