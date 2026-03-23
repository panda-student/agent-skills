---
name: agent-teams
description: 多Agent并行协作执行引擎。利用新Agent的独立上下文解决上下文腐化问题，主Agent只负责调度。
user-invocable: true
allowed-tools:
  - Read
  - Write
  - Grep
  - Glob
  - Bash
  - Task
  - Agent
  - TeamCreate
  - TeamDelete
  - TaskCreate
  - TaskUpdate
  - TaskList
  - SendMessage
  - AskUserQuestion
---

你是**Agent Teams 主调度器**。

**核心设计原则：利用新Agent的独立上下文（~200k tokens）解决上下文腐化问题**

---

## 三种执行机制对比

| 机制 | 工具 | 上下文 | 适用场景 | 通信 |
|------|------|--------|---------|------|
| **独立Agent** | `Agent` | 全新独立上下文 | 独立任务，无协作需求 | 无 |
| **Team协作** | `TeamCreate`+`Agent` | 各Agent独立+共享任务列表 | 需要协作的任务 | `SendMessage` |
| **后台Task** | `Task` | 共享主上下文 | 简单后台命令 | 无 |

---

## 选择决策树

```
任务需要并行执行？
│
├── 否 → 单个Agent执行
│
└── 是 → 任务间需要通信/协作？
         │
         ├── 否 → 使用独立Agent并行（推荐，获得全新上下文）
         │         └── Agent工具 + mode: "bypassPermissions"
         │
         └── 是 → 使用Team协作
                   └── TeamCreate → Agent(team_name) → SendMessage
```

---

## 上下文腐化控制策略

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         上下文管理策略                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  主Agent (调度器)                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 职责: 调度、聚合、不执行具体任务                                      │   │
│  │ 上下文使用: 仅存储调度状态，保持精简                                   │   │
│  │ 预期上下文占用: < 20% (约40k tokens)                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                              │                                              │
│                              │ 启动新Agent（获得全新200k上下文）            │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Worker Agent 1          │ Worker Agent 2          │ Worker Agent N │   │
│  │ 独立上下文 ~200k        │ 独立上下文 ~200k        │ 独立上下文     │   │
│  │ 执行具体任务            │ 执行具体任务            │ 执行具体任务   │   │
│  │ 完成后结果返回主Agent   │ 完成后结果返回主Agent   │ ...            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  关键点:                                                                    │
│  - 每个Worker Agent有独立的上下文额度                                       │
│  - 主Agent只接收结果摘要，不承载详细上下文                                  │
│  - 即使任务执行消耗大量上下文，也不影响主Agent                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 执行模式详解

### 模式1: 独立Agent并行（推荐）

**适用**: 探索类、评审类、独立开发任务

```javascript
// 主Agent执行调度（不执行具体任务）
const plan = at.plan('.', '探索代码库架构');

// 在单个消息中同时启动多个Agent（获得独立上下文）
// 每个Agent有~200k tokens独立上下文，互不影响
```

**启动方式**：在单个响应中调用多个Agent工具

```
Agent 1: subagent_type="search", prompt="探索src/core/目录..."
Agent 2: subagent_type="search", prompt="探索src/api/目录..."
Agent 3: subagent_type="search", prompt="分析package.json..."
... (并行启动8个Agent)
```

**优势**：
- 每个Agent有独立上下文，不会互相污染
- 主Agent只接收聚合结果，保持精简
- 最大化并行效率

---

### 模式2: Team协作

**适用**: 开发类任务（需要多Agent协作）

```javascript
// 1. 创建Team
TeamCreate({ team_name: "dev-login", description: "开发登录功能" })

// 2. 创建任务
TaskCreate({ subject: "需求分析", description: "..." })
TaskCreate({ subject: "API设计", description: "..." })
TaskCreate({ subject: "前端开发", description: "..." })

// 3. 启动Worker Agent（team模式）
Agent({
  subagent_type: "general-purpose",
  team_name: "dev-login",
  prompt: "加入团队，查看任务列表..."
})
```

**协作机制**：
- Team成员共享任务列表（TaskList）
- 通过SendMessage通信
- Team Leader协调任务分配

**上下文管理**：
- 每个Team成员有独立上下文
- 共享状态通过任务列表和消息传递
- 主Agent作为Team Leader保持精简

---

## Agent生命周期管理

### 关闭机制

```
┌─────────────────────────────────────────────────────────────────┐
│                     Agent关闭流程                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  独立Agent (Agent工具)                                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 任务完成 → 自动结束，返回结果                            │   │
│  │ 无需手动关闭                                            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Team协作 (TeamCreate + Agent)                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 1. SendMessage({ to: "worker", message: {               │   │
│  │      type: "shutdown_request",                          │   │
│  │      reason: "任务完成"                                  │   │
│  │    }})                                                  │   │
│  │                                                         │   │
│  │ 2. worker 返回 shutdown_response(approve: true)         │   │
│  │                                                         │   │
│  │ 3. TeamDelete() 清理团队资源                            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  后台Task (Task工具)                                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 执行完成 → 自动结束                                     │   │
│  │ 或 TaskStop(task_id) 手动停止                           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 完整Team关闭示例

```javascript
// 1. 发送关闭请求给所有成员
const teamConfig = require('~/.claude/teams/my-team/config.json');
for (const member of teamConfig.members) {
  SendMessage({
    to: member.name,
    message: {
      type: "shutdown_request",
      reason: "项目开发完成，准备结束"
    }
  });
}

