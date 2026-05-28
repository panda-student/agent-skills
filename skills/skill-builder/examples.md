# Skill 构建示例

## 📋 目录导航

| 示例类型 | 跳转链接 |
|---------|---------|
| **完整交互流程** | [完整交互流程示例](#完整交互流程示例) |
| **双模式型 Skill 示例** | [双模式型 Skill 示例](#双模式型-skill-示例) ⭐ 推荐 |
| **参考型 Skill 示例** | [参考型 Skill 示例](#参考型-skill-示例) |
| **任务型 Skill 示例** | [任务型 Skill 示例](#任务型-skill-示例) |
| **路由定位示例** | [路由定位最佳实践](#路由定位最佳实践) |
| **常见错误** | [常见错误示例](#常见错误示例) |
| **流程优化模板** | [流程优化模板](#流程优化模板) |
| **技能重命名流程** | [技能重命名流程](#技能重命名流程) ⚠️ 重要 |

---

# 自动类型判断示例

## 核心区别提醒

**创建前必须明确：**

| 类型 | 触发方式 | 适合场景 | 推荐度 |
|------|---------|---------|--------|
| **双模式型** | AI自动 + 用户手动 `/命令` | 通用技能 | ⭐⭐⭐ 默认推荐 |
| **参考型** | AI 自动识别调用 | 纯知识规范 | ⭐⭐ 特定场景 |
| **任务型** | 用户手动 `/命令` 调用 | 敏感操作 | ⭐⭐ 特定场景 |

---

## 完整交互流程示例

### 示例 1：双模式型 Skill 创建（默认推荐）

**步骤 1：用户描述功能**
```
用户：创建一个 API 设计规范，提供 RESTful 接口指导
```

**步骤 2：系统判断并确认类型**
```
系统：根据描述自动判断...

┌─────────────────────────────────────────┐
│  判断结果：【双模式型】（默认推荐）         │
│  判断依据：大多数技能都适合双模式型         │
│                                         │
│  触发方式：AI 自动调用 + 用户手动调用       │
│  （用户讨论 API 时自动加载，也可用         │
│   /api-rule 手动触发）                   │
│                                         │
│  确认类型？                               │
│  A. 确认双模式型（推荐）                   │
│  B. 切换为参考型（仅AI调用）               │
│  C. 切换为任务型（仅用户调用）             │
└─────────────────────────────────────────┘

用户：A
```

**步骤 3：确认名称**
```
系统：建议命名：api-rule（名词+最简词）
用户：确认
```

**步骤 4：生成结果**
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
- AI 自动调用：讨论 API 时自动加载
- 用户手动调用：使用 `/api-rule` 命令

## 核心原则
- 遵循 RESTful 设计规范
- 使用统一的响应格式
```

---

### 示例 2：任务型 Skill 创建（敏感操作）

**步骤 1：用户描述功能**
```
用户：创建一个部署命令，执行构建和发布流程
```

**步骤 2：系统判断并确认类型**
```
系统：根据描述自动判断...

┌─────────────────────────────────────────┐
│  判断结果：【任务型】                      │
│  判断依据：包含"部署"（敏感操作关键词）     │
│                                         │
│  触发方式：仅用户手动调用                  │
│  （用户需输入 /deploy-app 触发，AI        │
│   不会自动执行部署操作）                  │
│                                         │
│  确认类型？                               │
│  A. 确认任务型（推荐，敏感操作）           │
│  B. 切换为双模式型                        │
│  C. 切换为参考型                         │
└─────────────────────────────────────────┘

用户：A
```

**步骤 3：确认名称**
```
系统：建议命名：deploy-app（动词+最简词）
用户：确认
```

**步骤 4：生成结果**
```yaml
---
name: deploy-app
description: 部署应用到生产环境，通过斜杠命令触发，用于自动化部署流程，仅用户手动调用（敏感操作）
user-invocable: true
disable-model-invocation: true
allowed-tools:
  - Read
  - Bash(npm run build)
  - Bash(docker build)
  - Bash(docker push)
---

你是应用部署专家。当用户使用 `/deploy-app` 命令时，执行标准化的部署流程。
```

---

### 示例 3：参考型 Skill 创建（纯知识规范）

**步骤 1：用户描述功能**
```
用户：创建一个代码风格规范，用户不需要手动调用，只想让AI自动提供参考
```

**步骤 2：系统判断并确认类型**
```
系统：根据描述自动判断...

┌─────────────────────────────────────────┐
│  判断结果：【参考型】                      │
│  判断依据：明确"不需要手动调用"，纯知识     │
│                                         │
│  触发方式：仅 AI 自动调用                  │
│  （用户讨论代码风格时自动加载，无斜杠命令）  │
│                                         │
│  确认类型？                               │
│  A. 确认参考型（推荐，纯知识规范）         │
│  B. 切换为双模式型                        │
│  C. 切换为任务型                         │
└─────────────────────────────────────────┘

用户：A
```

**步骤 3：确认名称**
```
系统：建议命名：style-guide（名词+最简词）
用户：确认
```

**步骤 4：生成结果**
```yaml
---
name: style-guide
description: 定义项目代码风格规范，包含命名约定、格式化规则、注释标准，在编写代码、代码审查、格式化代码时自动使用
allowed-tools:
  - Read
  - Grep
  - Glob
---

你是项目的代码风格规范专家。当用户讨论代码风格时，提供符合项目标准的指导。
```

---

## 判断流程演示

### 示例 1：用户描述 "创建一个 API 设计规范"

```
提取关键词：创建、API、设计、规范
    ↓
分析：包含"规范"（参考型关键词）
    ↓
判断结果：参考型
    ↓
命名建议：api-rule
```

### 示例 2：用户描述 "创建一个生成组件的命令"

```
提取关键词：创建、生成、组件、命令
    ↓
分析：包含"生成"（任务型关键词）
    ↓
判断结果：任务型
    ↓
命名建议：make-component
```

### 示例 3：用户描述 "部署应用到生产环境"

```
提取关键词：部署、应用、生产环境
    ↓
分析：包含"部署"（任务型关键词）
    ↓
判断结果：任务型
    ↓
命名建议：run-app
```

### 示例 4：用户描述 "定义代码风格指南"

```
提取关键词：定义、代码风格、指南
    ↓
分析：包含"指南"（参考型关键词）
    ↓
判断结果：参考型
    ↓
命名建议：style-guide
```

---

# 双模式型 Skill 示例 ⭐ 推荐

## 示例 1：API 规范（双模式型）

### 目录结构
```
.claude/skills/
└── api-rule/
    ├── SKILL.md
    └── reference.md
```

### SKILL.md
```markdown
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

### 关键特征
- ✅ 双模式触发：AI 自动 + 用户手动
- ✅ 设置 `user-invocable: true`
- ✅ **不设置** `disable-model-invocation`
- ✅ 只读权限，适合知识规范

---

## 示例 2：组件生成器（双模式型）

### SKILL.md
```markdown
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
1. 询问组件名称和类型
2. 确认组件功能需求
3. 生成组件代码文件
```

### 关键特征
- ✅ 双模式触发
- ✅ 包含读写权限（可创建文件）
- ✅ 适合大多数操作类技能

---

# 参考型 Skill 示例

> **注意**：参考型仅用于**纯知识规范**，用户明确不需要手动调用的情况。大多数情况下推荐使用双模式型。

## 示例 1：API 规范（参考型 - 仅用于纯知识）

### 目录结构
```
.claude/skills/
└── api-rule/
    ├── SKILL.md
    └── reference.md
```

### SKILL.md
```markdown
---
name: api-rule
description: 定义项目 RESTful API 设计规范，包含URL命名、响应格式、状态码与鉴权规则，在编写/审查接口、设计新API、确定请求响应格式时自动使用
allowed-tools:
  - Read
  - Grep
  - Glob
---

你是项目的 API 设计规范专家。当用户讨论 API 设计、接口定义或 RESTful 规范时，提供符合项目标准的指导。

## 核心原则
- 遵循 RESTful 设计规范
- 使用统一的响应格式
- 实施版本控制策略
- 保证接口安全性

详细规范请参考 [reference.md](./reference.md)
```

### 关键特征
- ✅ **仅 AI 自动触发**，用户无法手动调用
- ✅ 只读权限，无副作用操作
- ✅ 名词+最简词命名：api-rule
- ✅ **不设置** `user-invocable` 和 `disable-model-invocation`
- ⚠️ 仅用于纯知识规范场景

---

## 示例 2：代码风格规范

### SKILL.md
```markdown
---
name: style-guide
description: 定义项目代码风格规范，包含命名约定、格式化规则、注释标准，在编写代码、代码审查、格式化代码时自动使用
allowed-tools:
  - Read
  - Grep
  - Glob
---

你是项目的代码风格规范专家。当用户讨论代码风格、命名约定或格式化规则时，提供符合项目标准的指导。

## 核心规范
- 命名约定：驼峰命名、常量大写
- 格式化：缩进、空格、换行
- 注释标准：函数注释、行内注释

详细规范请参考 [reference.md](./reference.md)
```

### 关键特征
- ✅ 知识导向，自动触发
- ✅ 只读权限
- ✅ 名词+最简词命名：style-guide

---

## 示例 3：Git 工作流规范

### SKILL.md
```markdown
---
name: git-flow
description: 定义项目 Git 工作流规范，包含分支策略、提交规范、合并流程，在使用Git、创建分支、提交代码、合并请求时自动使用
allowed-tools:
  - Read
  - Grep
  - Glob
---

你是项目的 Git 工作流规范专家。当用户讨论 Git 工作流、分支策略或提交规范时，提供符合项目标准的指导。

## 核心规范
- 分支策略：main、develop、feature、hotfix
- 提交规范：feat、fix、docs、style、refactor
- 合并流程：PR 审核、CI 通过、Squash 合并

详细规范请参考 [reference.md](./reference.md)
```

---

# 任务型 Skill 示例

> **注意**：任务型仅用于**敏感操作**（删除、部署、发布等），需要用户明确意图，不让 AI 自动触发。大多数操作类技能推荐使用双模式型。

## 示例 1：部署应用（任务型 - 敏感操作）

### 目录结构
```
.claude/skills/
└── deploy-app/
    ├── SKILL.md
    └── reference.md
```

### SKILL.md
```markdown
---
name: deploy-app
description: 部署应用到生产环境，通过斜杠命令触发，用于自动化部署流程，仅用户手动调用（敏感操作）
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
1. 构建项目：`npm run build`
2. 构建 Docker 镜像：`docker build -t ...`
3. 推送镜像：`docker push ...`
4. 应用 Kubernetes 配置：`kubectl apply -f ...`

## 安全检查
- 确认当前分支为 main
- 确认所有测试通过
- 确认无未提交的更改
```

### 关键特征
- ✅ **仅用户手动触发**，AI **不能**自动执行
- ✅ **必须** `disable-model-invocation: true`
- ✅ 精确权限控制，不使用 Bash(*)
- ✅ 动词+最简词命名：deploy-app
- ⚠️ 仅用于敏感操作场景

---

## 示例 2：部署应用

### SKILL.md
```markdown
---
name: run-app
description: 部署应用到生产环境，通过斜杠命令触发，用于自动化部署流程
user-invocable: true
disable-model-invocation: true
allowed-tools:
  - Read
  - Bash(npm run build)
  - Bash(docker build)
  - Bash(docker push)
  - Bash(kubectl apply)
---

你是应用部署专家。当用户使用 `/run-app` 命令时，执行标准化的部署流程。

## 部署流程
1. 构建项目：`npm run build`
2. 构建 Docker 镜像：`docker build -t ...`
3. 推送镜像：`docker push ...`
4. 应用 Kubernetes 配置：`kubectl apply -f ...`

## 安全检查
- 确认当前分支为 main
- 确认所有测试通过
- 确认无未提交的更改
```

### 关键特征
- ✅ 手动触发，防止误操作
- ✅ **必须** disable-model-invocation: true
- ✅ 精确权限控制，不使用 Bash(*)
- ✅ 动词+最简词命名：run-app

---

## 示例 3：检查代码

### SKILL.md
```markdown
---
name: check-code
description: 执行代码质量审查并提供改进建议，通过斜杠命令触发，用于提升代码质量
user-invocable: true
disable-model-invocation: true
allowed-tools:
  - Read
  - Grep
  - Glob
---

你是专业的代码审查专家。当用户使用 `/check-code` 命令时，对指定代码进行全面审查。

## 审查维度
1. **代码质量**：可读性、可维护性、复杂度
2. **安全性**：潜在漏洞、敏感信息泄露
3. **性能**：性能瓶颈、资源浪费
4. **规范性**：编码规范、最佳实践

## 输出格式
### 审查报告
- 文件：[文件路径]
- 问题等级：🔴 严重 | 🟡 警告 | 🔵 建议
- 问题描述：[具体描述]
- 改进建议：[具体建议]
```

### 关键特征
- ✅ 手动触发
- ✅ **必须** disable-model-invocation: true
- ✅ 只读权限（审查不修改文件）
- ✅ 动词+最简词命名：check-code

---

# 触发场景

## 参考型 Skill 自动触发
```
用户：我想设计一个用户登录的 API 接口
助手：[自动触发 api-rule] 根据 API 规范，建议使用 POST /auth/login...
```

## 任务型 Skill 手动触发
```
用户：/make-app
助手：[触发 make-app] 我将帮你创建应用，请选择应用类型...
```

---

# 路由定位最佳实践 {#路由定位最佳实践}

## 示例 1：优秀的路由表设计

### ✅ 优秀示例

```markdown
## 路由表

| 触发条件 | 资源路径 | 内容预期 |
|---------|---------|---------|
| **查看核心理论** | [theories/](./theories/) | 渐进式披露、单一职责、Skill 类型理论 |
| **查看详细规范** | [reference.md](./reference.md) | 配置规范、命名规则、最佳实践 |
| **查看分类示例** | [examples.md](./examples.md) | 参考型/任务型示例、常见错误 |
| **判断 Skill 类型** | [参考型理论](./theories/reference-skill-theory.md) \| [任务型理论](./theories/task-skill-theory.md) | 自动判断参考型/任务型，基于关键词分析 |
| **创建新 Skill** | [参考型模板](./templates/reference-skill-template.md) \| [任务型模板](./templates/task-skill-template.md) | 快速生成符合标准的 Skill 文件 |
| **优化现有 Skill** | [测试清单](./theories/skill-test-checklist.md) | 诊断问题、优化建议、重构指南 |
```

**优点**：
- ✅ 触发条件明确且加粗突出
- ✅ 资源路径准确且包含锚点
- ✅ 内容预期具体明确
- ✅ 覆盖所有主要功能场景

### ❌ 糟糕示例

```markdown
## 路由表

| 触发条件 | 资源路径 | 内容预期 |
|---------|---------|---------|
| 查看理论 | theories/ | 理论文件 |
| 查看规范 | reference.md | 规范文档 |
| 查看示例 | examples.md | 示例文件 |
```

**缺点**：
- ❌ 触发条件不够明确
- ❌ 缺少锚点链接
- ❌ 内容预期过于宽泛
- ❌ 未覆盖关键功能（类型判断、创建、优化）

---

## 示例 2：流程中的路由指引

### ✅ 优秀示例

```markdown
## 创建流程

### 步骤 1：描述功能
请描述你要创建的 Skill 功能

**💡 路由指引**：不确定功能类型？查看 [Skill 类型核心区别](#️-skill-类型核心区别) 或 [examples.md](./examples.md)

### 步骤 2：确认类型
系统根据描述自动判断类型

**💡 路由指引**：
- 了解类型判断逻辑 → [reference.md - Skill 类型自动判断](./reference.md#skill-类型自动判断)
- 查看类型对比 → [reference.md - Skill 类型对比](./reference.md#skill-类型对比)
- 查看完整示例 → [examples.md](./examples.md)
```

**优点**：
- ✅ 在关键步骤提供路由指引
- ✅ 使用表情符号增强可读性
- ✅ 提供多个相关资源链接
- ✅ 使用锚点链接支持跳转

### ❌ 糟糕示例

```markdown
## 创建流程

### 步骤 1：描述功能
请描述你要创建的 Skill 功能

### 步骤 2：确认类型
系统根据描述自动判断类型
```

**缺点**：
- ❌ 缺少路由指引
- ❌ 用户不知道去哪里查找更多信息
- ❌ 流程不够清晰

---

## 示例 3：锚点链接的使用

### ✅ 优秀示例

```markdown
**💡 路由指引**：
- 参考型命名规范 → [reference.md - 参考型 Skill 规范](./reference.md#参考型-skill-规范)
- 任务型命名规范 → [reference.md - 任务型 Skill 规范](./reference.md#任务型-skill-规范)
- 使用模板快速生成 → [参考型模板](./templates/reference-skill-template.md) 或 [任务型模板](./templates/task-skill-template.md)
```

**优点**：
- ✅ 使用锚点链接直接跳转到具体章节
- ✅ 链接文本清晰说明目标内容
- ✅ 提供多个相关资源

### ❌ 糟糕示例

```markdown
**提示**：
- 查看 reference.md
- 查看 examples.md
```

**缺点**：
- ❌ 没有锚点链接
- ❌ 链接文本不够具体
- ❌ 用户需要手动查找相关内容

---

## 示例 4：完整的路由定位检查清单

### ✅ 优秀示例

```markdown
## 路由定位检查清单

### 路由表检查
- [ ] 路由表是否覆盖所有主要功能？
- [ ] 每个路由是否有明确的触发条件？
- [ ] 资源路径是否准确可访问？
- [ ] 内容预期是否具体明确？

### 流程指引检查
- [ ] 是否在关键流程中提供路由指引？
- [ ] 路由指引是否使用表情符号突出显示？
- [ ] 是否提供多个相关资源链接？

### 锚点链接检查
- [ ] 是否使用锚点链接支持跳转？
- [ ] 锚点链接是否准确指向目标章节？
- [ ] 链接文本是否清晰说明目标内容？
```

**优点**：
- ✅ 提供完整的检查清单
- ✅ 分类清晰，易于检查
- ✅ 涵盖路由定位的所有关键要素

---

# 常见错误示例 {#常见错误示例}

## 错误 1：类型配置错误

### ❌ 双模式型 Skill 设置了 disable-model-invocation: true
```yaml
---
name: api-rule
description: API 设计规范
user-invocable: true
disable-model-invocation: true  # 错误！双模式型不应禁用模型调用
---
```
**问题**：设置了 `disable-model-invocation: true`，导致 AI 无法自动调用，变成了任务型。

### ❌ 任务型 Skill 缺少 disable-model-invocation: true
```yaml
---
name: deploy-service
description: 部署服务
user-invocable: true
# 错误！敏感操作缺少 disable-model-invocation: true
---
```
**问题**：缺少 `disable-model-invocation: true`，AI 可能自动执行部署操作，存在风险。

### ❌ 参考型 Skill 设置了 user-invocable: true
```yaml
---
name: style-guide
description: 代码风格规范
user-invocable: true  # 错误！参考型不需要用户手动调用
---
```
**问题**：参考型是纯知识规范，用户不需要手动调用，应该不设置 `user-invocable`。

### ✅ 正确配置
```yaml
# 双模式型（默认推荐）
---
name: api-rule
description: 定义项目 RESTful API 设计规范，支持 AI 自动调用和用户手动调用...
user-invocable: true
allowed-tools:
  - Read
  - Grep
  - Glob
---

# 参考型（纯知识规范）
---
name: style-guide
description: 定义项目代码风格规范，在编写代码时自动使用...
allowed-tools:
  - Read
  - Grep
  - Glob
---

# 任务型（敏感操作）
---
name: deploy-service
description: 部署服务到生产环境，仅用户手动调用（敏感操作）...
user-invocable: true
disable-model-invocation: true
allowed-tools:
  - Read
  - Bash(npm run build)
---
```

---

## 错误 2：权限配置不当

### ❌ 错误配置
```yaml
allowed-tools:
  - Bash(*)  # 违反最小权限原则
```

### ✅ 正确配置
```yaml
allowed-tools:
  - Read
  - Bash(npm run build)
  - Bash(git push)
```

---

## 错误 3：Description 过于简单

### ❌ 错误 Description
```yaml
description: API 规范  # 过于简单，触发概率低
```

### ✅ 正确 Description
```yaml
# 参考型
description: 定义项目 RESTful API 设计规范，包含URL命名、响应格式、状态码与鉴权规则，在编写/审查接口、设计新API、确定请求响应格式时自动使用

# 任务型
description: 创建符合项目规范的 React 组件，通过斜杠命令触发，用于快速生成标准化组件代码
```

---

## 错误 4：命名不符合规范

### ❌ 错误命名
```
CreateComponent  # 大写字母
create_component  # 下划线
createComp       # 缩写
```

### ✅ 正确命名
```
# 参考型（名词+最简词）
api-rule、style-guide、git-flow、arch-guide

# 任务型（动词+最简词）
make-app、run-app、check-code、fix-bug、test-all
```

---

# 流程优化模板 {#流程优化模板}

## 技能拆分流程

### 适用场景
当一个技能包含多个独立职责时，需要拆分为独立技能。

### 推荐执行顺序

```
Step 1: 职责分析
  - 分析原技能的职责边界
  - 识别可拆分的独立功能
  - 确定拆分后的职责划分

Step 2: 创建新技能
  - 为拆分出的功能创建新技能
  - 设置单一职责原则
  - 声明提供的功能接口

Step 3: 修改原技能
  - 精简原技能的职责
  - 移除拆分出去的功能
  - 更新 SKILL.md 内容

Step 4: 更新依赖引用
  - 将具体技能名称改为功能依赖
  - 遵循依赖抽象原则
  - 不写死依赖的具体技能

Step 5: 创建符号链接
  - 在用户目录创建符号链接
  - 确保用户可访问新技能

Step 6: 验证测试
  - 运行相关测试验证功能
  - 确认技能拆分不影响原有功能
```

### 关键优化点
- **可并行执行**：Step 2 和 Step 3 可并行执行
- **可提前准备**：Step 1 分析可在拆分前完成

### 避坑提醒
- 拆分后要更新所有引用方
- 新技能需要声明提供的功能
- 原技能需要精简为单一职责

---

## 技能诊断修复流程

### 适用场景
检查技能是否符合依赖抽象原则，修复违反原则的技能。

### 推荐执行顺序

```
Step 1: 获取技能列表
  - Glob 获取所有技能文件路径
  - 确定检查范围

Step 2: 搜索技能名称引用
  - Grep 搜索技能名称引用
  - 识别写死具体技能名称的情况
  - 分析是否违反依赖抽象原则

Step 3: 分析违反原则的技能
  - 分类问题类型（写死依赖、环境变量默认值）
  - 确定修复方案

Step 4: 批量修复
  - 使用 Edit replace_all=true 批量替换
  - 将具体技能名称改为功能依赖描述

Step 5: 验证修复结果
  - 再次搜索确认无残留引用
  - 验证技能功能正常
```

### 关键优化点
- **可省略的步骤**：如果确定无违规可跳过 Step 4
- **可并行执行**：多个技能可并行修复

### 避坑提醒
- 批量替换要确认替换内容准确
- 调度中心引用具体实现是合理的（作为可选实现）
- 环境变量默认值仍暗示特定技能，需注意

---

## 技能重命名流程 {#技能重命名流程}

### 适用场景
当需要更改技能的名称时，需同步更新多处配置。

### ⚠️ 关键原则

**技能名称和描述更新后，必须同步更新 cc-switch 数据库！**

cc-switch 不会自动从 SKILL.md 同步，需手动执行数据库更新。

### 推荐执行顺序

```
Step 1: 重命名技能目录
  - mv ~/.agents/skills/old-name ~/.agents/skills/new-name

Step 2: 修改 SKILL.md frontmatter
  - 更新 name 字段
  - 更新 description 中的命令引用（如 /old-name → /new-name）
  - 使用 Edit replace_all=true 替换文件中所有旧名称引用

Step 3: 重命名脚本文件（如有）
  - mv old-name.mjs new-name.mjs
  - 更新 SKILL.md 中对脚本文件的引用

Step 4: 更新符号链接
  - rm -f ~/.claude/skills/old-name
  - ln -sf ~/.agents/skills/new-name ~/.claude/skills/new-name

Step 5: 更新 cc-switch 数据库 ⚠️ 必须执行
  - 更新 name, directory, id 字段
  - 更新 description 字段（从 SKILL.md frontmatter 提取）

Step 6: 验证测试
  - 检查符号链接是否正确
  - 检查 cc-switch 数据库记录
  - 测试 /new-name 命令是否可用
```

### cc-switch 数据库更新命令

```python
import sqlite3
import re

conn = sqlite3.connect('~/.cc-switch/cc-switch.db')
cursor = conn.cursor()

# Step 5a: 更新名称和目录
cursor.execute('UPDATE skills SET name = ?, directory = ?, id = ? WHERE name = "old-name"',
               ('new-name', 'new-name', 'local:new-name'))

# Step 5b: 更新描述（从 SKILL.md 提取）
skill_path = '~/.agents/skills/new-name/SKILL.md'
with open(skill_path, 'r', encoding='utf-8') as f:
    content = f.read()
match = re.search(r'description:\s*(.+?)\n', content)
if match:
    cursor.execute('UPDATE skills SET description = ? WHERE name = "new-name"', (match.group(1).strip()))

conn.commit()
conn.close()
```

### 关键优化点
- **必须执行**：Step 5 cc-switch 数据库更新不可省略
- **可并行执行**：Step 1 和 Step 2 可在确认新名称后并行执行

### 避坑提醒
- cc-switch 不会自动同步 SKILL.md 的修改
- description 缺失会导致 cc-switch 界面看不到技能描述
- 符号链接指向错误会导致技能无法加载