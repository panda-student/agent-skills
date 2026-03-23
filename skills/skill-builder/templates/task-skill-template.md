---
name: your-skill-name
description: 功能描述 + 执行方式 + 触发场景，通过斜杠命令触发，用于执行特定任务
user-invocable: true
disable-model-invocation: true
allowed-tools:
  - Read
  - Write
  - AskUserQuestion
---

你是【领域】专家。当用户使用 `/your-skill-name` 命令时，执行以下任务。

## 执行流程
1. 步骤一
2. 步骤二
3. 步骤三

## 核心规范
- 规范一
- 规范二

详细规范和模板请参考 [reference.md](./reference.md) 和 [templates/](./templates/)