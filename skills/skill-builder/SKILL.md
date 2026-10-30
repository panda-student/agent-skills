---
name: skill-builder
description: 【强制调用】技能的创建、修改、优化、重构、审查、诊断操作必须调用本技能。涵盖 SKILL.md/reference.md/examples.md/templates 等所有技能文件。/skill-builder 手动触发。
user-invocable: true
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

## 快速开始

**创建新技能**：描述功能 → 确认类型（默认双模式型）→ 确认命名 → 生成文件
**优化现有技能**：诊断 → 建议 → 重构 → 验证
**自我优化**：同优化流程，目标为自身

> 详细流程见 [reference.md - 创建流程](./reference.md#创建流程) / [优化流程](./reference.md#优化流程)

## 路由表

| 触发条件 | 资源路径 | 内容预期 |
|---------|---------|---------|
| **Skill类型判断** | [reference.md - 类型对比](./reference.md#skill-类型对比) | 双模式型/参考型/任务型选择指南 |
| **创建流程** | [reference.md - 创建流程](./reference.md#创建流程) | 描述功能→确认类型→确认命名→生成文件 |
| **优化流程** | [reference.md - 优化流程](./reference.md#优化流程) | 诊断→建议→重构→验证 |
| **自我优化** | [reference.md - 优化流程](./reference.md#优化流程) | 同优化流程，目标为 skill-builder 自身 |
| **详细规范** | [reference.md](./reference.md) | 配置规范、命名规则、权限配置、最佳实践 |
| **编号禁用规则** | [reference.md - 编号禁用规则](./reference.md#编号禁用规则) | 技能内容禁用编号，用无序列表/标题/箭头表达顺序 |
| **上下文注入** | [reference.md - 上下文注入](./reference.md#上下文注入配置) | context-injection 配置格式与设计原则 |
| **分类示例** | [examples.md](./examples.md) | 双模式型/参考型/任务型示例、常见错误 |
| **核心原则** | [theories/principles.md](./theories/principles.md) | 渐进式披露、单一职责、依赖抽象、自包含、SSOT |
| **测试清单** | [theories/skill-test-checklist.md](./theories/skill-test-checklist.md) | Skill 测试验证清单 |
| **统一模板** | [templates/unified-skill-template.md](./templates/unified-skill-template.md) | 快速生成标准SKILL.md |
| **技能重命名** | [reference.md - 重命名流程](./reference.md#重命名流程) | 重命名步骤 |
| **技能重叠处理** ⚠️ | [reference.md - 重叠处理规则](./reference.md#重叠处理规则) | 重叠检测→合并/提取决策→执行→验证 |


## 技能重叠检测与处理流程

当发现两个技能内容或功能重叠时，**先判断合并还是提取**再执行。决策标准、合并/提取流程、合并原则与检测方法全部见 [reference.md - 重叠处理规则](./reference.md#重叠处理规则)。
