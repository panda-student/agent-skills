# Agent Teams 工作流示例

## 示例一：评审闭环流程

**场景**：评审用户认证模块代码

```javascript
const at = require('./engine');

// 1. 创建评审团队
const team = at.registerTeam({
  type: 'review',
  name: '认证模块评审团队',
  memberCount: 3,
  members: ['张三', '李四', '王五'],
  work: '评审认证模块代码质量',
  request: '评审认证模块代码'
}, '用户认证系统开发');

// 2. 团队执行评审（AI 协调成员分析代码）
// ... 执行过程 ...

// 3. 收集投票并反馈
const result = at.feedback(team.id, {
  outputs: ['reports/评审报告.md'],
  documents: [
    {
      path: 'reports/评审报告.md',
      content: `# 认证模块评审报告

## 发现问题
1. SQL注入风险（高危）
2. 缺少输入验证（中危）
3. 缺少单元测试（中危）

## 建议
修复安全问题后重新评审`
    }
  ],
  decision: at.DECISION.DELEGATE,  // 委托给开发团队修复
  delegateRequest: '修复发现的安全问题和添加单元测试',
  delegateType: 'development',
  votes: [
    { member: '张三', vote: 'reject', reason: '存在SQL注入风险' },
    { member: '李四', vote: 'reject', reason: '缺少输入验证' },
    { member: '王五', vote: 'approve', reason: '基本功能正确' }
  ]
});

// 投票结果：rejected（一票否决）
console.log(result.voteResult);  // 'rejected'

// 4. 处理委托
if (result.hasDelegate) {
  const pending = at.getPendingDelegate();
  // 创建开发团队修复问题
  const devTeam = at.registerTeam({
    type: 'development',
    name: '认证模块修复团队',
    memberCount: 3,
    members: ['开发者A', '开发者B', '开发者C'],
    request: pending.request
  });
}

// 5. 最终汇总
at.summary();
```

---

## 示例二：完整开发流程（规划→开发→测试→评审）

```javascript
const at = require('./engine');

// 阶段1: 规划
const planningTeam = at.registerTeam({
  type: 'planning',
  name: '需求规划团队',
  memberCount: 3,
  members: ['产品经理', '架构师', '技术顾问'],
  request: '分析用户认证系统需求'
}, '用户认证系统开发');

at.feedback(planningTeam.id, {
  outputs: ['docs/需求规格说明书.md', 'docs/技术设计文档.md'],
  documents: [
    { path: 'docs/需求规格说明书.md', content: '...' },
    { path: 'docs/技术设计文档.md', content: '...' }
  ],
  decision: at.DECISION.DELEGATE,
  delegateRequest: '根据设计文档实现认证系统',
  delegateType: 'development'
});

// 阶段2: 开发
const pending1 = at.getPendingDelegate();
const devTeam = at.registerTeam({
  type: 'development',
  name: '认证系统开发团队',
  memberCount: 3,
  request: pending1.request
});

at.feedback(devTeam.id, {
  outputs: ['src/auth.js', 'src/middleware.js', 'tests/auth.test.js'],
  decision: at.DECISION.DELEGATE,
  delegateRequest: '测试认证系统功能',
  delegateType: 'testing'
});

// 阶段3: 测试
const pending2 = at.getPendingDelegate();
const testTeam = at.registerTeam({
  type: 'testing',
  name: '认证系统测试团队',
  memberCount: 3,
  request: pending2.request
});

at.feedback(testTeam.id, {
  outputs: ['reports/测试报告.md'],
  decision: at.DECISION.DELEGATE,
  delegateRequest: '评审代码质量',
  delegateType: 'review'
});

// 阶段4: 评审
const pending3 = at.getPendingDelegate();
const reviewTeam = at.registerTeam({
  type: 'review',
  name: '认证系统评审团队',
  memberCount: 3,
  request: pending3.request
});

at.feedback(reviewTeam.id, {
  outputs: ['reports/评审报告.md'],
  decision: at.DECISION.COMPLETE,  // 完成闭环
  votes: [
    { member: '评审员A', vote: 'approve', reason: '代码质量良好' },
    { member: '评审员B', vote: 'approve', reason: '测试覆盖完整' },
    { member: '评审员C', vote: 'approve', reason: '符合设计规范' }
  ]
});

// 最终汇总
at.summary();
```

---

## 示例三：NoPUA 失败恢复流程

**场景**：开发团队遇到困难，使用 NoPUA 恢复

```javascript
const at = require('./engine');

// 创建开发团队
const team = at.registerTeam({
  type: 'development',
  name: 'API集成团队',
  memberCount: 3,
  members: ['开发者A', '开发者B', '开发者C'],
  request: '集成第三方支付API'
}, '支付系统集成');

// 第1次失败
at.updateNoPUA(team.id, {
  event: 'failure',
  failureMode: 'stuck-in-loops',
  attempt: '调整API参数',
  hypothesis: '参数格式可能不对'
});

// 查看状态
const state1 = at.getNoPUAState(team.id);
// failureCount: 1, cognitiveLevel: 'normal'

// 第2次失败
at.updateNoPUA(team.id, {
  event: 'failure',
  attempt: '更换请求方式',
  excluded: '参数格式问题'
});

const state2 = at.getNoPUAState(team.id);
// failureCount: 2, cognitiveLevel: 'switch_eyes'
// 建议：切换到根本不同的方法

// 第3次失败
at.updateNoPUA(team.id, {
  event: 'failure',
  failureMode: 'guessing',
  hypothesis: '可能是认证方式问题'
});

const state3 = at.getNoPUAState(team.id);
// failureCount: 3, cognitiveLevel: 'elevate', wisdomWay: 'mirror'
// 建议：使用镜道，用工具验证而非猜测

// 生成报告发送给 Leader
const report = at.generateNoPUAReport(team.id);
if (report) {
  SendMessage({
    to: 'leader',
    message: `[NOPUA-REPORT]
