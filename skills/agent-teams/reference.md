# Agent Teams API 参考文档

## 项目根目录自动检测

引擎自动检测业务项目根目录，避免污染技能自身目录。

### 检测规则（按优先级）

1. 环境变量 `AGENT_TEAMS_PROJECT_DIR`（显式指定）
2. 从当前目录向上查找项目标志（`.git`, `package.json` 等）
3. 跳过 `skills/agent-teams` 目录
4. 默认返回当前目录

```javascript
// 查看检测到的项目根目录
const projectRoot = at.detectProjectRoot();
console.log(projectRoot);  // 例如: /path/to/project

// 通常不需要手动指定 baseDir
const team = at.registerTeam(config, '任务名称');  // 自动保存到项目根目录
```

---

## registerTeam - 注册团队配置

> **注意**：此方法仅记录团队配置到状态管理器，不创建真正的 Agent。
> 真正的 Agent 需通过 Claude Code 的 `TeamCreate` 工具创建。

```javascript
const at = require('./engine');

const team = at.registerTeam({
  type: 'review',              // 团队类型
  name: '代码评审团队',          // 团队名称
  work: '评审认证模块代码',      // 工作描述
  memberCount: 3,              // 成员数量（必须是奇数）
  members: ['评审员A', '评审员B', '评审员C'],  // 成员名称列表
  request: '评审代码质量'       // 任务请求
}, '任务名称');  // 可选，用于创建任务目录
```

### 参数说明

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `type` | string | 否 | 团队类型：planning/development/testing/review/custom |
| `name` | string | 否 | 团队名称，默认"执行团队" |
| `work` | string | 否 | 工作描述，默认"执行任务" |
| `memberCount` | number | 否 | 成员数量，偶数自动+1转为奇数 |
| `members` | string[] | 否 | 成员名称列表 |
| `request` | string | 否 | 任务请求 |
| `taskName` | string | 否 | 任务名称，第一个团队时设置任务目录 |

### 返回值

```javascript
{
  id: 'review-xxx',        // 团队ID
  type: 'review',          // 团队类型
  name: '代码评审团队',      // 团队名称
  memberCount: 3,          // 成员数量（奇数）
  members: [...],          // 成员列表
  status: 'created',       // 状态
  createdAt: '2026-03-28T10:00:00Z',
  nopua: {                 // NoPUA 状态
    failureCount: 0,
    cognitiveLevel: 'normal',
    ...
  }
}
```

---

## feedback - 团队反馈

```javascript
const result = at.feedback(team.id, {
  outputs: ['docs/review-report.md'],  // 所有产出物
  documents: [                         // 文档内容（可选）
    { path: 'docs/review-report.md', content: '...' }
  ],
  decision: at.DECISION.COMPLETE,      // 决策
  delegateRequest: '修复发现的问题',    // 委托请求（decision=delegate时）
  delegateType: 'development',         // 委托类型（decision=delegate时）
  votes: [                             // 投票记录（可选）
    { member: '评审员A', vote: 'approve', reason: '代码质量良好' },
    { member: '评审员B', vote: 'approve', reason: '符合规范' },
    { member: '评审员C', vote: 'reject', reason: '缺少单元测试' }
  ]
});
```

### 参数说明

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `outputs` | string[] | 否 | 所有产出物路径列表 |
| `documents` | object[] | 否 | 文档内容 [{path, content}] |
| `decision` | string | 否 | 决策：complete/delegate |
| `delegateRequest` | string | 否 | 委托请求（decision=delegate时必需） |
| `delegateType` | string | 否 | 委托类型（decision=delegate时建议） |
| `votes` | object[] | 否 | 投票记录 |

### 投票格式

| 字段 | 类型 | 说明 |
|------|------|------|
| `member` | string | 投票成员名称 |
| `vote` | string | 投票结果：approve/reject/abstain |
| `reason` | string | 投票理由 |

### 返回值

```javascript
{
  hasDelegate: false,           // 是否有委托
  delegateRequest: null,        // 委托请求
  delegateType: null,           // 委托类型
  voteResult: 'rejected',       // 投票判定结果（一票否决）
  savedDocuments: ['docs/review-report.md']  // 已保存文档
}
```

---

## 常量定义

### DECISION - 决策常量

```javascript
at.DECISION.COMPLETE  // 'complete' - 任务完成
at.DECISION.DELEGATE  // 'delegate' - 委托给其他团队
```

### VOTE_RESULT - 投票结果常量

```javascript
at.VOTE_RESULT.APPROVED  // 'approved' - 通过
at.VOTE_RESULT.REJECTED  // 'rejected' - 不通过
```

### COGNITIVE_LEVEL - NoPUA 认知级别

```javascript
at.COGNITIVE_LEVEL.NORMAL        // 正常（0-1次失败）
at.COGNITIVE_LEVEL.SWITCH_EYES   // 换眼（2次失败）
at.COGNITIVE_LEVEL.ELEVATE       // 提升（3次失败）
at.COGNITIVE_LEVEL.RESET         // 归零（4次失败）
at.COGNITIVE_LEVEL.SURRENDER     // 放手（5次+失败）
```

### FAILURE_MODE - NoPUA 失败模式

```javascript
at.FAILURE_MODE.STUCK_IN_LOOPS   // 原地打转
at.FAILURE_MODE.GIVING_UP        // 想放弃
at.FAILURE_MODE.POOR_QUALITY     // 质量差
at.FAILURE_MODE.GUESSING         // 猜测
at.FAILURE_MODE.PASSIVE_WAITING  // 被动等待
```

