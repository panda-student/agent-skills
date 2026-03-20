# Skill 构建参考规范

# 核心理论

本技能基于四大核心理论构建，详细内容请参考理论文件：

- **[渐进式披露架构核心理论](./theories/progressive-disclosure.md)**：分层按需加载知识与资源，解决 Token 爆炸问题
- **[任务型 Skills 核心理论](./theories/task-skill-theory.md)**：任务型 Skill 设计原则与核心概念
- **[任务型 Skill 七步设计清单](./theories/task-skill-checklist.md)**：任务型 Skill 实践指南
- **[参考型 Skills 核心理论](./theories/reference-skill-theory.md)**：参考型 Skill 设计原则与最佳实践
- **[单一职责原则](./theories/single-responsibility.md)**：每个文件只负责一个明确的功能领域

---

# Skill 类型分类

## 参考型 Skill（Reference Skill）

### 核心特征
- **触发方式**：语义自动触发
- **适用场景**：规范、知识、风格、约定
- **特点**：无执行步骤，提供参考信息
- **示例**：api-rule、style-guide、git-flow

### 设计要点
- 不需要 `disable-model-invocation` 配置
- 允许模型主动加载和引用
- 内容以知识、规范、标准为主
- 无副作用操作

### Frontmatter 配置
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

## 任务型 Skill（Task Skill）

### 核心特征
- **触发方式**：斜杠命令 `/xxx` 手动触发
- **适用场景**：执行操作、部署、脚本、流程
- **特点**：包含具体执行步骤和操作指令
- **示例**：run-app、check-code、make-app

### 设计要点
- **必须设置** `disable-model-invocation: true`
- 仅允许用户手动触发，不允许模型主动执行
- 内容以操作流程、执行步骤为主
- 可能包含副作用操作（文件修改、部署等）

### Frontmatter 配置
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
- 例如："在用户需要创建技能、编写命令、制作工具时自动触发"

### 3. 文件类型关键词
- 明确提及相关文件类型
- 例如：SKILL.md、reference.md、examples.md、templates

### 4. 触发时机关键词
- 明确说明何时自动触发
- 例如："在用户...时自动触发"

## 参考型示例
- ✅ `定义、制定、规范项目 RESTful API 设计标准，包含URL命名、响应格式、状态码与鉴权规则，在编写/审查接口、设计新API、确定请求响应格式、讨论 API 规范时自动使用`
- ❌ `API 规范`（过于简单，触发概率低）

## 任务型示例
- ✅ `创建、编写、制作、生成符合项目规范的 React 组件，通过斜杠命令 /create-component 触发，在用户需要创建组件、编写 UI、制作页面元素时自动提示，用于快速生成标准化组件代码`
- ❌ `创建组件`（过于简单，触发概率低）

## 优化前后对比

### ❌ 优化前（触发概率低）
```
创建符合标准的 Claude Code Skill 文件，通过斜杠命令触发，用于快速生成 SKILL.md 及相关文件
```
**问题**：
- 关键词单一：只有"创建"、"Skill"
- 缺少同义词：编写、制作、生成、构建、开发
- 缺少场景关键词
- 缺少触发时机说明

### ✅ 优化后（触发概率高）
```
创建、编写、制作、生成、构建、开发、设计 Claude Code Skill 技能文件（SKILL.md、reference.md、examples.md、templates），在用户需要创建技能、编写命令、制作工具、生成 Skill 文件、构建自动化任务、开发 Claude Code 扩展时自动触发，通过斜杠命令 /skill-creator 手动调用，用于快速生成符合渐进式披露、单一职责原则的标准 Skill 文件
```
**优势**：
- 关键词丰富：创建、编写、制作、生成、构建、开发、设计
- 同义词覆盖：Skill、技能、命令、工具、扩展
- 场景关键词：创建技能、编写命令、制作工具、生成文件、构建任务、开发扩展
- 触发时机明确：在用户需要...时自动触发
- 文件类型明确：SKILL.md、reference.md、examples.md、templates

---

# 权限控制配置

## allowed-tools
限制 Skill 可使用的工具列表

### 参考型 Skill（只读）
```yaml
allowed-tools:
  - Read
  - Grep
  - Glob
```

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

## disable-model-invocation
禁用模型调用能力（任务型 Skill 必需）
```yaml
disable-model-invocation: true
```

