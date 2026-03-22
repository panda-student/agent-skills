# Skill 构建参考规范

# 核心理论

本技能基于核心理论构建，详细内容请参考理论文件：

| 理论 | 文件路径 | 核心内容 |
|------|---------|---------|
| 渐进式披露架构 | [progressive-disclosure.md](./theories/progressive-disclosure.md) | 分层按需加载，解决 Token 爆炸 |
| 任务型 Skill | [task-skill-theory.md](./theories/task-skill-theory.md) | 任务型设计原则与核心概念 |
| 参考型 Skill | [reference-skill-theory.md](./theories/reference-skill-theory.md) | 参考型设计原则与最佳实践 |
| 单一职责原则 | [single-responsibility.md](./theories/single-responsibility.md) | 每个文件只负责一个功能领域 |
| 知识预编译原则 | [knowledge-precompilation.md](./theories/knowledge-precompilation.md) | 封装确定性逻辑，提升性能 |

---

# Skill 类型分类

## 参考型 Skill（Reference Skill）

| 特征 | 说明 |
|------|------|
| 触发方式 | 语义自动触发 |
| 适用场景 | 规范、知识、风格、约定 |
| 核心特点 | 无执行步骤，提供参考信息 |
| 权限配置 | 只读权限（Read、Grep、Glob） |
| 命名规范 | 名词+最简词：api-rule、style-guide、git-flow |
| 关键配置 | 无需 disable-model-invocation |

## 任务型 Skill（Task Skill）

| 特征 | 说明 |
|------|------|
| 触发方式 | 斜杠命令手动触发 |
| 适用场景 | 执行操作、部署、脚本、流程 |
| 核心特点 | 包含执行步骤，可能有副作用 |
| 权限配置 | 读写权限（Read、Write、Edit、Bash） |
| 命名规范 | 动词+最简词：make-app、run-app、check-code |
| 关键配置 | **必须** disable-model-invocation: true |

---

# Description 编写公式

**标准公式**：`功能描述 + 执行方式 + 触发场景`

## 优化原则

### 关键词覆盖策略
- **同义词覆盖**：创建、编写、制作、生成、构建、开发、设计
- **场景关键词**：描述用户可能的使用场景
- **文件类型关键词**：明确提及相关文件类型
- **触发时机关键词**：明确说明何时自动触发

## 示例对比

### ❌ 优化前（触发概率低）
```
创建符合标准的 Claude Code Skill 文件，通过斜杠命令触发
```
**问题**：关键词单一，缺少同义词和场景关键词

### ✅ 优化后（触发概率高）
```
创建、编写、制作、生成、构建、开发、设计 Claude Code Skill 技能文件（SKILL.md、reference.md、examples.md、templates），在用户需要创建技能、编写命令、制作工具、生成 Skill 文件、构建自动化任务、开发 Claude Code 扩展时自动触发，通过斜杠命令 /skill-builder 手动调用，用于快速生成符合渐进式披露、单一职责原则的标准 Skill 文件
```

---

# 权限控制配置

## allowed-tools

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

## 配置说明

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| name | string | 是 | Skill 名称，需与目录名一致 |
| description | string | 是 | Skill 描述，遵循公式 |
| user-invocable | boolean | 否 | 是否允许用户直接调用 |
| allowed-tools | array | 否 | 限制可使用的工具 |
| disable-model-invocation | boolean | 任务型必需 | 是否禁用模型调用 |

---

# 命名规则

## 基本原则
- 使用小写字母
- 使用连字符分隔单词
- 使用最简单的单词（rule、guide、flow、make、run、check）
- 避免复杂词汇（convention、component、service）

## 命名示例

| 类型 | ✅ 正确 | ❌ 错误 |
|------|---------|---------|
| 参考 | `api-rule`、`style-guide` | `APIConvention`, `api_convention` |
| 任务 | `make-app`、`run-app` | `CreateComponent`, `create_component` |

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

| 文件 | 职责 |
|------|------|
| SKILL.md | 智能路由器，只负责路由和核心提示 |
| reference.md | 详细规范，只负责规范说明 |
| examples.md | 示例文档，只负责示例展示 |
| theories/ | 理论文件，只负责理论阐述 |
| templates/ | 模板文件，只负责模板定义 |

---

# 交互流程

## 创建流程

1. **类型选择**（1个问题）→ 参考型/任务型
2. **核心信息**（2-3个问题）→ 名称、描述与功能
3. **智能配置**（0-1个问题）→ 自动配置权限
4. **文件结构**（1个问题）→ 快速/标准/完整模式
5. **输出交付**（自动）→ 目录结构 + 完整代码
6. **测试验证**（引导）→ 验证技能是否满足预期

**问题数量**：参考型 3-4个，任务型 4-5个

## 优化流程

1. **技能诊断** → 分析现有技能问题
2. **优化建议** → 提供改进方案
3. **重构实施** → 执行优化操作
4. **验证测试** → 确认优化效果

### 优化维度
- **Description 优化**：提高自动触发概率
- **结构优化**：遵循渐进式披露原则
- **职责优化**：遵循单一职责原则
- **权限优化**：遵循最小权限原则

---

# 最佳实践

## 1. 遵循渐进式披露原则
SKILL.md 定位为智能路由器，只包含核心提示和路由表。

## 2. 遵循单一职责原则
每个文件只负责一个明确的功能领域，避免职责混杂。

## 3. 明确区分 Skill 类型
- 参考型：知识导向，自动触发，只读权限
- 任务型：执行导向，手动触发，读写权限，禁用模型调用

## 4. 合理拆分内容
- 高频核心语义 → SKILL.md（内联）
- 低频细节、示例、数据 → reference.md、examples.md（外置）
- 核心理论 → theories/（独立管理）

## 5. 遵循行数规范
- SKILL.md：≤500 行
- reference.md、examples.md：按需设置

## 6. 实现知识预编译
将确定性逻辑封装为脚本，降低推理与上下文开销。详见 [knowledge-precompilation.md](./theories/knowledge-precompilation.md)。

---

# 工具权限选择指南

## 参考型 Skill（只读工具）
适用于：规范检查、代码审查、知识查询

## 任务型 Skill（读写工具）
适用于：代码生成、文档生成、配置修改、部署脚本
