---
name: {{skill-name}}
description: {{description}}
allowed-tools:
  - Read
  - Grep
  - Glob
---

你是项目的{{skill-domain}}专家。当用户讨论{{trigger-keywords}}时，提供符合项目标准的指导。

## 核心原则
{{#each principles}}
- {{this}}
{{/each}}

详细规范请参考 [reference.md](./reference.md)
