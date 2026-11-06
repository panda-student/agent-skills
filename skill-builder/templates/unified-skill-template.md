---
name: your-skill-name
description: 功能描述 + 执行方式 + 触发场景，支持 AI 自动调用和用户通过斜杠命令 `/your-skill-name` 手动触发，用于相关场景
# 配置规则见: reference.md#skill-类型对比
user-invocable: true
# disable-model-invocation: true  # 取消注释：当涉及部署/删除/发布等敏感操作时启用，防止 AI 自动执行
allowed-tools:
  - Read
  - Grep
  - Glob
  # - Write      # 取消注释：任务型需要写入权限
  # - Edit       # 取消注释：任务型需要编辑权限
  # - Bash       # 取消注释：任务型需要执行权限
  # - AskUserQuestion  # 取消注释：任务型需要交互权限
---

你是项目的【领域】专家。当用户讨论【相关话题】或使用 `/your-skill-name` 命令时，提供符合项目标准的指导。

## 触发说明

<!-- 双模式型（默认） -->
- **AI 自动调用**：当用户讨论相关话题时，AI 会自动加载此 Skill
- **用户手动调用**：用户可使用 `/your-skill-name` 命令主动触发

<!-- 参考型：删除上方触发说明，改为以下内容 -->
<!-- 本技能为参考型，仅 AI 自动调用，无斜杠命令。 -->

<!-- 任务型：删除上方触发说明，改为以下内容 -->
<!-- 本技能为任务型，用户通过 `/your-skill-name` 命令触发，AI 识别到相关意图时也可自动触发。 -->

## 核心原则
- 原则一
- 原则二
- 原则三

## 执行流程（用户手动调用时）
- 步骤一
- 步骤二
- 步骤三

详细规范请参考 [reference.md](./reference.md)

<!-- 类型切换指南：
  参考型：删除 user-invocable，删除触发说明中的用户手动调用，删除执行流程
  任务型：添加 Write/Edit/Bash/AskUserQuestion 权限
  敏感操作：取消注释 disable-model-invocation: true
  编号禁用：内容不使用编号（有序列表、步骤 N 等），用无序列表/标题/箭头表达顺序，规则见 reference.md#编号禁用规则
-->
