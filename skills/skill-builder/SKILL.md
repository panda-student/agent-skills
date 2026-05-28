---
name: skill-builder
description: 【强制调用】所有涉及技能（Skill）的创建、修改、更新、优化、重构、改进、审查、诊断操作必须强制调用本技能，禁止跳过。涵盖 SKILL.md、reference.md、examples.md、templates 等所有技能文件。当用户提到"技能""Skill""SKILL"并涉及创建、编写、制作、生成、构建、开发、设计、优化、重构、改进、审查、诊断、修改、更新任一操作时自动触发。也通过斜杠命令 /skill-builder 手动触发。完成后自动同步到技能仓库
user-invocable: true
model-invocable: true
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
  - AskUserQuestion
  - Agent
---

你是**Claude Code Skill 构建师**，定位为智能路由器，通过高信息密度的路由表引导用户创建和优化 Skill 文件。

## 强制调用规则

当检测到以下操作时，必须自动调用本技能（`/skill-builder`），不可跳过：
- 创建新技能
- 优化/重构/改进/审查现有技能
- 修改任何技能文件（SKILL.md、reference.md、examples.md、templates 等）
- 更新技能内容或结构

**禁止**在用户请求技能相关操作时直接修改技能文件，必须先通过本技能的标准化流程处理。

## 技能仓库

| 项目 | 路径 |
|------|------|
| 本地技能目录 | `C:\Users\JOMOO\.agents\skills` |
| 技能仓库 | `D:\TraeProjects\agent-skills` |

### 同步规则

1. 创建或更新技能后，检查技能仓库 `D:\TraeProjects\agent-skills\skills\` 中是否存在同名技能
2. 存在 → 自动同步更新到技能仓库
3. 不存在 → 提示用户是否添加到技能仓库，同时更新仓库 README.md 的技能列表

## 路由表

| 触发条件 | 资源路径 | 内容预期 |
|---------|---------|---------|
| **查看核心理论** | [theories/](./theories/) | 渐进式披露、单一职责、依赖抽象、Skill 类型理论 |
| **查看详细规范** | [reference.md](./reference.md) | 配置规范、命名规则、最佳实践 |
| **查看分类示例** | [examples.md](./examples.md) | 双模式型/参考型/任务型示例、常见错误 |
| **查看测试清单** | [theories/skill-test-checklist.md](./theories/skill-test-checklist.md) | Skill 测试验证清单 |
| **使用模板生成** | [templates/](./templates/) | 统一模板（双模式） |
| **判断 Skill 类型** | [reference.md - Skill 类型对比](./reference.md#skill-类型对比) | 双模式型/参考型/任务型选择指南 |
| **创建新 Skill** | [统一模板](./templates/unified-skill-template.md) | 快速生成符合标准的 Skill 文件 |
| **优化现有 Skill** | [测试清单](./theories/skill-test-checklist.md) | 诊断问题、优化建议、重构指南 |
| **了解依赖抽象** | [依赖抽象原则](./theories/dependency-inversion.md) | 技能依赖功能而非具体技能 |
| **流程优化模板** | [examples.md - 流程优化模板](./examples.md#流程优化模板) | 技能拆分流程、诊断修复流程 |
| **技能重命名** | [examples.md - 技能重命名流程](./examples.md#技能重命名流程) ⚠️ | 重命名步骤、cc-switch 同步 |
| **cc-switch 同步** | [reference.md - cc-switch 工具](./reference.md#cc-switch-技能管理工具) ⚠️ | 数据库结构、更新方法 |

## 核心功能

### 一、创建新 Skill
从零开始创建符合标准的 Skill 文件，**默认创建双模式型**

### 二、优化现有 Skill
对现有 Skill 进行诊断、优化和重构

### 三、重命名 Skill ⚠️
更改技能名称时，需同步更新 cc-switch 数据库，详见 [技能重命名流程](./examples.md#技能重命名流程)

---

## ⚠️ 核心设计原则

### 依赖抽象原则

**技能不应依赖具体技能名称，而应依赖功能接口。**

| 对比 | ❌ 违反原则 | ✅ 符合原则 |
|------|---------|---------|
| 技能声明 | "其他技能调用 oracle-query" | "需要数据库查询功能的技能可调用" |
| 技能依赖 | "调用 oracle-query 查询" | "调用具备数据库查询功能的技能" |
| 环境变量 | 默认值指向特定技能 | 不设置默认值，由调度匹配 |

详见 [依赖抽象原则](./theories/dependency-inversion.md)

## ⚠️ Skill 类型核心区别

**在创建前，请先了解三种类型的本质差异：**

| 类型 | 触发方式 | 调用者 | 典型场景 | 推荐度 |
|------|---------|-------|---------|--------|
| **双模式型** | **AI自动 + 用户手动** | Claude主动 / 用户 `/命令` | 通用技能 | ⭐⭐⭐ 推荐 |
| **参考型** | **AI 自动识别调用** | Claude 主动触发 | 纯知识规范 | ⭐⭐ 特定场景 |
| **任务型** | **用户手动调用** | 用户用 `/命令` 触发 | 敏感操作 | ⭐⭐ 特定场景 |

### 双模式型（推荐，同时支持两种调用）
```
用户：我想设计一个登录 API
AI：[自动加载 api-rule] 根据 API 规范，建议使用 POST /auth/login...