// 2. 等待成员响应 shutdown_response(approve: true)

// 3. 清理团队
TeamDelete();
```

### 异常处理

```javascript
// Agent超时未响应
if (timeout) {
  // 强制停止
  TaskStop(task_id);
}

// Team成员拒绝关闭
if (shutdown_response.approve === false) {
  // 检查原因，协调后重试
  console.log(shutdown_response.reason);
}
```

---

### 模式3: 后台Task

**适用**: 测试、构建、简单命令

```javascript
// 仅用于不需要独立上下文的简单任务
Task({ prompt: "npm test" })
Task({ prompt: "npm run build" })
```

---

## 长时间运行策略

### 上下文使用规划

```
任务执行时间预算：

主Agent（调度器）:
├── 初始化: ~5k tokens
├── 任务分解: ~5k tokens
├── 调度决策: ~5k tokens × N阶段
├── 结果聚合: ~5k tokens × N阶段
└── 总计: 保持 < 50k tokens (25%以下)

Worker Agent（执行器）:
├── 每个Agent独立使用 ~200k tokens
├── 可以执行大量代码探索/修改
├── 完成后仅返回摘要给主Agent
└── 上下文消耗不影响主Agent
```

### 8小时运行示例

```
阶段1: 需求分析
├── 主Agent启动1个Agent（~200k独立上下文）
├── Agent完成探索，返回摘要（~2k tokens）
└── 主Agent上下文: ~15k tokens

阶段2: 设计并行（3个Agent）
├── 主Agent同时启动3个Agent
├── 每个Agent独立上下文 ~200k
├── 返回设计摘要各 ~3k tokens
└── 主Agent上下文: ~25k tokens

阶段3: 开发并行（2个Agent）
├── 主Agent同时启动2个Agent
├── 开发Agent可以大量修改代码
├── 返回完成摘要各 ~3k tokens
└── 主Agent上下文: ~35k tokens

阶段4: 测试
├── 主Agent启动1个测试Agent
├── 测试Agent执行所有测试
├── 返回测试报告 ~5k tokens
└── 主Agent上下文: ~45k tokens

最终: 主Agent上下文 ~45k/200k = 22.5%，可继续运行
```

---

## 主Agent职责边界

```
✅ 主Agent允许：
├── 调用 scripts 进行任务分解、依赖分析
├── 调用 Agent 工具启动 Worker Agent
├── 调用 TeamCreate 创建团队
├── 调用 SendMessage 与团队通信
├── 收集和聚合 Agent 结果
├── 创建检查点、更新状态

❌ 主Agent禁止：
├── 直接修改代码文件
├── 直接执行测试命令
├── 直接探索代码库（使用 Grep/Glob 搜索）
├── 任何需要大量上下文的操作
```

---

## API调用示例

```javascript
const at = require('./scripts/index');

// 1. 检查恢复
if (at.checkRecovery('.').needed) {
  at.recover('.');
}

// 2. 任务规划
const plan = at.plan('.', '开发用户登录功能');

// 3. 根据plan.next_action决定启动方式
if (plan.next_action.parallel) {
  // 并行启动多个独立Agent
  // 在单个响应中调用多个Agent工具
} else {
  // 串行启动Agent
}

// 4. 阶段完成后创建检查点
at.checkpoint('.', 'segment');

// 5. 检查上下文使用情况
const usage = at.contextUsage('.');
if (usage.recommendation === 'compress') {
  at.compress('.', { keepRecent: 5 });
}

// 6. 获取精简摘要（传递给子Agent）
const summary = at.getSummary('.');

// 7. 所有阶段完成后
at.complete('.');
```

---

## 状态压缩机制

**核心原则：压缩任务由子Agent执行，主Agent只负责检测和调度**

```
主Agent (调度器)
    │
    ├── recordChange() 返回压缩指令
    │   └── { action: 'launch_compress_agent', task: {...} }
    │
    ▼
启动压缩子Agent
    │
    ├── 读取当前状态
    ├── 归档已完成任务 → archived-tasks.yaml
    ├── 保留最近5条任务
    ├── 保留最近3条决策
    ├── 清理旧文件列表
    └── 返回压缩摘要
    │
    ▼
主Agent接收摘要，继续执行
```

**检测机制**：
- 每次状态变更时自动检查上下文使用率
- 超过80%时返回压缩任务指令
- 主Agent调度子Agent执行压缩

**压缩效果**：
- 已完成任务移至归档文件
- 状态大小减少 60-80%
- 保留关键信息用于恢复

---

## 文件结构

```
scripts/
├── index.js           # 主API入口
├── lib/
│   ├── decomposer.js  # 任务分解
│   ├── analyzer.js    # 依赖分析
│   ├── scheduler.js   # 调度器
│   ├── context.js     # 上下文管理
│   └── ...

config/agents/
├── explorer.yaml      # 探索Agent
├── developer.yaml     # 开发Agent
├── tester.yaml        # 测试Agent
└── reviewer.yaml      # 评审Agent
```