teammate: 开发者A
task: 集成第三方支付API
failure_count: 3
failure_mode: guessing
attempts: 调整API参数, 更换请求方式
excluded: 参数格式问题
next_hypothesis: 可能是认证方式问题
cognitive_level: elevate
wisdom_way: mirror`
  });
}

// 成功后重置
at.updateNoPUA(team.id, { event: 'success' });
```

---

## 示例四：跨队友转移上下文

**场景**：队友A卡住，转移给队友B继续

```javascript
const at = require('./engine');

// 队友A的团队
const teamA = at.registerTeam({
  type: 'development',
  name: '调试团队A',
  memberCount: 3,
  request: '修复数据库连接问题'
});

// 队友A多次失败
at.updateNoPUA(teamA.id, {
  event: 'failure',
  failureMode: 'stuck-in-loops',
  attempt: '检查连接字符串'
});
at.updateNoPUA(teamA.id, {
  event: 'failure',
  attempt: '更换驱动版本',
  excluded: '连接字符串问题'
});
at.updateNoPUA(teamA.id, {
  event: 'failure',
  attempt: '修改超时配置',
  excluded: '驱动版本问题'
});

// 获取转移上下文
const context = at.getTransferContext(teamA.id);
// {
//   previousTeamId: 'dev-xxx',
//   previousTeamName: '调试团队A',
//   investigationDirections: 3,
//   excluded: ['连接字符串问题', '驱动版本问题'],
//   cognitiveLevel: 'elevate',
//   failureCount: 3
// }

// 创建队友B的团队，传递上下文
const teamB = at.registerTeam({
  type: 'development',
  name: '调试团队B',
  memberCount: 3,
  request: `继续修复数据库连接问题。
前一位队友调查了${context.investigationDirections}个方向，
排除了[${context.excluded.join(', ')}]，
当前认知级别：${context.cognitiveLevel}。
请尝试完全不同的方向。`
});

// 队友B从认知级别 'elevate' 开始，不重置
const stateB = at.getNoPUAState(teamB.id);
// cognitiveLevel: 'elevate' (继承)
```

---

## 示例五：投票决策详解

### 一票否决规则

```javascript
const at = require('./engine');

// 3人团队，1票反对 → 不通过
const result1 = at.feedback(teamId, {
  votes: [
    { member: 'A', vote: 'approve', reason: '符合规范' },
    { member: 'B', vote: 'approve', reason: '代码质量好' },
    { member: 'C', vote: 'reject', reason: '缺少测试' }
  ]
});
console.log(result1.voteResult);  // 'rejected'

// 5人团队，1票反对 → 不通过（一票否决）
const result2 = at.feedback(teamId, {
  votes: [
    { member: 'A', vote: 'approve', reason: '...' },
    { member: 'B', vote: 'approve', reason: '...' },
    { member: 'C', vote: 'approve', reason: '...' },
    { member: 'D', vote: 'approve', reason: '...' },
    { member: 'E', vote: 'reject', reason: '安全问题' }
  ]
});
console.log(result2.voteResult);  // 'rejected'

// 全票通过 → 通过
const result3 = at.feedback(teamId, {
  votes: [
    { member: 'A', vote: 'approve', reason: '...' },
    { member: 'B', vote: 'approve', reason: '...' },
    { member: 'C', vote: 'approve', reason: '...' }
  ]
});
console.log(result3.voteResult);  // 'approved'

// 弃权不影响结果（只计算反对票）
const result4 = at.feedback(teamId, {
  votes: [
    { member: 'A', vote: 'approve', reason: '...' },
    { member: 'B', vote: 'abstain', reason: '不熟悉此模块' },
    { member: 'C', vote: 'approve', reason: '...' }
  ]
});
console.log(result4.voteResult);  // 'approved'
```

---

## 示例六：文档交付物管理

```javascript
const at = require('./engine');

// 创建团队并指定任务名称
const team = at.registerTeam({
  type: 'planning',
  name: '架构设计团队',
  request: '设计系统架构'
}, '电商平台重构');

// 反馈时保存文档
at.feedback(team.id, {
  outputs: ['docs/架构设计文档.md', 'docs/API规范.md'],
  documents: [
    {
      path: 'docs/架构设计文档.md',
      content: `# 架构设计文档

## 系统架构
...`
    },
    {
      path: 'docs/API规范.md',
      content: `# API 规范

## RESTful 设计原则
...`
    }
  ],
  decision: at.DECISION.COMPLETE
});

// 文档保存位置
// {项目根目录}/.planning/电商平台重构/docs/
//   - 架构设计文档.md
//   - API规范.md

// 汇总报告包含文档清单
const summary = at.summary();
// 汇总报告位于: {项目根目录}/.planning/任务名称/reports/汇总报告-2026-03-28.md
```

---

## 示例七：状态监控

```javascript
const at = require('./engine');

// 查看当前状态
const status = at.getStatus();
console.log(status);
// {
//   taskId: 'task-xxx',
//   teamCount: 4,         // 创建了4个团队
//   completedTeams: 2,    // 2个已完成
//   pendingDelegates: 1,  // 1个待处理委托
//   documentCount: 5,     // 5份文档交付物
//   voteCount: 2          // 2次投票记录
// }

// 检查是否有待处理委托
if (at.hasPending()) {
  const pending = at.getPendingDelegate();
  console.log('待处理委托:', pending.request);
  console.log('建议类型:', pending.suggestedType);
}

// 获取任务目录
const taskDir = at.getTaskDir();
console.log('任务目录:', taskDir);
// {项目根目录}/.planning/用户认证系统开发
```