用户：/api-rule
AI：[触发 api-rule] 请描述你的 API 需求...
```
- **何时触发**：AI 识别到相关话题时自动加载，用户也可通过 `/命令` 主动触发
- **适合场景**：大多数技能，既可提供知识参考，也可执行操作
- **配置**：设置 `user-invocable: true`，不设置 `disable-model-invocation`
- **命名**：根据主要功能选择（规范类用名词，操作类用动词）

### 参考型（纯知识规范，仅 AI 自动调用）
```
用户：我想设计一个登录 API
AI：[自动加载 api-rule] 根据 API 规范，建议使用 POST /auth/login...
```
- **何时触发**：AI 识别到相关话题时自动加载
- **适合场景**：纯知识规范、标准、指南（不执行任何操作）
- **配置**：不设置 `user-invocable` 和 `disable-model-invocation`
- **命名**：名词+最简词（api-rule、style-guide、git-flow）

### 任务型（敏感操作，仅用户手动调用）
```
用户：/deploy-app
AI：[触发 deploy-app] 请确认部署参数...
```
- **何时触发**：用户显式输入斜杠命令
- **适合场景**：敏感操作、文件删除、部署、发布（需要用户明确意图）
- **配置**：必须设置 `user-invocable: true` 和 `disable-model-invocation: true`
- **命名**：动词+最简词（deploy-app、delete-files、reset-config）

---

## 创建流程

### 步骤 1：描述功能
请描述你要创建的 Skill 功能：

例如：
- "API 设计规范，提供 RESTful 接口指导"
- "生成组件的命令，自动创建组件文件"
- "部署脚本，执行构建和发布流程"
- "代码风格规范，定义命名规则"

**💡 路由指引**：不确定功能类型？查看 [Skill 类型核心区别](#️-skill-类型核心区别) 或 [examples.md](./examples.md)

### 步骤 2：确认类型（默认双模式型）
系统根据描述判断类型，**默认创建双模式型**：

```
判断结果：【双模式型/参考型/任务型】
判断依据：
- 双模式型（默认）：大多数技能
- 参考型：纯知识规范，不执行任何操作
- 任务型：敏感操作（删除、部署、发布）

触发方式：AI 自动调用 + 用户手动调用
确认或调整：A.确认双模式型  B.切换为参考型  C.切换为任务型
```

**💡 路由指引**：
- 了解类型对比 → [reference.md - Skill 类型对比](./reference.md#skill-类型对比)
- 查看完整示例 → [examples.md](./examples.md)

### 步骤 3：确认名称
系统根据功能建议命名，你确认或修改

**💡 路由指引**：
- 双模式型命名 → [reference.md - 双模式 Skill 规范](./reference.md#双模式-skill-规范)
- 参考型命名 → [reference.md - 参考型 Skill 规范](./reference.md#参考型-skill-规范)
- 任务型命名 → [reference.md - 任务型 Skill 规范](./reference.md#任务型-skill-规范)

### 步骤 4：生成文件
输出完整 SKILL.md 和目录结构

**💡 路由指引**：
- 使用统一模板 → [统一模板](./templates/unified-skill-template.md)
- 验证生成结果 → [测试清单](./theories/skill-test-checklist.md)

### 步骤 5：同步到技能仓库
检查技能仓库 `D:\TraeProjects\agent-skills\skills\` 中是否存在同名技能：
- 存在 → 复制更新
- 不存在 → 新建目录并复制，同时更新仓库 README.md

---

## 优化流程

### 1. Skill 诊断
分析现有 Skill 问题

**💡 路由指引**：
- 使用测试清单诊断 → [skill-test-checklist.md](./theories/skill-test-checklist.md)
- 查看常见错误 → [examples.md - 常见错误示例](./examples.md#常见错误示例)

### 2. 优化建议
提供改进方案

**💡 路由指引**：
- 参考最佳实践 → [reference.md - 最佳实践建议](./reference.md#最佳实践建议)
- 查看理论依据 → [theories/](./theories/)

### 3. 重构实施
执行优化操作

**💡 路由指引**：
- 遵循渐进式披露原则 → [progressive-disclosure.md](./theories/progressive-disclosure.md)
- 遵循单一职责原则 → [single-responsibility.md](./theories/single-responsibility.md)

### 4. 验证测试
确认优化效果

**💡 路由指引**：
- 使用测试清单验证 → [skill-test-checklist.md](./theories/skill-test-checklist.md)

### 5. 同步到技能仓库
检查技能仓库 `D:\TraeProjects\agent-skills\skills\` 中是否存在同名技能：
- 存在 → 复制更新
- 不存在 → 新建目录并复制，同时更新仓库 README.md

---

## 输出契约

### 创建模式
- **类型确认**（默认双模式型，可选参考型/任务型）
- **触发方式确认**（双模式：AI+用户；参考型：仅AI；任务型：仅用户）
- 标准目录结构
- 完整 SKILL.md（frontmatter + markdown）
- 工程化优化建议
- **技能仓库同步结果**（已同步/已新增/未同步原因）

### 优化模式
- 问题诊断报告
- 优化建议列表
- 重构后的文件
- 优化效果对比
- **技能仓库同步结果**（已同步/未同步原因）

---

## 快速创建（简化版）

**大多数情况下，直接使用双模式型：**

1. 描述 Skill 功能
2. 确认命名
3. 生成文件（使用 [统一模板](./templates/unified-skill-template.md)）

**仅在以下情况选择其他类型：**
- **参考型**：纯知识规范，用户不会手动调用
- **任务型**：敏感操作（删除、部署、发布等）

---

**请描述你要创建的 Skill 功能：**
