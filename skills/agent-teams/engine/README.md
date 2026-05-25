# Agent Teams 引擎

## 工作流程

```
┌─────────────────────────────────────┐        ┌─────────────────────────────────────┐
│              团队节点                │        │             主Agent节点               │
│                                     │        │                                     │
│   执行任务 → 发现问题/完成           │  ────→  │   审核/决策                          │
│             ↓                       │        │             ↓                       │
│   做决策 + 给理由                    │        │   委托：根据理由创建团队              │
│   - delegate + 委托理由              │        │   完成：approve 或 reject + 理由     │
│   - complete + 完成理由              │        │                                     │
│                                     │  ←────  │   reject：驳回给原团队 + 理由        │
└─────────────────────────────────────┘        └─────────────────────────────────────┘
```

## API

### 注册团队配置

```javascript
// 仅记录团队配置到状态，不创建真正的 Agent
// 真正的 Agent 需通过 TeamCreate 工具创建
const team = at.registerTeam({
  type: 'review',        // planning/development/testing/review/custom
  name: '团队名称',
  memberCount: 3,        // 奇数
  request: '任务请求',
  theories: ['nopua', 'tdd']  // 可选
}, '任务名称');
```

### 团队反馈（必填 reason）

```javascript
// 委托
const result = at.feedback(teamId, {
  decision: 'delegate',
  reason: '发现SQL注入漏洞需要开发团队修复',  // 必填
  delegateRequest: '修复SQL注入漏洞',
  delegateType: 'development'  // 建议，可选
});
// 返回 result.decisionPrompt

// 完成
const result = at.feedback(teamId, {
  decision: 'complete',
  reason: '代码评审通过，未发现问题',  // 必填
  outputs: ['docs/report.md'],
  votes: [...]
});
// 返回 result.reviewPrompt
```

### 主Agent审核

```javascript
// 批准完成
at.approveCompletion(teamId);

// 驳回完成 + 理由
at.rejectCompletion(teamId, '缺少单元测试');
```

## 状态

```javascript
TEAM_STATUS = {
  CREATED: 'created',           // 已创建
  PENDING_REVIEW: 'pending_review',  // 待审核（团队报告完成）
  COMPLETED: 'completed'        // 已完成（审核通过）
}

COMPLETION_STATUS = {
  PENDING: 'pending',    // 等待审核
  APPROVED: 'approved',  // 审核通过
  REJECTED: 'rejected'   // 审核驳回
}
```

## 职责分离

| 层 | 职责 |
|----|------|
| 团队 | 执行、发现、决策+理由 |
| 引擎 | 状态管理、提示生成 |
| 主Agent | 审核、创建团队、最终决策 |