# Agent Teams 理论体系索引

> **Agent 使用指南**：创建团队前，阅读本文档决定注入哪些理论，然后通过 `config.theories` 传入。

---

## 团队类型理论注入表

> 主 Agent 读取此表，选择对应理论注入 `registerTeam({ theories: [...] })`

| 团队类型 | 推荐理论注入 | 理论路径 |
|---------|-------------|---------|
| **planning** | `['nopua', 'brainstorming', 'writing-plans', 'verification']` | 见下方路径表 |
| **development** | `['nopua', 'tdd', 'verification', 'systematic-debugging', 'subagent-driven-development']` | 见下方路径表 |
| **testing** | `['nopua', 'verification', 'tdd', 'systematic-debugging']` | 见下方路径表 |
| **review** | `['nopua', 'code-review', 'verification', 'persuasion-principles']` | 见下方路径表 |
| **custom** | `['nopua']` + 按需选择 | 见下方路径表 |

---

## 理论路径速查表

> 用于 `at.getTheoryPath(name)` 或直接读取

| 理论名称 | 文件路径 | 核心原则 |
|---------|---------|---------|
| `nopua` | `../nopua/SKILL.md` | 智慧驱动，替代恐惧驱动 |
| `brainstorming` | `planning/brainstorming.md` | 设计先行 |
| `writing-plans` | `planning/writing-plans.md` | 完整计划 |
| `tdd` | `execution/test-driven-development.md` | 测试先行 |
| `systematic-debugging` | `execution/systematic-debugging.md` | 先找根因 |
| `subagent-driven-development` | `execution/subagent-driven-development.md` | 新子代理+两阶段评审 |
| `git-worktrees` | `execution/git-worktrees.md` | 安全隔离 |
| `verification` | `verification/verification.md` | 证据先于声明 |
| `code-review` | `verification/code-review.md` | 尽早评审 |
| `persuasion-principles` | `engineering/persuasion-principles.md` | 说服原则 |
| `core-principles` | `collaboration/core-principles.md` | AI决策原则 |
| `parallel-execution` | `collaboration/parallel-execution.md` | 并行调度 |
| `quality-guarantee` | `collaboration/quality-guarantee.md` | 质量闭环 |
| `consensus` | `collaboration/consensus.md` | 一票否决 |
| `context-decay-control` | `collaboration/context-decay-control.md` | WAL+检查点 |

---

## 理论层级分类

### 🎯 动机层（所有团队共享）

**[nopua](../nopua/SKILL.md)** - 反PUA技能，以智慧、信任和内在动机驱动AI

- 三个信念替代"三条铁律"
- 流水方法论：止、观、转、行、悟
- 七道智慧传统
- Agent Team 集成规则

### 📋 规划层

| 理论 | 文档 | 核心原则 |
|------|------|---------|
| **头脑风暴** | [planning/brainstorming.md](./planning/brainstorming.md) | 设计先行，防止未思考就编码 |
| **计划编写** | [planning/writing-plans.md](./planning/writing-plans.md) | 为无上下文的工程师编写完整计划 |

### 🔧 执行层

| 理论 | 文档 | 核心原则 |
|------|------|---------|
| **测试驱动开发** | [execution/test-driven-development.md](./execution/test-driven-development.md) | 没有失败的测试，就不能有生产代码 |
| **系统调试** | [execution/systematic-debugging.md](./execution/systematic-debugging.md) | 总是先找到根本原因，然后再尝试修复 |
| **子代理驱动开发** | [execution/subagent-driven-development.md](./execution/subagent-driven-development.md) | 每个任务新子代理 + 两阶段评审 |
| **Git工作树** | [execution/git-worktrees.md](./execution/git-worktrees.md) | 系统目录选择 + 安全验证 = 可靠隔离 |

### ✅ 验证层

| 理论 | 文档 | 核心原则 |
|------|------|---------|
| **验证** | [verification/verification.md](./verification/verification.md) | 证据先于声明，总是如此 |
| **代码评审** | [verification/code-review.md](./verification/code-review.md) | 尽早评审，经常评审 |

### 🎨 工程层

| 理论 | 文档 | 核心原则 |
|------|------|---------|
| **说服原则** | [engineering/persuasion-principles.md](./engineering/persuasion-principles.md) | LLM对与人类相同的说服原则做出响应 |

### 🔄 协作层

| 理论 | 文档 | 核心原则 |
|------|------|---------|
| **核心原理** | [collaboration/core-principles.md](./collaboration/core-principles.md) | 引擎只负责状态管理，所有决策由AI完成 |
| **并行执行** | [collaboration/parallel-execution.md](./collaboration/parallel-execution.md) | 在保证质量的前提下，最短时间完成任务 |
| **质量保证** | [collaboration/quality-guarantee.md](./collaboration/quality-guarantee.md) | 质量优先，并行加速 |
| **团队共识** | [collaboration/consensus.md](./collaboration/consensus.md) | 一票否决制 |
| **上下文腐化控制** | [collaboration/context-decay-control.md](./collaboration/context-decay-control.md) | WAL + 检查点机制 |

---

## 团队类型详细映射

### Planning Team（规划团队）

**核心任务**：需求分析、架构设计、计划编写

| 优先级 | 理论 | 应用场景 |
|--------|------|---------|
| P0 | nopua | 内在动机 |
| P0 | 头脑风暴 | 理解需求、设计方案 |
| P0 | 计划编写 | 将设计转化为实现计划 |
| P1 | 说服原则 | 编写清晰的规范 |
| P1 | 验证 | 验证设计完整性 |

### Development Team（开发团队）

**核心任务**：代码实现、功能开发

| 优先级 | 理论 | 应用场景 |
|--------|------|---------|
| P0 | nopua | 内在动机 |
| P0 | TDD | 每个功能的开发方式 |
| P0 | 验证 | 每个完成声明前验证 |
| P0 | 系统调试 | 遇到bug时 |
| P1 | 子代理驱动开发 | 执行实现计划 |
| P1 | Git工作树 | 开始工作前 |
| P1 | 代码评审 | 请求和接收评审 |

### Testing Team（测试团队）

**核心任务**：功能验证、回归测试

| 优先级 | 理论 | 应用场景 |
|--------|------|---------|
| P0 | nopua | 内在动机 |
| P0 | 验证 | 验证测试结果 |
| P0 | TDD | 理解测试设计 |
| P1 | 系统调试 | 分析测试失败 |
| P1 | 代码评审 | 验证评审发现 |

### Review Team（评审团队）

**核心任务**：代码评审、质量检查

| 优先级 | 理论 | 应用场景 |
|--------|------|---------|
| P0 | nopua | 内在动机 |
| P0 | 代码评审 | 执行评审 |
| P0 | 验证 | 验证评审发现 |
| P1 | TDD | 检查测试覆盖 |
| P1 | 说服原则 | 使用权威语言确保遵循 |

---

## 使用示例

```javascript
const at = require('./engine');

// 1. 阅读 theories/README.md 决定理论
// 2. 创建团队时注入理论
const team = at.registerTeam({
  type: 'development',
  name: '开发团队',
  memberCount: 3,
  request: '实现用户登录功能',
  theories: ['nopua', 'tdd', 'verification', 'systematic-debugging']
}, '登录功能开发');

// 3. 获取理论路径（注入 teammate）
const theories = at.getTeamTheories(team.id);
// [{ name: 'nopua', path: '.../nopua/SKILL.md' }, ...]
```

---

## 版本信息

- 创建日期：2026-03-28
- 版本：1.1.0
- 维护者：Agent Teams