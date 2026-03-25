# Agent Teams

多Agent并行协作执行引擎，通过独立上下文解决上下文腐化问题。

## 核心设计

**主Agent只调度，子Agent执行**

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  主Agent (调度器)                                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 职责: 任务分解、依赖分析、调度、聚合结果                  │   │
│  │ 上下文: 保持精简 (< 25%)                                 │   │
│  │ 禁止: 直接修改代码、执行测试、探索代码库                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│              启动子Agent（获得独立200k上下文）                   │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 子Agent 1      │ 子Agent 2      │ 子Agent N             │   │
│  │ 独立上下文     │ 独立上下文     │ 独立上下文            │   │
│  │ 执行具体任务   │ 执行具体任务   │ 执行具体任务          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 三种执行机制

| 机制 | 工具 | 适用场景 | 通信 |
|------|------|---------|------|
| **独立Agent** | `Agent` | 探索、评审、独立任务 | 无 |
| **Team协作** | `TeamCreate`+`Agent` | 需要协作的开发任务 | `SendMessage` |
| **后台Task** | `Task` | 测试、构建、简单命令 | 无 |

## 快速开始

```javascript
const at = require('./scripts/index');

// 完整流程：分解 → 分析 → 调度
const plan = at.plan('.', '开发用户登录功能');

// 输出
// {
//   mission_id: 'mission-xxx',
//   task_type: 'develop',
//   decomposition: { total_tasks: 8, tasks: [...] },
//   analysis: { parallel_groups: [...], conflicts: [] },
//   schedule: { total_phases: 5, ... },
//   next_action: { action: 'launch_agents', agents: [...] }
// }
```

## API

```javascript
// 任务分解
at.decompose(request)           // 返回任务列表

// 依赖分析
at.analyzeDependencies(tasks)   // 返回并行组

// 调度计划
at.schedule(plan, baseDir)      // 返回执行计划

// 完整流程
at.plan(baseDir, request)       // 一站式API

// 状态管理
at.init(baseDir, goal)          // 初始化
at.checkpoint(baseDir, type)    // 创建检查点
at.complete(baseDir)            // 完成任务

// 上下文管理
at.contextUsage(baseDir)        // 获取使用情况
at.compress(baseDir, options)   // 压缩状态
at.getSummary(baseDir)          // 获取精简摘要

// Agent生命周期
at.getShutdownInstructions(teamName)  // 获取关闭指令
at.getCompressAgentInstruction(task)  // 获取压缩Agent指令
```

## 任务类型

| 类型 | 关键词 | Agent | 并行度 |
|------|--------|-------|--------|
| 探索 | 探索、分析、了解 | explorer | 8 |
| 开发 | 开发、实现、新增 | developer | 3 |
| 修复 | bug、修复、问题 | developer | 3 |
| 评审 | 评审、检查、审查 | reviewer | 4 |
| 部署 | 部署、发布、CI/CD | developer | 2 |
| 测试 | 测试、验证 | tester | 4 |

## 上下文腐化控制

### 压缩机制

状态文件超过80%阈值时，自动生成压缩任务指令：

```javascript
// recordChange 返回压缩指令
const compressTask = cm.recordChange('task_complete', data);

if (compressTask) {
  // 压缩任务指令
  // { action: 'launch_compress_agent', task: { agent: 'compressor', ... } }
}
```

### 压缩任务下发

```
主Agent检测到压缩需求
    │
    ├── 返回压缩指令
    │
    ▼
启动compressor子Agent
    │
    ├── 归档已完成任务
    ├── 保留最近5条任务
    └── 返回压缩摘要
    │
    ▼
主Agent继续执行
```

## Agent生命周期

| 类型 | 关闭方式 |
|------|---------|
| 独立Agent | 任务完成自动结束 |
| Team成员 | `SendMessage(shutdown_request)` → `TeamDelete()` |
| 后台Task | 自动结束或 `TaskStop()` |

```javascript
// 关闭Team
const instructions = at.getShutdownInstructions('my-team');
// 步骤1: SendMessage({ type: 'shutdown_request' })
// 步骤2: 等待 approve: true
// 步骤3: TeamDelete()
```

## 文件结构

```
scripts/
├── index.js           # 主API入口
└── lib/
    ├── decomposer.js  # 任务分解
    ├── analyzer.js    # 依赖分析
    ├── scheduler.js   # 调度器
    ├── context.js     # 上下文管理
    ├── checkpoint.js  # 检查点
    ├── wal.js         # WAL持久化
    └── utils.js       # 工具函数

config/agents/
├── explorer.yaml      # 探索Agent配置
├── developer.yaml     # 开发Agent配置
├── tester.yaml        # 测试Agent配置
├── reviewer.yaml      # 评审Agent配置
└── compressor.yaml    # 压缩Agent配置
```

## 文档

- [SKILL.md](SKILL.md) - 完整技能定义
- [engine/](engine/) - 执行引擎文档
- [theories/](theories/) - 理论基础