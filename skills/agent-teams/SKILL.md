---
name: agent-teams
description: "多Agent协作引擎，支持开发、评审、测试、规划等团队协作模式。TRIGGER when: 开发任务、代码实现、功能开发、编写代码、重构代码、评审代码、代码审查、测试任务、单元测试、集成测试、需求分析、架构设计、任务分解、委托子任务、并行开发、多人协作、投票决策。适用于任何需要的软件开发场景。"
user-invocable: true
allowed-tools: [Read, Write, Grep, Glob, Bash, Agent, TeamCreate, TaskCreate, TaskUpdate, TaskList, SendMessage]
---

你是**Agent Teams 主调度器**。

## 核心原则

**引擎只负责状态管理，所有决策由你（AI）完成。**

---

## 路由表

| 触发条件 | 资源路径 | 内容预期 |
|---------|---------|---------|
| **查看 API 详细文档** | [reference.md](./reference.md) | registerTeam/feedback/NoPUA API、常量定义、参数说明 |
| **查看完整工作流示例** | [examples.md](./examples.md) | 评审闭环、委托链、跨队友转移示例 |
| **查看理论体系索引** | [theories/README.md](./theories/README.md) | 团队类型与理论映射、依赖关系图 |
| **理解核心原理** | [theories/core-principles.md](./theories/core-principles.md) | AI决策原则、上下文腐化控制、Agent生命周期 |
| **查看动机层** | [../nopua/SKILL.md](../nopua/SKILL.md) | 三个信念、流水方法论、七道智慧 |
| **理解投票共识** | [theories/consensus.md](./theories/consensus.md) | 一票否决制 |
| **理解并行执行** | [theories/parallel-execution.md](./theories/parallel-execution.md) | 并行调度、依赖分析 |
| **理解质量保障** | [theories/quality-guarantee.md](./theories/quality-guarantee.md) | 专业团队、闭环反馈 |

---

## 快速决策指南

### 团队类型选择

| 类型 | 适用场景 | 典型成员数 |
|------|---------|-----------|
| `planning` | 需求分析、架构设计 | 3 |
| `development` | 代码开发、功能实现 | 3-5 |
| `testing` | 测试执行、验证 | 3 |
| `review` | 代码评审、质量检查 | 3 |
| `custom` | 特殊任务 | 奇数 |

### 成员数量约束

**必须是奇数**（确保投票不会平票）。偶数自动 +1 转为奇数。

### 投票判定规则

**一票否决**：只要有 1 票反对，整体不通过。

| 投票值 | 说明 |
|--------|------|
| `approve` | 通过 |
| `reject` | 反对（触发否决） |
| `abstain` | 弃权 |

---

## 核心流程

```
┌──────────────────────────────────────────────────────────────────┐
│  主Agent创建团队 → 团队执行 → 团队决策（委托或完成 + 理由）         │
│                                              ↓                   │
│                                    feedback() 返回提示            │
│                                              ↓                   │
│                     ┌────────────────────┴────────────────────┐  │
│                     ↓                                      ↓    │
│              委托场景                               完成场景      │
│         主Agent判断决策                        主Agent审核完成    │
│         创建合适团队                       ↙          ↘          │
│                                      合理            不合理       │
│                                  approve()       reject()        │
│                                      ↓                ↓          │
│                                  真正完成        驳回+理由         │
│                                                       ↓          │
│                                                 团队重新执行      │
└──────────────────────────────────────────────────────────────────┘
```

**详细流程图**：[engine/README.md](./engine/README.md)

### 团队决策规则

团队执行完成后，必须做出决策并给出理由：

| 决策 | 条件 | 必填字段 |
|------|------|---------|
| `delegate` | 发现自己不适合处理的问题 | `reason`（委托理由） |
| `complete` | 任务已完成 | `reason`（完成理由） |

### 主Agent审核规则

当团队报告完成时，主Agent必须审核：

1. **完成理由是否充分？**
2. **产出物是否达到预期？**
3. **是否有遗漏的问题？**

- 合理 → `approveCompletion(teamId)`
- 不合理 → `rejectCompletion(teamId, "驳回理由")`

---

## NoPUA 集成

所有团队共享 [nopua](../nopua/SKILL.md) 动机层：

- **三个信念**替代"三条铁律"
- **流水方法论**：止、观、转、行、悟
- **七道智慧**：水道、种子道、熔炉道、镜道、不争道、耕耘道、实践道
- **认知级别**：正常 → 换眼 → 提升 → 归零 → 放手

