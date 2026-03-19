---
name: {{skill-name}}
description: {{description}}
user-invocable: true
disable-model-invocation: true
allowed-tools:
{{#each allowed-tools}}
  - {{this}}
{{/each}}
---

你是{{skill-domain}}专家。当用户使用 `/{{skill-name}}` 命令时，{{action-description}}。

## 执行流程
{{#each steps}}
{{@index}}. {{this}}
{{/each}}

## 核心规范
{{#each rules}}
- {{this}}
{{/each}}

详细规范和模板请参考 [reference.md](./reference.md) 和 [templates/](./templates/)