## user-invocable
是否允许用户直接调用
```yaml
user-invocable: true
```

---

# 命名规则

## 基本原则
- 使用小写字母
- 使用连字符分隔单词
- 使用动名词形式
- 避免缩写和数字

## 参考型命名
- 名词+最简词：`api-rule`、`style-guide`、`git-flow`
- 强调知识领域：`arch-guide`、`security-rule`
- 记忆口诀：名词=知识
- 简化原则：使用最简单的单词（rule、guide、flow）

## 任务型命名
- 动词+最简词：`make-app`、`run-app`、`check-code`
- 强调执行动作：`build-app`、`fix-bug`、`test-all`
- 记忆口诀：动词=执行
- 简化原则：使用最简单的单词（make、run、check、fix、test）

## 命名示例
| 类型 | ✅ 正确 | ❌ 错误 |
|------|---------|---------|
| 参考 | `api-rule`、`style-guide` | `APIConvention`, `api_convention`, `api-convention`(复杂词) |
| 任务 | `make-app`、`run-app` | `CreateComponent`, `create_component`, `create-component`(复杂词) |

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

# Frontmatter 配置

## 参考型 Skill 配置
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

## 任务型 Skill 配置
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
| user-invocable | boolean | 否 | 是否允许用户直接调用 |
| allowed-tools | array | 否 | 限制可使用的工具 |
| disable-model-invocation | boolean | 任务型必需 | 是否禁用模型调用 |

---

# 交互流程详解（优化版）

## 第一步：确定 Skill 类型（1个问题）
询问用户要创建的 Skill 类型：
- A. 参考型 Skill（自动触发，规范/知识/标准）
- B. 任务型 Skill（手动斜杠命令触发，执行动作）

## 第二步：收集核心信息（2-3个问题）

### 2.1 Skill 名称
- 输入 Skill 名称（遵循命名规则）
- 系统自动验证命名规范

### 2.2 Skill 描述与功能（合并）
- 输入 Skill 描述（遵循 Description 公式：功能描述 + 执行方式 + 触发场景）
- 系统自动提取主要功能

### 2.3 功能用途（可选）
- 如描述不够清晰，询问主要功能用途
- 提供常见选项供快速选择

## 第三步：智能配置（0-1个问题）

### 参考型 Skill（自动配置）
系统自动设置：
- `allowed-tools`: [Read, Grep, Glob]
- 无需 `disable-model-invocation`
- 无需 `user-invocable`

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
创建完成后，引导用户测试技能是否满足预期：
- 提供测试清单链接
- 指导测试方法
- 提供问题排查建议

---

## 问题数量对比

### 优化前
- 参考型 Skill：6个问题
- 任务型 Skill：7个问题

### 优化后
- 参考型 Skill：**3-4个问题**（减少50%）
- 任务型 Skill：**4-5个问题**（减少43%）

### 优化措施
1. **合并相关问题**：描述与功能合并
2. **智能推断**：根据类型自动配置权限
3. **简化流程**：减少必填项，增加可选项
4. **快速模式**：提供仅创建 SKILL.md 的快速选项

---

# 优化流程详解

## 第一步：技能诊断（自动）

### 诊断维度
1. **Description 检查**
   - 关键词覆盖度
   - 同义词丰富度
   - 场景关键词
   - 触发时机说明

2. **结构检查**
   - 渐进式披露原则遵循情况
   - 文件职责是否单一
   - SKILL.md 行数（≤500行）
   - 文件结构完整性

3. **权限检查**
   - 参考型：是否只读权限
   - 任务型：是否禁用模型调用
   - 权限配置是否最小化

4. **内容质量检查**
   - 路由表是否清晰
   - 核心提示是否明确
   - 文件引用是否正确

## 第二步：优化建议（自动生成）

### 优化建议模板
```markdown
## 优化建议报告

### 问题诊断
1. **Description 问题**
   - 当前关键词数量：X个
   - 建议增加关键词：[列表]
   - 缺少触发时机说明

2. **结构问题**
   - SKILL.md 行数：X行（超出/符合）
   - 文件职责：单一/混杂
   - 缺少文件：[列表]

3. **权限问题**
   - 权限配置：过度授权/不足/合理
   - 建议调整：[具体建议]

### 优化方案
1. **Description 优化**
   - 增加关键词：创建、编写、制作、生成、构建、开发、设计
   - 增加场景关键词：[具体场景]
   - 明确触发时机

2. **结构优化**
   - 重构 SKILL.md（拆分/合并）
   - 创建缺失文件：reference.md/examples.md
   - 遵循单一职责原则

3. **权限优化**
   - 调整 allowed-tools
   - 设置 disable-model-invocation
   - 遵循最小权限原则
```

