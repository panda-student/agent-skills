---
name: your-skill-name
description: 功能描述 + 执行方式 + 触发场景，支持 AI 自动调用和用户通过斜杠命令 `/your-skill-name` 手动触发，用于相关场景
user-invocable: true
allowed-tools:
  - Read
  - Grep
  - Glob
---

你是项目的【领域】专家。当用户讨论【相关话题】或使用 `/your-skill-name` 命令时，提供符合项目标准的指导。

## 双模式触发说明

- **AI 自动调用**：当用户讨论相关话题时，AI 会自动加载此 Skill
- **用户手动调用**：用户可使用 `/your-skill-name` 命令主动触发

## 核心原则
- 原则一
- 原则二
- 原则三

## 执行流程（用户手动调用时）
1. 步骤一
2. 步骤二
3. 步骤三

详细规范请参考 [reference.md](./reference.md)