/**
 * Agent Teams 全面复杂测试场景
 * 场景：电商平台支付系统集成
 *
 * 测试覆盖：
 * 1. 多团队类型：planning → development → testing → review
 * 2. 委托链：全链委托流转
 * 3. 投票机制：评审投票+否决场景
 * 4. 驳回重试：主Agent驳回完成
 * 5. NoPUA失败恢复：多次失败、认知级别递进、跨队友转移
 * 6. 文档交付物：自动保存验证
 * 7. 状态查询：getStatus、hasPending、getPendingDelegate
 * 8. 汇总报告：summary生成
 */

const at = require('../engine');
const fs = require('fs');

// 设置测试目录
at.clearCache();

// 辅助函数
function logSection(title) {
  console.log('\n' + '='.repeat(60));
  console.log(`【${title}】`);
  console.log('='.repeat(60));
}

function logResult(result) {
  console.log(JSON.stringify(result, null, 2));
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ 失败: ${message}`);
    process.exit(1);
  }
  console.log(`✅ 通过: ${message}`);
}

// ============ 阶段1: 规划团队 ============
logSection('阶段1: 规划团队 - 需求分析与架构设计');

const planningTeam = at.registerTeam({
  type: 'planning',
  name: '支付系统规划团队',
  memberCount: 3,
  members: ['产品经理', '架构师', '技术顾问'],
  work: '分析支付系统需求并设计架构',
  request: '分析电商平台支付系统需求，设计技术架构',
  theories: ['nopua', 'brainstorming', 'writing-plans', 'verification']
}, '支付系统集成测试');

console.log('规划团队创建:', planningTeam.id);
assert(planningTeam.memberCount === 3, '成员数量为奇数');
assert(planningTeam.status === 'created', '团队状态为 created');

// 规划团队完成，委托给开发团队
const planningResult = at.feedback(planningTeam.id, {
  outputs: ['docs/需求规格说明书.md', 'docs/技术架构设计.md'],
  documents: [
    {
      path: 'docs/需求规格说明书.md',
      content: `# 支付系统需求规格说明书

## 1. 项目概述
电商平台需要集成多种支付方式，包括支付宝、微信支付、银联支付。

## 2. 功能需求
- 支付渠道对接
- 订单支付流程
- 支付状态同步
- 退款处理

## 3. 非功能需求
- 支付成功率 > 99.9%
- 响应时间 < 200ms
- 数据安全合规`
    },
    {
      path: 'docs/技术架构设计.md',
      content: `# 支付系统技术架构设计

## 1. 系统架构
采用微服务架构，支付服务独立部署。

## 2. 核心模块
- PaymentGateway: 支付网关
- OrderService: 订单服务
- RefundService: 退款服务

## 3. 数据库设计
- payments 表：支付记录
- refund_requests 表：退款申请`
    }
  ],
  decision: at.DECISION.DELEGATE,
  reason: '需求分析和架构设计已完成，需要开发团队实现具体功能',
  delegateRequest: '根据架构设计文档实现支付系统核心功能',
  delegateType: 'development'
});

console.log('规划团队反馈结果:');
logResult(planningResult);
assert(planningResult.hasDelegate === true, '规划团队触发委托');
assert(planningResult.delegateType === 'development', '委托类型为 development');
assert(planningResult.savedDocuments.length === 2, '文档已保存');

// ============ 阶段2: 开发团队（带NoPUA失败恢复） ============
logSection('阶段2: 开发团队 - 功能实现（含NoPUA失败恢复）');

// 处理规划团队的委托
assert(at.hasPending() === true, '存在待处理委托');
const pending1 = at.getPendingDelegate();
console.log('待处理委托:', pending1.request);

// 创建开发团队A
const devTeamA = at.registerTeam({
  type: 'development',
  name: '支付功能开发团队A',
  memberCount: 3,
  members: ['开发者张三', '开发者李四', '开发者王五'],
  work: '实现支付系统核心功能',
  request: pending1.request,
  theories: ['nopua', 'tdd', 'verification', 'systematic-debugging']
});

console.log('开发团队A创建:', devTeamA.id);

// ============ NoPUA 失败恢复测试 ============
console.log('\n--- NoPUA 失败恢复流程 ---');

// 第1次失败：原地打转
const nopua1 = at.updateNoPUA(devTeamA.id, {
  event: 'failure',
  failureMode: 'stuck-in-loops',
  attempt: '尝试直接调用支付API',
  hypothesis: '可能是API参数格式问题'
});
console.log('第1次失败:', nopua1);
assert(nopua1.failureCount === 1, '失败计数为1');
assert(nopua1.cognitiveLevel === 'normal', '认知级别为 normal');

// 第2次失败：换眼级别
const nopua2 = at.updateNoPUA(devTeamA.id, {
  event: 'failure',
  failureMode: 'stuck-in-loops',
  attempt: '更换请求方式',
  excluded: 'API参数格式问题'
});
console.log('第2次失败:', nopua2);
assert(nopua2.failureCount === 2, '失败计数为2');
assert(nopua2.cognitiveLevel === 'switch_eyes', '认知级别升级为 switch_eyes');

// 第3次失败：提升级别
const nopua3 = at.updateNoPUA(devTeamA.id, {
  event: 'failure',
  failureMode: 'guessing',
  attempt: '修改认证配置',
  excluded: '请求方式问题',
  hypothesis: '可能是认证机制问题'
});
console.log('第3次失败:', nopua3);
assert(nopua3.failureCount === 3, '失败计数为3');
assert(nopua3.cognitiveLevel === 'elevate', '认知级别升级为 elevate');
assert(nopua3.needsReport === true, '需要生成报告');

// 生成 NoPUA 报告
const nopuaReport = at.generateNoPUAReport(devTeamA.id);
console.log('NoPUA报告:');
logResult(nopuaReport);
assert(nopuaReport.type === 'NOPUA-REPORT', '报告类型正确');
assert(nopuaReport.cognitive_level === 'elevate', '报告认知级别正确');

// 第4次失败：归零级别
const nopua4 = at.updateNoPUA(devTeamA.id, {
  event: 'failure',
  failureMode: 'giving-up',
  hypothesis: '尝试联系支付渠道技术支持'
});
console.log('第4次失败:', nopua4);
assert(nopua4.failureCount === 4, '失败计数为4');
assert(nopua4.cognitiveLevel === 'reset', '认知级别升级为 reset');

// 第5次失败：放手级别
const nopua5 = at.updateNoPUA(devTeamA.id, {
  event: 'failure',
  failureMode: 'passive-waiting'
});
console.log('第5次失败:', nopua5);
assert(nopua5.failureCount === 5, '失败计数为5');
assert(nopua5.cognitiveLevel === 'surrender', '认知级别升级为 surrender');

// ============ 跨队友转移测试 ============
console.log('\n--- 跨队友转移上下文 ---');

const transferContext = at.getTransferContext(devTeamA.id);
console.log('转移上下文:');
logResult(transferContext);
assert(transferContext.previousTeamId === devTeamA.id, '前团队ID正确');
assert(transferContext.investigationDirections === 3, '调查方向数量正确（只有前3次失败设置了attempt）');
assert(transferContext.excluded.length === 2, '排除的可能性数量正确');

// 创建开发团队B，继承上下文
const devTeamB = at.registerTeam({
  type: 'development',
  name: '支付功能开发团队B',
  memberCount: 3,
  members: ['开发者赵六', '开发者孙七', '开发者周八'],
  work: '继续实现支付系统功能',
  request: `继续实现支付系统核心功能。
前一位队友调查了${transferContext.investigationDirections}个方向，
排除了[${transferContext.excluded.join(', ')}]，
当前认知级别：${transferContext.cognitiveLevel}。
请尝试完全不同的方向：检查支付渠道SDK文档和技术支持渠道。`,
  theories: ['nopua', 'tdd', 'verification', 'systematic-debugging']
});

console.log('开发团队B创建:', devTeamB.id);

// 开发团队B成功完成
const nopuaSuccess = at.updateNoPUA(devTeamB.id, { event: 'success' });
console.log('开发团队B成功:', nopuaSuccess);
assert(nopuaSuccess.failureCount === 0, '成功后失败计数重置为0');
assert(nopuaSuccess.cognitiveLevel === 'normal', '成功后认知级别恢复正常');

// 开发团队B完成，委托给测试团队
const devResult = at.feedback(devTeamB.id, {
  outputs: ['src/payment-gateway.js', 'src/order-service.js', 'tests/payment.test.js', 'docs/开发完成报告.md'],
  documents: [
    {
      path: 'docs/开发完成报告.md',
      content: `# 开发完成报告

## 已完成功能
- PaymentGateway 支付网关模块
- OrderService 订单服务模块
- 支付单元测试

## 技术说明
- 支付宝、微信支付、银联支付均已对接
- 单元测试覆盖率达到85%`
    }
  ],
  decision: at.DECISION.DELEGATE,
  reason: '支付系统核心功能开发完成，需要测试团队验证功能正确性',
  delegateRequest: '测试支付系统功能，验证支付流程和退款流程',
  delegateType: 'testing'
});

console.log('开发团队反馈结果:');
logResult(devResult);
assert(devResult.hasDelegate === true, '开发团队触发委托');

// ============ 阶段3: 测试团队 ============
logSection('阶段3: 测试团队 - 功能验证');

const pending2 = at.getPendingDelegate();
console.log('待处理委托:', pending2.request);

const testTeam = at.registerTeam({
  type: 'testing',
  name: '支付系统测试团队',
  memberCount: 3,
  members: ['测试工程师A', '测试工程师B', '测试工程师C'],
  work: '验证支付系统功能',
  request: pending2.request,
  theories: ['nopua', 'verification', 'tdd', 'systematic-debugging']
});

console.log('测试团队创建:', testTeam.id);

// 测试团队完成，委托给评审团队
const testResult = at.feedback(testTeam.id, {
  outputs: ['reports/测试报告.md'],
  documents: [
    {
      path: 'reports/测试报告.md',
      content: `# 支付系统测试报告

## 测试结果
- 支付流程测试：通过
- 退款流程测试：通过
- 并发测试：通过
- 异常场景测试：通过

## 测试覆盖率
- 单元测试：85%
- 集成测试：70%
- E2E测试：60%

## 发现问题
- 性能测试：部分场景响应时间超过200ms（需优化）`
    }
  ],
  decision: at.DECISION.DELEGATE,
  reason: '功能测试通过，但发现性能问题，需要评审团队检查代码质量',
  delegateRequest: '评审支付系统代码质量，重点关注性能优化',
  delegateType: 'review'
});

console.log('测试团队反馈结果:');
logResult(testResult);
assert(testResult.hasDelegate === true, '测试团队触发委托');

// ============ 阶段4: 评审团队（含投票机制） ============
logSection('阶段4: 评审团队 - 代码评审（含投票机制）');

const pending3 = at.getPendingDelegate();
console.log('待处理委托:', pending3.request);

const reviewTeam = at.registerTeam({
  type: 'review',
  name: '支付系统评审团队',
  memberCount: 3,
  members: ['评审员甲', '评审员乙', '评审员丙'],
  work: '评审支付系统代码质量',
  request: pending3.request,
  theories: ['nopua', 'code-review', 'verification', 'persuasion-principles']
});

console.log('评审团队创建:', reviewTeam.id);

// 评审结果：有反对票（一票否决）
const reviewResult1 = at.feedback(reviewTeam.id, {
  outputs: ['reports/评审报告-v1.md'],
  documents: [
    {
      path: 'reports/评审报告-v1.md',
      content: `# 评审报告 v1

## 发现问题
1. SQL注入风险（高危）
2. 缺少输入验证（中危）
3. 性能优化建议（低危）`
    }
  ],
  decision: at.DECISION.COMPLETE,
  reason: '代码评审发现安全风险，需要修复后重新评审',
  votes: [
    { member: '评审员甲', vote: 'approve', reason: '基本功能实现正确' },
    { member: '评审员乙', vote: 'reject', reason: '存在SQL注入风险，必须修复' },
    { member: '评审员丙', vote: 'approve', reason: '代码结构清晰' }
  ]
});

console.log('评审团队反馈结果:');
logResult(reviewResult1);
assert(reviewResult1.voteResult === 'rejected', '一票否决：评审结果为 rejected');
assert(reviewResult1.completionStatus === 'pending', '等待主Agent审核');

// ============ 主Agent驳回测试 ============
logSection('阶段5: 主Agent驳回 + 团队重新执行');

console.log('主Agent审核：驳回评审结果，要求重新处理');
const rejectResult = at.rejectCompletion(reviewTeam.id, '评审发现了安全风险但未给出具体修复方案，请提供详细修复建议并重新评审');
console.log('驳回结果:');
logResult(rejectResult);
assert(rejectResult.rejected === true, '驳回成功');
assert(rejectResult.feedbackToTeam !== undefined, '返回团队反馈信息');

// 团队重新执行（模拟修复后重新评审）
console.log('\n--- 团队重新执行评审 ---');

const reviewResult2 = at.feedback(reviewTeam.id, {
  outputs: ['reports/评审报告-v2.md'],
  documents: [
    {
      path: 'reports/评审报告-v2.md',
      content: `# 评审报告 v2

## 已修复问题
1. SQL注入风险：已使用参数化查询
2. 输入验证：已添加 Joi 验证

## 性能优化建议
- 添加 Redis 缓存层
- 使用连接池优化数据库连接

## 评审结论
代码质量达标，建议通过。`
    }
  ],
  decision: at.DECISION.COMPLETE,
  reason: '安全风险已修复，代码质量达标',
  votes: [
    { member: '评审员甲', vote: 'approve', reason: 'SQL注入已修复，参数化查询正确' },
    { member: '评审员乙', vote: 'approve', reason: '输入验证完整，符合安全规范' },
    { member: '评审员丙', vote: 'approve', reason: '性能优化建议合理' }
  ]
});

console.log('重新评审结果:');
logResult(reviewResult2);
assert(reviewResult2.voteResult === 'approved', '全票通过：评审结果为 approved');

// ============ 主Agent批准完成 ============
logSection('阶段6: 主Agent批准完成');

console.log('主Agent审核：批准评审完成');
const approveResult = at.approveCompletion(reviewTeam.id);
console.log('批准结果:');
logResult(approveResult);
assert(approveResult.approved === true, '批准成功');

// ============ 状态查询测试 ============
logSection('阶段7: 状态查询');

const status = at.getStatus();
console.log('当前状态:');
logResult(status);
assert(status.teamCount === 5, '创建了5个团队（planning + devA + devB + testing + review）');
assert(status.completedTeams >= 3, '至少3个团队已完成');
assert(status.documentCount >= 5, '至少5份文档交付物');
assert(status.voteCount === 2, '2次投票记录（否决+通过）');

const taskDir = at.getTaskDir();
console.log('任务目录:', taskDir);

// ============ 理论绑定验证 ============
logSection('阶段8: 理论绑定验证');

const devTeamTheories = at.getTeamTheories(devTeamB.id);
console.log('开发团队理论绑定:');
logResult(devTeamTheories);
assert(devTeamTheories.theories.length === 4, '开发团队绑定了4个理论');
assert(devTeamTheories.theories.includes('tdd'), '包含 TDD 理论');

// ============ 汇总报告生成 ============
logSection('阶段9: 汇总报告');

const summary = at.summary();
console.log('汇总报告:');
logResult(summary);
assert(summary.file !== undefined, '汇总报告文件已生成');
assert(summary.teamCount === 5, '报告包含5个团队');

// 验证汇总报告文件内容
if (fs.existsSync(summary.file)) {
  const reportContent = fs.readFileSync(summary.file, 'utf-8');
  console.log('\n--- 汇总报告内容预览 ---');
  console.log(reportContent.substring(0, 1000) + '...');
}

// ============ 测试完成 ============
logSection('测试完成');

console.log('\n✅ 所有测试通过！');
console.log('\n测试覆盖功能点:');
console.log('  1. ✅ 多团队类型：planning, development, testing, review');
console.log('  2. ✅ 委托链：全链委托流转');
console.log('  3. ✅ 投票机制：一票否决 + 全票通过');
console.log('  4. ✅ 驳回重试：主Agent驳回 + 团队重新执行');
console.log('  5. ✅ NoPUA失败恢复：5次失败 + 认知级别递进');
console.log('  6. ✅ 跨队友转移：开发A→开发B');
console.log('  7. ✅ 文档交付物：自动保存验证');
console.log('  8. ✅ 状态查询：getStatus/hasPending/getPendingDelegate');
console.log('  9. ✅ 汇总报告：summary生成');

console.log('\n任务目录:', taskDir);
console.log('汇总报告:', summary.file);