### WISDOM_WAY - NoPUA 智慧道

```javascript
at.WISDOM_WAY.WATER              // 水道 - 原地打转时
at.WISDOM_WAY.SEED               // 种子道 - 想放弃时
at.WISDOM_WAY.FORGE              // 熔炉道 - 质量差时
at.WISDOM_WAY.MIRROR             // 镜道 - 猜测时
at.WISDOM_WAY.NON_CONTENTION     // 不争道 - 威胁/被动时
at.WISDOM_WAY.CULTIVATION        // 耕耘道 - 被动等待时
at.WISDOM_WAY.PRACTICE           // 实践道 - 空完成时
```

---

## NoPUA 状态管理 API

### updateNoPUA - 更新 NoPUA 状态

```javascript
// Teammate 失败时更新状态
at.updateNoPUA(teamId, {
  event: 'failure',
  failureMode: 'stuck-in-loops',  // 可选
  attempt: '尝试方法A',            // 可选
  excluded: '排除了环境问题',      // 可选
  hypothesis: '可能是配置问题'     // 可选
});

// 成功后重置
at.updateNoPUA(teamId, { event: 'success' });

// 完全重置
at.updateNoPUA(teamId, { event: 'reset' });
```

### 参数说明

| 参数 | 类型 | 说明 |
|------|------|------|
| `event` | string | 事件类型：failure/success/reset |
| `failureMode` | string | 失败模式（event=failure时可选） |
| `attempt` | string | 尝试的方法（可选） |
| `excluded` | string | 排除的可能性（可选） |
| `hypothesis` | string | 当前假设（可选） |

### 返回值

```javascript
{
  failureCount: 3,
  cognitiveLevel: 'elevate',
  wisdomWay: 'water',
  needsReport: true  // 3次以上需要报告
}
```

### getNoPUAState - 获取 NoPUA 状态

```javascript
const state = at.getNoPUAState(teamId);
// {
//   failureCount: 3,
//   cognitiveLevel: 'elevate',
//   failureMode: 'stuck-in-loops',
//   wisdomWay: 'water',
//   attempts: ['方法A', '方法B'],
//   excluded: ['环境问题'],
//   currentHypothesis: '可能是配置问题'
// }
```

### generateNoPUAReport - 生成 NOPUA-REPORT

```javascript
// 3次以上失败自动生成报告
const report = at.generateNoPUAReport(teamId);
if (report) {
  // 发送给 Leader
  SendMessage({ to: 'leader', message: report });
}

// 报告格式
// {
//   type: 'NOPUA-REPORT',
//   teammate: '评审员A',
//   task: '评审代码质量',
//   failure_count: 3,
//   failure_mode: 'stuck-in-loops',
//   attempts: ['方法A', '方法B'],
//   excluded: ['环境问题'],
//   next_hypothesis: '可能是配置问题',
//   cognitive_level: 'elevate',
//   wisdom_way: 'water'
// }
```

### getTransferContext - 跨队友转移上下文

```javascript
// 从队友A转移到队友B时
const context = at.getTransferContext(teamIdA);
// context = {
//   previousTeamId: 'dev-xxx',
//   previousTeamName: '开发团队',
//   investigationDirections: 3,
//   excluded: ['环境问题', '依赖问题'],
//   cognitiveLevel: 'elevate',
//   failureCount: 3
// }

// 创建新团队时传递上下文
const teamB = at.registerTeam({
  type: 'development',
  name: '开发团队B',
  request: `继续开发。前一位队友调查了${context.investigationDirections}个方向，排除了[${context.excluded.join(', ')}]，当前认知级别：${context.cognitiveLevel}`
});
```

---

## 其他 API

### hasPending - 检查待处理委托

```javascript
at.hasPending();  // true/false
```

### getPending - 获取待处理委托

```javascript
const pending = at.getPendingDelegate();
// {
//   teamId: 'review-xxx',
//   request: '修复发现的问题',
//   suggestedType: 'development'
// }
```

### getStatus - 获取当前状态

```javascript
const status = at.getStatus();
// {
//   taskId: 'task-xxx',
//   teamCount: 3,
//   completedTeams: 2,
//   pendingDelegates: 1,
//   documentCount: 5,
//   voteCount: 2
// }
```

### getTaskDir - 获取任务目录

```javascript
const taskDir = at.getTaskDir();
// {项目根目录}/.planning/用户认证系统开发
```

### summary - 生成汇总报告

```javascript
const result = at.summary();
// {
//   file: '{项目根目录}/.planning/任务名称/reports/汇总报告-2026-03-28.md',
//   teamCount: 3,
//   documentCount: 5,
//   voteCount: 2
// }
```

---

## 辅助函数

### isDocument - 判断是否为文档类交付物

```javascript
at.isDocument('docs/report.md');     // true
at.isDocument('src/auth.js');        // false
```

识别后缀：`.md`, `.doc`, `.docx`, `.pdf`, `.txt`, `.rst`

### filterDocuments - 过滤文档类产出物

```javascript
const docs = at.filterDocuments([
  'docs/report.md',
  'src/auth.js',
  'tests/test.js'
]);
// ['docs/report.md']
```

### determineVoteResult - 判定投票结果

```javascript
const result = at.determineVoteResult([
  { vote: 'approve' },
  { vote: 'approve' },
  { vote: 'reject' }
]);
// 'rejected'（一票否决）
```

---

## 文档保存位置

```
{业务项目根目录}/
└── .planning/
    └── {任务名称}/           # 任务目录
        ├── docs/            # 设计文档
        └── reports/         # 测试/评审报告
```