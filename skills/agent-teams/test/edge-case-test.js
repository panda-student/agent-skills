/**
 * Agent Teams 边界场景测试
 */

const at = require('../engine');
const path = require('path');

at.clearCache();

function logSection(title) {
  console.log('\n' + '='.repeat(50));
  console.log(`【${title}】`);
  console.log('='.repeat(50));
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ 失败: ${message}`);
    process.exit(1);
  }
  console.log(`✅ 通过: ${message}`);
}

// ============ 边界测试1: 偶数成员数量自动调整 ============
logSection('边界测试1: 偶数成员数量自动调整');

const team1 = at.registerTeam({
  type: 'development',
  name: '测试偶数成员团队',
  memberCount: 4,  // 偶数，应该自动+1
  request: '测试偶数成员自动调整'
}, '边界测试场景');

console.log('创建团队配置: memberCount=4');
console.log('实际成员数量:', team1.memberCount);
assert(team1.memberCount === 5, '偶数成员数量自动+1转为奇数');

const team2 = at.registerTeam({
  type: 'development',
  name: '测试奇数成员团队',
  memberCount: 3,
  request: '测试奇数成员保持不变'
});

console.log('创建团队配置: memberCount=3');
console.log('实际成员数量:', team2.memberCount);
assert(team2.memberCount === 3, '奇数成员数量保持不变');

// ============ 边界测试2: 投票弃权场景 ============
logSection('边界测试2: 投票弃权场景');

const team3 = at.registerTeam({
  type: 'review',
  name: '弃权投票测试团队',
  memberCount: 5,
  members: ['评审员A', '评审员B', '评审员C', '评审员D', '评审员E'],
  request: '测试弃权投票'
}, '边界测试场景');

// 场景1: 全票通过
const result1 = at.feedback(team3.id, {
  decision: at.DECISION.COMPLETE,
  reason: '全票通过测试',
  votes: [
    { member: '评审员A', vote: 'approve', reason: '符合规范' },
    { member: '评审员B', vote: 'approve', reason: '代码质量好' },
    { member: '评审员C', vote: 'approve', reason: '测试覆盖完整' },
    { member: '评审员D', vote: 'approve', reason: '文档清晰' },
    { member: '评审员E', vote: 'approve', reason: '无问题' }
  ]
});
console.log('全票通过:', result1.voteResult);
assert(result1.voteResult === 'approved', '5票通过 → approved');

// 场景2: 1票反对（一票否决）
const team4 = at.registerTeam({
  type: 'review',
  name: '一票否决测试团队',
  memberCount: 5,
  request: '测试一票否决'
});

const result2 = at.feedback(team4.id, {
  decision: at.DECISION.COMPLETE,
  reason: '一票否决测试',
  votes: [
    { member: '评审员A', vote: 'approve', reason: '符合规范' },
    { member: '评审员B', vote: 'reject', reason: '发现安全漏洞' },
    { member: '评审员C', vote: 'approve', reason: '代码质量好' },
    { member: '评审员D', vote: 'approve', reason: '测试覆盖完整' },
    { member: '评审员E', vote: 'approve', reason: '无问题' }
  ]
});
console.log('一票否决:', result2.voteResult);
assert(result2.voteResult === 'rejected', '4通过+1反对 → rejected');

// 场景3: 弃权不影响结果
const team5 = at.registerTeam({
  type: 'review',
  name: '弃权测试团队',
  memberCount: 3,
  request: '测试弃权不影响结果'
});

const result3 = at.feedback(team5.id, {
  decision: at.DECISION.COMPLETE,
  reason: '弃权不影响结果测试',
  votes: [
    { member: '评审员A', vote: 'approve', reason: '符合规范' },
    { member: '评审员B', vote: 'abstain', reason: '不熟悉此模块' },
    { member: '评审员C', vote: 'approve', reason: '代码质量好' }
  ]
});
console.log('弃权场景:', result3.voteResult);
assert(result3.voteResult === 'approved', '2通过+1弃权 → approved');

// 场景4: 弃权+反对 → 不通过
const team6 = at.registerTeam({
  type: 'review',
  name: '弃权反对测试团队',
  memberCount: 3,
  request: '测试弃权+反对'
});

const result4 = at.feedback(team6.id, {
  decision: at.DECISION.COMPLETE,
  reason: '弃权+反对测试',
  votes: [
    { member: '评审员A', vote: 'approve', reason: '符合规范' },
    { member: '评审员B', vote: 'abstain', reason: '不熟悉此模块' },
    { member: '评审员C', vote: 'reject', reason: '发现问题' }
  ]
});
console.log('弃权+反对:', result4.voteResult);
assert(result4.voteResult === 'rejected', '1通过+1弃权+1反对 → rejected');

// ============ 边界测试3: NoPUA 认知级别递进 ============
logSection('边界测试3: NoPUA 认知级别递进');

const team7 = at.registerTeam({
  type: 'development',
  name: 'NoPUA测试团队',
  request: '测试认知级别递进'
});

// 测试每个认知级别
const levels = [
  { count: 1, expected: 'normal' },
  { count: 2, expected: 'switch_eyes' },
  { count: 3, expected: 'elevate' },
  { count: 4, expected: 'reset' },
  { count: 5, expected: 'surrender' }
];

for (const level of levels) {
  // 重置状态
  at.updateNoPUA(team7.id, { event: 'reset' });

  // 递增失败次数
  for (let i = 0; i < level.count; i++) {
    at.updateNoPUA(team7.id, { event: 'failure' });
  }

  const state = at.getNoPUAState(team7.id);
  console.log(`${level.count}次失败 → 认知级别: ${state.cognitiveLevel}`);
  assert(state.cognitiveLevel === level.expected, `${level.count}次失败 → ${level.expected}`);
}

// ============ 边界测试4: NoPUA 智慧道映射 ============
logSection('边界测试4: NoPUA 智慧道映射');

const team8 = at.registerTeam({
  type: 'development',
  name: '智慧道测试团队',
  request: '测试智慧道映射'
});

const wisdomMappings = [
  { mode: 'stuck-in-loops', expectedWay: 'water', desc: '原地打转 → 水道' },
  { mode: 'giving-up', expectedWay: 'seed', desc: '想放弃 → 种子道' },
  { mode: 'poor-quality', expectedWay: 'forge', desc: '质量差 → 熔炉道' },
  { mode: 'guessing', expectedWay: 'mirror', desc: '猜测 → 镜道' },
  { mode: 'passive-waiting', expectedWay: 'cultivation', desc: '被动等待 → 耕耘道' }
];

for (const mapping of wisdomMappings) {
  at.updateNoPUA(team8.id, { event: 'reset' });
  at.updateNoPUA(team8.id, {
    event: 'failure',
    failureMode: mapping.mode
  });

  const state = at.getNoPUAState(team8.id);
  console.log(`${mapping.desc}: 实际=${state.wisdomWay}`);
  assert(state.wisdomWay === mapping.expectedWay, mapping.desc);
}

// ============ 边界测试5: 文档类型识别 ============
logSection('边界测试5: 文档类型识别');

const docTests = [
  { path: 'docs/readme.md', expected: true },
  { path: 'docs/spec.doc', expected: true },
  { path: 'docs/report.docx', expected: true },
  { path: 'docs/manual.pdf', expected: true },
  { path: 'docs/notes.txt', expected: true },
  { path: 'docs/guide.rst', expected: true },
  { path: 'src/auth.js', expected: false },
  { path: 'tests/test.py', expected: false },
  { path: 'config.json', expected: false },
  { path: 'package.yaml', expected: false }
];

for (const test of docTests) {
  const result = at.isDocument(test.path);
  console.log(`${test.path}: ${result ? '文档' : '非文档'}`);
  assert(result === test.expected, `${test.path} → ${test.expected ? '文档' : '非文档'}`);
}

// ============ 边界测试6: 投票结果判定函数 ============
logSection('边界测试6: 投票结果判定函数');

const voteTests = [
  {
    votes: [{ vote: 'approve' }, { vote: 'approve' }, { vote: 'approve' }],
    expected: 'approved',
    desc: '全票通过'
  },
  {
    votes: [{ vote: 'approve' }, { vote: 'reject' }, { vote: 'approve' }],
    expected: 'rejected',
    desc: '一票否决'
  },
  {
    votes: [{ vote: 'approve' }, { vote: 'abstain' }, { vote: 'approve' }],
    expected: 'approved',
    desc: '弃权不影响'
  },
  {
    votes: [],
    expected: 'approved',
    desc: '空投票默认通过'
  }
];

for (const test of voteTests) {
  const result = at.determineVoteResult(test.votes);
  console.log(`${test.desc}: ${result}`);
  assert(result === test.expected, `${test.desc} → ${test.expected}`);
}

// ============ 边界测试7: 驳回理由必填验证 ============
logSection('边界测试7: 驳回理由必填验证');

const team9 = at.registerTeam({
  type: 'review',
  name: '驳回理由测试团队',
  request: '测试驳回理由必填'
});

// 先完成反馈
at.feedback(team9.id, {
  decision: at.DECISION.COMPLETE,
  reason: '完成待审核'
});

// 尝试不提供理由驳回
const rejectResult1 = at.rejectCompletion(team9.id);
console.log('无理由驳回:', rejectResult1);
assert(rejectResult1.error === '驳回必须提供理由', '驳回必须提供理由');

// 提供理由驳回
const rejectResult2 = at.rejectCompletion(team9.id, '需要补充测试');
console.log('有理由驳回:', rejectResult2);
assert(rejectResult2.rejected === true, '有理由驳回成功');

// ============ 边界测试8: 反馈reason必填验证 ============
logSection('边界测试8: 反馈reason必填验证');

const team10 = at.registerTeam({
  type: 'development',
  name: 'reason必填测试团队',
  request: '测试reason必填'
});

// 尝试不提供reason
const feedbackResult1 = at.feedback(team10.id, {
  decision: at.DECISION.COMPLETE
});
console.log('无reason反馈:', feedbackResult1);
assert(feedbackResult1.error === 'reason 字段必填：委托或完成的理由', '反馈必须提供reason');

// 提供reason
const feedbackResult2 = at.feedback(team10.id, {
  decision: at.DECISION.COMPLETE,
  reason: '任务已完成'
});
console.log('有reason反馈:', feedbackResult2.completionStatus);
assert(feedbackResult2.completionStatus === 'pending', '有reason反馈成功');

// ============ 边界测试9: 团队不存在验证 ============
logSection('边界测试9: 团队不存在验证');

const invalidTeamId = 'invalid-team-id';

const feedbackResult3 = at.feedback(invalidTeamId, {
  decision: at.DECISION.COMPLETE,
  reason: '测试不存在团队'
});
console.log('不存在团队反馈:', feedbackResult3);
assert(feedbackResult3.error === '团队不存在', '不存在团队返回错误');

const approveResult = at.approveCompletion(invalidTeamId);
console.log('不存在团队批准:', approveResult);
assert(approveResult.error === '团队不存在', '不存在团队批准返回错误');

const nopuaResult = at.updateNoPUA(invalidTeamId, { event: 'failure' });
console.log('不存在团队NoPUA:', nopuaResult);
assert(nopuaResult.error === '团队不存在或无NoPUA状态', '不存在团队NoPUA返回错误');

// ============ 边界测试10: 状态不在待审核时批准/驳回 ============
logSection('边界测试10: 状态不在待审核时批准/驳回');

const team11 = at.registerTeam({
  type: 'development',
  name: '状态测试团队',
  request: '测试状态验证'
});

// 团队刚创建，不在待审核状态
const approveResult2 = at.approveCompletion(team11.id);
console.log('非待审核状态批准:', approveResult2);
assert(approveResult2.error === '团队不在待审核状态', '非待审核状态不能批准');

const rejectResult3 = at.rejectCompletion(team11.id, '测试驳回');
console.log('非待审核状态驳回:', rejectResult3);
assert(rejectResult3.error === '团队不在待审核状态', '非待审核状态不能驳回');

// ============ 测试完成 ============
logSection('测试完成');

console.log('\n✅ 所有边界测试通过！');
console.log('\n测试覆盖:');
console.log('  1. ✅ 偶数成员数量自动调整');
console.log('  2. ✅ 投票弃权场景（多种组合）');
console.log('  3. ✅ NoPUA认知级别递进');
console.log('  4. ✅ NoPUA智慧道映射');
console.log('  5. ✅ 文档类型识别');
console.log('  6. ✅ 投票结果判定函数');
console.log('  7. ✅ 驳回理由必填验证');
console.log('  8. ✅ 反馈reason必填验证');
console.log('  9. ✅ 团队不存在验证');
console.log('  10. ✅ 状态不在待审核时操作验证');