## 第三步：重构实施（用户确认后执行）

### 重构操作
1. **Description 重构**
   - 优化关键词覆盖
   - 增加触发场景说明
   - 提高自动触发概率

2. **文件结构重构**
   - 创建缺失文件
   - 拆分过大文件
   - 合并过小文件
   - 调整文件职责

3. **权限配置重构**
   - 调整 allowed-tools
   - 设置 disable-model-invocation
   - 优化权限配置

### 重构示例
```yaml
# 优化前
---
name: my-skill
description: 我的技能
allowed-tools:
  - Bash(*)
---

# 优化后
---
name: my-skill
description: 创建、编写、制作、生成、构建、开发、设计 [功能描述]，在用户需要 [场景] 时自动触发，通过斜杠命令 /my-skill 手动调用，用于 [用途]
user-invocable: true
disable-model-invocation: true
allowed-tools:
  - Read
  - Write
  - AskUserQuestion
---
```

## 第四步：验证测试（引导）

### 测试清单
1. **触发测试**
   - 参考型：语义触发是否正常
   - 任务型：斜杠命令是否可调用

2. **功能测试**
   - 核心功能是否正常
   - 权限配置是否生效

3. **性能测试**
   - 加载速度是否提升
   - 文件大小是否合理

### 测试报告模板
```markdown
## 优化效果报告

### 优化前
- Description 关键词：X个
- SKILL.md 行数：X行
- 文件数量：X个
- 触发概率：低/中/高

### 优化后
- Description 关键词：Y个（+Z%）
- SKILL.md 行数：Y行（-Z%）
- 文件数量：Y个
- 触发概率：高

### 改进效果
- 自动触发概率提升：X%
- 文件大小减少：X%
- 结构清晰度提升：X%
```

---

# 触发机制说明

## 参考型 Skill 自动触发
当用户讨论相关话题时，自动加载对应的 Skill：
```
用户：我想设计一个用户登录的 API 接口
助手：[自动触发 api-convention] 根据 API 规范，建议使用 POST /auth/login...
```

## 任务型 Skill 手动触发
用户通过斜杠命令显式调用：
```
用户：/create-component
助手：[触发 create-component] 我将帮你创建组件，请选择组件类型...
```

---

# 最佳实践建议

## 1. 遵循渐进式披露原则
SKILL.md 定位为智能路由器，只包含核心提示和路由表，避免冗长的详细内容。

## 2. 遵循单一职责原则
每个文件只负责一个明确的功能领域，避免职责混杂。

## 3. 明确区分 Skill 类型
- 参考型：知识导向，自动触发，只读权限
- 任务型：执行导向，手动触发，读写权限，禁用模型调用

## 4. 合理拆分内容
- 高频核心语义 → SKILL.md（内联）
- 低频细节、示例、数据 → reference.md、examples.md（外置）
- 核心理论 → theories/（独立管理）
- 可复用模板 → templates/

## 5. 遵循单一职责
每个 Skill 应该只负责一个明确的功能领域。

## 6. 提供清晰的使用说明
在 SKILL.md 中明确说明触发方式和使用场景。

## 7. 定期维护更新
随着项目发展，及时更新 Skill 内容以保持其有效性。

## 8. 使用模板提高效率
利用 templates/ 目录中的模板文件，快速生成标准化的 Skill 文件。

## 9. 遵循行数规范
- SKILL.md：≤500 行（遵循 500 行上限原则）
- reference.md：按需设置
- examples.md：按需设置

## 10. 实现知识预编译
将确定性逻辑封装为脚本，降低推理与上下文开销。

---

# 工具权限选择指南

## 参考型 Skill（只读工具）
适用于：
- 规范检查 Skill
- 代码审查 Skill
- 知识查询 Skill

## 任务型 Skill（读写工具）
适用于：
- 代码生成 Skill
- 文档生成 Skill
- 配置修改 Skill
- 部署脚本 Skill
- 交互式创建 Skill