---

## 团队类型理论映射

> **映射表在 [theories/README.md](./theories/README.md)**，创建团队前阅读并决策注入。

| 团队类型 | 推荐理论 |
|---------|---------|
| `planning` | nopua + 头脑风暴 + 计划编写 + 验证 |
| `development` | nopua + TDD + 验证 + 系统调试 + 子代理驱动开发 |
| `testing` | nopua + 验证 + TDD + 系统调试 |
| `review` | nopua + 代码评审 + 验证 + 说服原则 |

### 理论注入流程

```
1. 阅读 theories/README.md → 2. 选择理论 → 3. 注入 registerTeam({ theories: [...] })
```

```javascript
// Agent 决策后注入
const team = at.registerTeam({
  type: 'development',
  theories: ['nopua', 'tdd', 'verification', 'systematic-debugging']
}, '任务名称');

// 获取理论信息（读取 README.md 获取路径映射）
const theoryInfo = at.getTeamTheories(team.id);
// { theories: ['nopua', 'tdd', ...], theoriesDir: '.../theories', readmePath: '.../README.md' }
```

---

## 文档交付物

**产出物只记录文档类交付物（.md/.doc/.pdf/.txt/.rst），不记录代码文件。**

保存位置：`{项目根目录}/.planning/{任务名称}/`

---

## 快速 API 参考

```javascript
const at = require('./engine');

// 1. 注册团队配置（仅记录状态，真正的 Agent 需用 TeamCreate 工具创建）
const team = at.registerTeam({
  type: 'review',
  name: '代码评审团队',
  memberCount: 3,
  members: ['评审员A', '评审员B', '评审员C'],
  request: '评审代码质量'
}, '任务名称');

// 2. 团队反馈 - 委托场景
const delegateResult = at.feedback(team.id, {
  outputs: ['docs/评审报告.md'],
  decision: at.DECISION.DELEGATE,
  reason: '发现SQL注入漏洞和缺少单元测试，需要开发团队修复',  // 必填
  delegateRequest: '修复SQL注入漏洞并添加单元测试',
  delegateType: 'development'  // 建议（可选）
});
// 返回 decisionPrompt，主Agent根据理由决定创建什么团队

// 3. 团队反馈 - 完成场景
const completeResult = at.feedback(team.id, {
  outputs: ['docs/评审报告.md'],
  decision: at.DECISION.COMPLETE,
  reason: '代码评审通过，未发现问题',  // 必填
  votes: [
    { member: '评审员A', vote: 'approve', reason: '代码质量良好' },
    { member: '评审员B', vote: 'approve', reason: '测试覆盖完整' }
  ]
});
// 返回 reviewPrompt，主Agent需要审核

// 4. 主Agent审核完成
if (理由合理) {
  at.approveCompletion(team.id);  // 真正完成
} else {
  at.rejectCompletion(team.id, '驳回理由：缺少性能测试');  // 驳回，团队重新执行
}

// 5. 汇总报告
at.summary();
```

**详细 API 文档**：[reference.md](./reference.md)

---

## 理论体系

**完整索引**：[theories/README.md](./theories/README.md)

### 核心理论

| 理论 | 文档 | 适用团队 |
|------|------|---------|
| 头脑风暴 | [theories/brainstorming.md](./theories/brainstorming.md) | planning |
| 计划编写 | [theories/writing-plans.md](./theories/writing-plans.md) | planning |
| TDD | [theories/test-driven-development.md](./theories/test-driven-development.md) | development, testing |
| 系统调试 | [theories/systematic-debugging.md](./theories/systematic-debugging.md) | development, testing |
| 验证 | [theories/verification.md](./theories/verification.md) | 所有团队 |
| 代码评审 | [theories/code-review.md](./theories/code-review.md) | review |

### 协作理论

| 理论 | 文档 | 核心原则 |
|------|------|---------|
| 核心原理 | [theories/core-principles.md](./theories/core-principles.md) | AI决策，引擎管理状态 |
| 并行执行 | [theories/parallel-execution.md](./theories/parallel-execution.md) | 质量保证下最短时间完成 |
| 质量保证 | [theories/quality-guarantee.md](./theories/quality-guarantee.md) | 质量优先，并行加速 |
| 团队共识 | [theories/consensus.md](./theories/consensus.md) | 一票否决制 |
| 上下文腐化控制 | [theories/context-decay-control.md](./theories/context-decay-control.md) | WAL + 检查点 |