# Skill 构建示例

## 📋 目录导航

| 示例类型 | 跳转链接 |
|---------|---------|
| **完整交互流程** | [完整交互流程示例](#完整交互流程示例) |
| **参考型 Skill 示例** | [参考型 Skill 示例](#参考型-skill-示例) |
| **任务型 Skill 示例** | [任务型 Skill 示例](#任务型-skill-示例) |
| **路由定位示例** | [路由定位最佳实践](#路由定位最佳实践) |
| **常见错误** | [常见错误示例](#常见错误示例) |

---

# 自动类型判断示例

## 核心区别提醒

**创建前必须明确：**

| 类型 | 触发方式 | 适合场景 |
|------|---------|---------|
| **参考型** | AI 自动识别调用 | 提供规范、知识、指南 |
| **任务型** | 用户手动 `/命令` 调用 | 执行操作、生成文件 |

---

## 完整交互流程示例

### 示例 1：参考型 Skill 创建

**步骤 1：用户描述功能**
```
用户：创建一个 API 设计规范，提供 RESTful 接口指导
```

**步骤 2：系统判断并确认类型**
```
系统：根据描述自动判断...

┌─────────────────────────────────────────┐
│  判断结果：【参考型】                      │
│  判断依据：包含"规范"、"指导"关键词         │
│                                         │
│  触发方式：AI 自动识别调用                  │
│  （用户讨论 API 时自动加载，无需手动触发）    │
│                                         │
│  确认类型？                               │
│  A. 确认（推荐）                          │
│  B. 切换为任务型（用户手动调用）            │
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
```

---

### 示例 2：任务型 Skill 创建

**步骤 1：用户描述功能**
```
用户：创建一个生成组件的命令，自动创建组件文件
```

**步骤 2：系统判断并确认类型**
```
系统：根据描述自动判断...

┌─────────────────────────────────────────┐
│  判断结果：【任务型】                      │
│  判断依据：包含"生成"、"命令"、"创建"关键词  │
│                                         │
│  触发方式：用户手动调用                     │
│  （用户需输入 /make-component 触发）       │
│                                         │
│  确认类型？                               │
│  A. 确认（推荐）                          │
│  B. 切换为参考型（AI自动调用）             │
└─────────────────────────────────────────┘

用户：A
```

**步骤 3：确认名称**
```
系统：建议命名：make-component（动词+最简词）
用户：确认
```

**步骤 4：生成结果**
```yaml
---
name: make-component
description: 创建符合项目规范的组件，通过斜杠命令触发，用于快速生成标准化组件代码
user-invocable: true
disable-model-invocation: true
allowed-tools:
  - Read
  - Write
  - Edit
  - AskUserQuestion
---

你是组件创建专家。当用户使用 `/make-component` 命令时，引导用户创建组件。
```

---

### 示例 3：用户主动调整类型

**步骤 1：用户描述功能**
```
用户：创建一个代码检查工具
```

**步骤 2：系统判断并确认类型**
```
系统：根据描述自动判断...

┌─────────────────────────────────────────┐
│  判断结果：【任务型】                      │
│  判断依据：包含"检查"（执行操作关键词）      │
│                                         │
│  触发方式：用户手动调用                     │
│  （用户需输入 /check-code 触发）           │
│                                         │
│  确认类型？                               │
│  A. 确认（推荐）                          │
│  B. 切换为参考型（AI自动调用）             │
└─────────────────────────────────────────┘

用户：B（用户希望 AI 自动识别调用）

系统：已切换为参考型
触发方式：AI 自动识别调用
（用户讨论代码质量时自动加载）

建议命名：code-rule
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

# 参考型 Skill 示例

## 示例 1：API 规范

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
- ✅ 自动触发，无需用户手动调用
- ✅ 只读权限，无副作用操作
- ✅ 名词+最简词命名：api-rule
- ✅ **不设置** `disable-model-invocation`

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

## 示例 1：创建应用

### 目录结构
```
.claude/skills/
└── make-app/
    ├── SKILL.md
    ├── reference.md
    └── templates/
        └── component.tsx
```

### SKILL.md
```markdown
---
name: make-app
description: 创建符合项目规范的应用，通过斜杠命令触发，用于快速生成标准化应用代码
user-invocable: true
disable-model-invocation: true
allowed-tools:
  - Read
  - Write
  - AskUserQuestion
---

你是应用创建专家。当用户使用 `/make-app` 命令时，引导用户创建符合项目规范的应用。

## 执行流程
1. 询问应用名称和类型
2. 确认应用功能需求
3. 生成应用代码文件
4. 创建对应的样式文件
5. 生成测试文件（可选）

## 应用规范
- 使用函数式组件和 Hooks
- 遵循单一职责原则
- 组件文件不超过 300 行

详细规范和模板请参考 [reference.md](./reference.md) 和 [templates/](./templates/)
```

### 关键特征
- ✅ 手动触发，必须使用斜杠命令
- ✅ **必须** `disable-model-invocation: true`
- ✅ 读写权限，包含文件修改操作
- ✅ 动词+最简词命名：make-app

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

### ❌ 参考型 Skill 设置了 disable-model-invocation: true
```yaml
---
name: api-rule
description: API 设计规范
disable-model-invocation: true  # 错误！参考型不应禁用模型调用
---
```

### ❌ 任务型 Skill 缺少 disable-model-invocation: true
```yaml
---
name: deploy-service
description: 部署服务
user-invocable: true
# 错误！缺少 disable-model-invocation: true
---
```

### ✅ 正确配置
```yaml
# 参考型
---
name: api-rule
description: 定义项目 RESTful API 设计规范...
allowed-tools:
  - Read
  - Grep
  - Glob
---

# 任务型
---
name: deploy-service
description: 部署服务到生产环境，通过斜杠命令触发...
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