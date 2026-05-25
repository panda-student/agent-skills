/**
 * Agent Teams - 核心引擎
 *
 * 设计原则：
 * - 引擎只负责状态管理和记录
 * - 团队类型、成员数量等由主 Agent（AI）决策
 * - 引擎不做业务判断，只做数据管理
 *
 * 流程：
 * 主Agent(AI决策) → TaskState(记录状态) → Team(执行) → TaskState(记录产出)
 */

const { getTimestamp, getLocalTime, getLocalTimeOnly, getLocalDate, generateId, ensureDir, writeFile } = require('./utils');
const { getPaths, WORKSPACE_ROOT, THEORIES_DIR, THEORIES_README } = require('./constants');
const path = require('path');

// ============ 常量 ============

const DECISION = Object.freeze({
  COMPLETE: 'complete',
  DELEGATE: 'delegate'
});

// 投票结果
const VOTE_RESULT = Object.freeze({
  APPROVED: 'approved',   // 通过
  REJECTED: 'rejected'    // 不通过
});

// 投票动作（用于 votes[].vote 字段）
const VOTE_ACTION = Object.freeze({
  APPROVE: 'approve',     // 通过
  REJECT: 'reject',       // 反对
  ABSTAIN: 'abstain'      // 弃权
});

// 团队状态
const TEAM_STATUS = Object.freeze({
  CREATED: 'created',
  COMPLETED: 'completed',
  PENDING_REVIEW: 'pending_review'  // 等待主Agent审核
});

// 完成审核状态
const COMPLETION_STATUS = Object.freeze({
  PENDING: 'pending',     // 等待审核
  APPROVED: 'approved',   // 审核通过
  REJECTED: 'rejected'    // 审核驳回
});

// NoPUA 认知级别
const COGNITIVE_LEVEL = Object.freeze({
  NORMAL: 'normal',         // 正常（0-1次失败）
  SWITCH_EYES: 'switch_eyes', // 换眼（2次失败）
  ELEVATE: 'elevate',       // 提升（3次失败）
  RESET: 'reset',           // 归零（4次失败）
  SURRENDER: 'surrender'    // 放手（5次+失败）
});

// NoPUA 失败模式
const FAILURE_MODE = Object.freeze({
  STUCK_IN_LOOPS: 'stuck-in-loops',     // 原地打转
  GIVING_UP: 'giving-up',               // 想放弃
  POOR_QUALITY: 'poor-quality',         // 质量差
  GUESSING: 'guessing',                 // 猜测
  PASSIVE_WAITING: 'passive-waiting'    // 被动等待
});

// NoPUA 七道
const WISDOM_WAY = Object.freeze({
  WATER: 'water',           // 水道 - 原地打转时
  SEED: 'seed',             // 种子道 - 想放弃时
  FORGE: 'forge',           // 熔炉道 - 质量差时
  MIRROR: 'mirror',         // 镜道 - 猜测时
  NON_CONTENTION: 'non-contention', // 不争道 - 威胁/被动时
  CULTIVATION: 'cultivation', // 耕耘道 - 被动等待时
  PRACTICE: 'practice'      // 实践道 - 空完成时
});

// NoPUA 事件类型
const NOPUA_EVENT = Object.freeze({
  FAILURE: 'failure',
  SUCCESS: 'success',
  RESET: 'reset'
});

// 失败模式到智慧道的映射（模块级常量）
const MODE_TO_WISDOM_WAY = {
  [FAILURE_MODE.STUCK_IN_LOOPS]: WISDOM_WAY.WATER,
  [FAILURE_MODE.GIVING_UP]: WISDOM_WAY.SEED,
  [FAILURE_MODE.POOR_QUALITY]: WISDOM_WAY.FORGE,
  [FAILURE_MODE.GUESSING]: WISDOM_WAY.MIRROR,
  [FAILURE_MODE.PASSIVE_WAITING]: WISDOM_WAY.CULTIVATION
};

// NoPUA 数组最大容量
const MAX_NOPUA_ARRAY_SIZE = 50;

// 日志最大容量
const MAX_LOG_SIZE = 200;

// 文档类型后缀（用于识别文档交付物）
const DOC_EXTENSIONS = ['.md', '.doc', '.docx', '.pdf', '.txt', '.rst'];

/**
 * 判断是否为文档类交付物
 */
function isDocument(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return DOC_EXTENSIONS.includes(ext);
}

/**
 * 过滤文档类产出物
 */
function filterDocuments(outputs) {
  if (!outputs || !Array.isArray(outputs)) return [];
  return outputs.filter(isDocument);
}

/**
 * 判定投票结果（一票否决规则）
 * 规则：只要有1票反对，整体就不通过
 */
function determineVoteResult(votes) {
  if (!votes || votes.length === 0) return VOTE_RESULT.APPROVED;

  const hasReject = votes.some(v => v.vote === VOTE_ACTION.REJECT);
  return hasReject ? VOTE_RESULT.REJECTED : VOTE_RESULT.APPROVED;
}

// ============ TaskState 状态管理器 ============

/**
 * TaskState - 任务状态管理器
 *
 * 职责：存储和管理任务相关状态（团队、文档、投票、日志）
 * 注意：不做任何决策，所有决策由主 Agent（AI）完成
 */
class TaskState {
  constructor(baseDir) {
    // baseDir 由 index.js 的 getTaskState() 传入（使用缓存的 getDefaultBaseDir）
    // 直接实例化 TaskState 时必须显式传入 baseDir
    this.baseDir = baseDir;
    this.taskId = generateId('task');
    this.taskName = '';  // 任务名称（第一个团队时设置）
    this.taskDir = '';   // 任务目录
    this.paths = getPaths(this.baseDir);
    this.teams = [];
    this.documents = [];  // 文档交付物
    this.votes = [];      // 投票记录
    this.logs = [];
  }

  /**
   * 初始化任务目录
   * @param {string} taskName - 任务名称
   */
  initTaskDir(taskName) {
    if (!this.taskName && taskName) {
      this.taskName = taskName;
      this.paths = getPaths(this.baseDir, taskName);
      this.taskDir = this.paths.taskDir;
      ensureDir(this.taskDir);
      ensureDir(this.paths.docs);
      ensureDir(this.paths.reports);
    }
    return this.taskDir;
  }

  /**
   * 注册团队配置（仅记录状态，不创建真正的 Agent）
   *
   * @param {Object} config - 团队配置（由 AI 决策生成）
   * @param {string} config.type - 团队类型：planning/development/testing/review/custom
   * @param {string} config.name - 团队名称
   * @param {string} config.work - 工作描述
   * @param {number} config.memberCount - 成员数量（必须是奇数，确保投票不会平票）
   * @param {string[]} config.members - 成员名称列表
   * @param {string} config.request - 任务请求
   * @param {string[]} config.theories - 理论列表（Agent 读取 theories/README.md 决策后注入）
   * @param {string} taskName - 任务名称（用于创建任务目录，第一个团队时设置）
   */
  registerTeam(config, taskName) {
    // 第一个团队时初始化任务目录
    if (this.teams.length === 0 && taskName) {
      this.initTaskDir(taskName);
    }

    // 验证成员数量必须是奇数
    let memberCount = config.memberCount || 1;
    if (memberCount % 2 === 0) {
      memberCount += 1;  // 偶数自动+1转为奇数
    }

    const team = {
      id: generateId(config.type || 'team'),
      type: config.type || 'custom',
      name: config.name || '执行团队',
      work: config.work || '执行任务',
      memberCount,
      members: config.members || [],
      request: config.request,
      theories: config.theories || [],  // 由 Agent 决策注入
      status: TEAM_STATUS.CREATED,
      createdAt: getTimestamp(),

      // NoPUA 状态
      nopua: {
        failureCount: 0,
        cognitiveLevel: COGNITIVE_LEVEL.NORMAL,
        failureMode: null,
        wisdomWay: null,
        attempts: [],
        excluded: [],
        currentHypothesis: null,
        history: []
      }
    };

    this.teams.push(team);
    this._log('team_registered', {
      teamId: team.id,
      type: team.type,
      name: team.name,
      memberCount: team.memberCount,
      theories: team.theories
    });

    return team;
  }

  /**
   * 接收团队反馈
   *
   * @param {string} teamId - 团队ID
   * @param {Object} result - 执行结果
   * @param {string[]} result.outputs - 所有产出物路径列表
   * @param {Object[]} result.documents - 文档交付物内容（可选）[{path, content}]
   * @param {string} result.decision - 决策：complete/delegate
   * @param {string} result.reason - 决策理由（必填）
   *   - 委托时：为什么需要委托
   *   - 完成时：为什么认为任务已完成
   * @param {string} result.delegateRequest - 委托请求（decision=delegate时）
   * @param {string} result.delegateType - 建议的委托团队类型（可选，由团队建议）
   * @param {Object[]} result.votes - 投票记录（可选）
   * @param {string} result.votes[].member - 投票成员名称
   * @param {string} result.votes[].vote - 投票结果：approve/reject/abstain
   * @param {string} result.votes[].reason - 投票理由
   */
  feedback(teamId, result) {
    const team = this.teams.find(t => t.id === teamId);
    if (!team) return { error: '团队不存在' };

    // 验证必填字段
    if (!result.reason) {
      return { error: 'reason 字段必填：委托或完成的理由' };
    }

    team.outputs = result.outputs || [];
    team.decision = result.decision || DECISION.COMPLETE;
    team.reason = result.reason;  // 记录决策理由
    team.delegateRequest = result.delegateRequest || null;
    team.delegateType = result.delegateType || null;
    team.delegateHandled = false;
    team.feedbackAt = getTimestamp();

    // 提取文档类交付物路径
    const documentPaths = filterDocuments(result.outputs);

    // 保存文档内容到任务目录
    const savedDocuments = [];
    if (result.documents && result.documents.length > 0) {
      if (!this.taskDir) {
        this.initTaskDir(team.name);
      }

      result.documents.forEach(doc => {
        const subDir = doc.path.includes('report') || doc.path.includes('报告')
          ? this.paths.reports
          : this.paths.docs;

        const filePath = path.join(subDir, path.basename(doc.path));
        writeFile(filePath, doc.content);

        const relativePath = path.relative(this.baseDir, filePath).replace(/\\/g, '/');
        savedDocuments.push(relativePath);
      });
    }

    // 记录文档交付物
    const docsToRecord = savedDocuments.length > 0 ? savedDocuments : documentPaths;
    if (docsToRecord.length > 0) {
      const existingIndex = this.documents.findIndex(d => d.teamId === teamId);
      if (existingIndex !== -1) {
        this.documents.splice(existingIndex, 1);
      }
      this.documents.push({
        teamId,
        teamType: team.type,
        teamName: team.name,
        documents: docsToRecord
      });
    }

    // 记录投票
    if (result.votes && result.votes.length > 0) {
      const voteRecord = {
        teamId,
        teamName: team.name,
        teamType: team.type,
        votes: result.votes.map(v => ({
          member: v.member,
          vote: v.vote,
          reason: v.reason
        })),
        summary: this._summarizeVotes(result.votes),
        timestamp: getTimestamp()
      };
      this.votes.push(voteRecord);
      team.voteRecord = voteRecord;
    }

    // ============ 根据决策类型返回不同结果 ============

    if (team.decision === DECISION.DELEGATE) {
      // 委托：更新状态为 completed，返回委托信息供主Agent处理
      team.status = TEAM_STATUS.COMPLETED;
      team.completedAt = getTimestamp();

      this._log('team_delegate', {
        teamId,
        reason: team.reason,
        delegateType: team.delegateType
      });

      return {
        hasDelegate: true,
        delegateRequest: team.delegateRequest,
        delegateType: team.delegateType,
        delegateReason: team.reason,
        voteResult: team.voteRecord ? team.voteRecord.summary.result : null,
        savedDocuments,
        // 主Agent决策提示
        decisionPrompt: {
          message: `团队请求委托，理由：${team.reason}`,
          suggestedType: team.delegateType,
          question: '请根据委托理由决定创建什么类型的团队处理'
        }
      };
    } else {
      // 完成：进入待审核状态
      team.status = TEAM_STATUS.PENDING_REVIEW;
      team.completionStatus = COMPLETION_STATUS.PENDING;

      this._log('team_complete_pending', {
        teamId,
        reason: team.reason
      });

      return {
        hasDelegate: false,
        completionStatus: COMPLETION_STATUS.PENDING,
        voteResult: team.voteRecord ? team.voteRecord.summary.result : null,
        savedDocuments,
        // 主Agent审核提示
        reviewPrompt: {
          message: `团队报告完成，理由：${team.reason}`,
          teamType: team.type,
          questions: [
            '完成理由是否充分？',
            '产出物是否达到预期？',
            '是否有遗漏的问题？'
          ],
          actions: {
            approve: '调用 approveCompletion(teamId) 通过',
            reject: '调用 rejectCompletion(teamId, reason) 驳回并说明理由'
          }
        }
      };
    }
  }

  /**
   * 批准团队完成
   *
   * @param {string} teamId - 团队ID
   */
  approveCompletion(teamId) {
    const team = this.teams.find(t => t.id === teamId);
    if (!team) return { error: '团队不存在' };
    if (team.status !== TEAM_STATUS.PENDING_REVIEW) {
      return { error: '团队不在待审核状态' };
    }

    team.status = TEAM_STATUS.COMPLETED;
    team.completionStatus = COMPLETION_STATUS.APPROVED;
    team.completedAt = getTimestamp();

    this._log('completion_approved', { teamId, reason: team.reason });

    return {
      approved: true,
      teamId,
      message: '完成审核通过'
    };
  }

  /**
   * 驳回团队完成，要求重新处理
   *
   * @param {string} teamId - 团队ID
   * @param {string} reason - 驳回理由（主Agent必须说明）
   */
  rejectCompletion(teamId, reason) {
    const team = this.teams.find(t => t.id === teamId);
    if (!team) return { error: '团队不存在' };
    if (team.status !== TEAM_STATUS.PENDING_REVIEW) {
      return { error: '团队不在待审核状态' };
    }
    if (!reason) {
      return { error: '驳回必须提供理由' };
    }

    // 重置团队状态，要求重新执行
    team.status = TEAM_STATUS.CREATED;
    team.completionStatus = COMPLETION_STATUS.REJECTED;
    team.rejectionReason = reason;
    team.rejectedAt = getTimestamp();

    // 重置 NoPUA 状态（可选，让团队重新开始）
    team.nopua.failureCount = 0;
    team.nopua.cognitiveLevel = COGNITIVE_LEVEL.NORMAL;

    this._log('completion_rejected', { teamId, reason });

    return {
      rejected: true,
      teamId,
      rejectionReason: reason,
      message: '完成已驳回，团队需要重新处理',
      // 返回驳回信息供主Agent传递给团队
      feedbackToTeam: {
        rejectionReason: reason,
        originalReason: team.reason,
        instruction: '请根据驳回理由重新处理任务'
      }
    };
  }

  /**
   * 汇总投票结果（一票否决规则）
   */
  _summarizeVotes(votes) {
    const summary = { approve: 0, reject: 0, abstain: 0 };
    votes.forEach(v => {
      if (v.vote === VOTE_ACTION.APPROVE) summary.approve++;
      else if (v.vote === VOTE_ACTION.REJECT) summary.reject++;
      else if (v.vote === VOTE_ACTION.ABSTAIN) summary.abstain++;
    });
    // 一票否决：只要有1票反对，就不通过
    summary.result = summary.reject > 0 ? VOTE_RESULT.REJECTED : VOTE_RESULT.APPROVED;
    return summary;
  }

  /**
   * 是否有待处理委托
   */
  hasPending() {
    return this.teams.some(t => t.decision === DECISION.DELEGATE && !t.delegateHandled);
  }

  /**
   * 获取待处理委托
   */
  getPendingDelegate() {
    const team = this.teams.find(t => t.decision === DECISION.DELEGATE && !t.delegateHandled);
    if (!team) return null;
    team.delegateHandled = true;
    return {
      teamId: team.id,
      request: team.delegateRequest,
      suggestedType: team.delegateType
    };
  }

  /**
   * 获取团队绑定的理论名称列表
   *
   * AI 应读取 THEORIES_README (theories/README.md) 获取理论路径映射
   *
   * @param {string} teamId - 团队ID
   * @returns {Object} - { theories: string[], theoriesDir: string, readmePath: string }
   */
  getTeamTheories(teamId) {
    const team = this.teams.find(t => t.id === teamId);
    if (!team) return { theories: [], theoriesDir: THEORIES_DIR, readmePath: THEORIES_README };

    return {
      theories: team.theories || [],
      theoriesDir: THEORIES_DIR,
      readmePath: THEORIES_README
    };
  }

  /**
   * 获取当前状态摘要（供主 Agent 参考）
   */
  getStatus() {
    let completedTeams = 0;
    let pendingDelegates = 0;

    for (const team of this.teams) {
      if (team.status === TEAM_STATUS.COMPLETED) completedTeams++;
      if (team.decision === DECISION.DELEGATE && !team.delegateHandled) pendingDelegates++;
    }

    return {
      taskId: this.taskId,
      teamCount: this.teams.length,
      completedTeams,
      pendingDelegates,
      documentCount: this.documents.reduce((sum, d) => sum + d.documents.length, 0),
      voteCount: this.votes.length
    };
  }

  // ============ NoPUA 状态管理 ============

  /**
   * 更新团队的 NoPUA 状态
   *
   * @param {string} teamId - 团队ID
   * @param {Object} nopuaUpdate - NoPUA 状态更新
   * @param {string} nopuaUpdate.event - 事件类型：使用 NOPUA_EVENT 常量
   * @param {string} nopuaUpdate.failureMode - 失败模式（可选）
   * @param {string} nopuaUpdate.attempt - 尝试的方法（可选）
   * @param {string} nopuaUpdate.excluded - 排除的可能性（可选）
   * @param {string} nopuaUpdate.hypothesis - 当前假设（可选）
   */
  updateNoPUA(teamId, nopuaUpdate) {
    const team = this.teams.find(t => t.id === teamId);
    if (!team || !team.nopua) return { error: '团队不存在或无NoPUA状态' };

    const nopua = team.nopua;

    // 记录历史（仅 FAILURE 和 RESET 事件，SUCCESS 不需要记录）
    if (nopuaUpdate.event !== NOPUA_EVENT.SUCCESS) {
      nopua.history.push({
        timestamp: getTimestamp(),
        event: nopuaUpdate.event,
        failureCount: nopua.failureCount,
        cognitiveLevel: nopua.cognitiveLevel
      });
      this._trimNopuaArray(nopua.history);
    }

    switch (nopuaUpdate.event) {
      case NOPUA_EVENT.FAILURE:
        nopua.failureCount++;
        nopua.cognitiveLevel = this._determineCognitiveLevel(nopua.failureCount);
        if (nopuaUpdate.failureMode) {
          nopua.failureMode = nopuaUpdate.failureMode;
          nopua.wisdomWay = MODE_TO_WISDOM_WAY[nopuaUpdate.failureMode] || WISDOM_WAY.WATER;
        }
        if (nopuaUpdate.attempt) {
          nopua.attempts.push(nopuaUpdate.attempt);
          this._trimNopuaArray(nopua.attempts);
        }
        if (nopuaUpdate.excluded) {
          nopua.excluded.push(nopuaUpdate.excluded);
          this._trimNopuaArray(nopua.excluded);
        }
        if (nopuaUpdate.hypothesis) {
          nopua.currentHypothesis = nopuaUpdate.hypothesis;
        }
        break;

      case NOPUA_EVENT.SUCCESS:
        this._resetNopuaState(nopua, false);
        break;

      case NOPUA_EVENT.RESET:
        this._resetNopuaState(nopua, true);
        break;
    }

    this._log('nopua_updated', {
      teamId,
      event: nopuaUpdate.event,
      failureCount: nopua.failureCount,
      cognitiveLevel: nopua.cognitiveLevel
    });

    return {
      failureCount: nopua.failureCount,
      cognitiveLevel: nopua.cognitiveLevel,
      wisdomWay: nopua.wisdomWay,
      needsReport: nopua.failureCount >= 3
    };
  }

  /**
   * 重置 NoPUA 状态
   * @param {Object} nopua - NoPUA 状态对象
   * @param {boolean} fullReset - 是否完全重置（包括 attempts/excluded/hypothesis）
   */
  _resetNopuaState(nopua, fullReset) {
    nopua.failureCount = 0;
    nopua.cognitiveLevel = this._determineCognitiveLevel(0);
    nopua.failureMode = null;
    nopua.wisdomWay = null;
    if (fullReset) {
      nopua.attempts = [];
      nopua.excluded = [];
      nopua.currentHypothesis = null;
    }
  }

  /**
   * 限制 NoPUA 数组大小
   */
  _trimNopuaArray(arr) {
    if (arr.length > MAX_NOPUA_ARRAY_SIZE) {
      arr.splice(0, arr.length - MAX_NOPUA_ARRAY_SIZE);
    }
  }

  /**
   * 获取团队的 NoPUA 状态
   */
  getNoPUAState(teamId) {
    const team = this.teams.find(t => t.id === teamId);
    if (!team || !team.nopua) return null;

    return {
      failureCount: team.nopua.failureCount,
      cognitiveLevel: team.nopua.cognitiveLevel,
      failureMode: team.nopua.failureMode,
      wisdomWay: team.nopua.wisdomWay,
      attempts: team.nopua.attempts,
      excluded: team.nopua.excluded,
      currentHypothesis: team.nopua.currentHypothesis
    };
  }

  /**
   * 生成 NOPUA-REPORT（供 Leader 使用）
   */
  generateNoPUAReport(teamId) {
    const team = this.teams.find(t => t.id === teamId);
    if (!team || !team.nopua) return null;

    const nopua = team.nopua;
    if (nopua.failureCount < 3) return null; // 3次以上才生成报告

    return {
      type: 'NOPUA-REPORT',
      teammate: team.members[0] || team.name,
      task: team.request,
      failure_count: nopua.failureCount,
      failure_mode: nopua.failureMode,
      attempts: nopua.attempts,
      excluded: nopua.excluded,
      next_hypothesis: nopua.currentHypothesis,
      cognitive_level: nopua.cognitiveLevel,
      wisdom_way: nopua.wisdomWay
    };
  }

  /**
   * 生成跨队友转移上下文
   */
  getTransferContext(teamId) {
    const team = this.teams.find(t => t.id === teamId);
    if (!team) return null;

    const nopua = team.nopua;
    return {
      previousTeamId: teamId,
      previousTeamName: team.name,
      investigationDirections: nopua.attempts.length,
      excluded: nopua.excluded,
      cognitiveLevel: nopua.cognitiveLevel,
      failureCount: nopua.failureCount
    };
  }

  /**
   * 根据失败次数确定认知级别
   */
  _determineCognitiveLevel(failureCount) {
    if (failureCount >= 5) return COGNITIVE_LEVEL.SURRENDER;
    if (failureCount >= 4) return COGNITIVE_LEVEL.RESET;
    if (failureCount >= 3) return COGNITIVE_LEVEL.ELEVATE;
    if (failureCount >= 2) return COGNITIVE_LEVEL.SWITCH_EYES;
    return COGNITIVE_LEVEL.NORMAL;
  }

  /**
   * 生成汇总报告
   */
  summary() {
    const reportsDir = this.paths.reports;
    ensureDir(reportsDir);

    const localDate = getLocalDate();
    const localTime = getLocalTime();
    const fileName = `汇总报告-${localDate}.md`;
    const filePath = path.join(reportsDir, fileName);

    // 构建报告内容
    let content = `# 任务汇总报告

**任务ID**: ${this.taskId}
**生成时间**: ${localTime}
**团队数量**: ${this.teams.length}
**文档交付物**: ${this.documents.reduce((sum, d) => sum + d.documents.length, 0)} 份

---

## 执行时间线

| 时间 | 团队 | 类型 | 动作 | 详情 |
|------|------|------|------|------|
${this.logs.map(l => `| ${l.localTime || l.timestamp.split('T')[1].slice(0, 8)} | ${this._getTeamField(l.data.teamId, 'name')} | ${this._getTeamField(l.data.teamId, 'type')} | ${this._formatAction(l.action)} | ${this._formatDetail(l.data)} |`).join('\n')}
`;

    // 投票决策记录
    if (this.votes.length > 0) {
      content += `

---

## 投票决策记录

**规则：一票否决（只要有1票反对，整体不通过）**

${this.votes.map((v, i) => `### ${i + 1}. ${v.teamName} (${v.teamType})

**判定结果**: ${v.summary.result === 'approved' ? '✅ 通过' : '❌ 不通过'}

**投票汇总**: ✅ 通过 ${v.summary.approve} 票 | ❌ 反对 ${v.summary.reject} 票 | ⚪ 弃权 ${v.summary.abstain} 票

| 成员 | 投票 | 理由 |
|------|------|------|
${v.votes.map(vote => `| ${vote.member} | ${this._formatVote(vote.vote)} | ${vote.reason || '-'} |`).join('\n')}
`).join('\n')}
`;
    }

    // 文档交付物清单（表格格式）
    if (this.documents.length > 0) {
      content += `

---

## 文档交付物清单

| 序号 | 团队 | 类型 | 文档路径 |
|------|------|------|----------|
${this.documents.flatMap((d, i) => d.documents.map((doc, j) => `| ${i + 1}-${j + 1} | ${d.teamName} | ${d.teamType} | \`${doc}\` |`)).join('\n')}
`;
    }

    writeFile(filePath, content);
    this._log('summary_generated', { file: filePath });

    return {
      file: filePath,
      teamCount: this.teams.length,
      documentCount: this.documents.reduce((sum, d) => sum + d.documents.length, 0),
      voteCount: this.votes.length
    };
  }

  _formatVote(vote) {
    const voteMap = {
      [VOTE_ACTION.APPROVE]: '✅ 通过',
      [VOTE_ACTION.REJECT]: '❌ 反对',
      [VOTE_ACTION.ABSTAIN]: '⚪ 弃权'
    };
    return voteMap[vote] || vote;
  }

  /**
   * 获取团队字段（统一查找逻辑，避免重复 find）
   */
  _getTeamField(teamId, field, defaultVal = '-') {
    const team = this.teams.find(t => t.id === teamId);
    return team ? team[field] : defaultVal;
  }

  _formatAction(action) {
    const actions = {
      'team_registered': '注册团队',
      'team_delegate': '委托',
      'completion_approved': '批准',
      'completion_rejected': '驳回',
      'summary_generated': '生成报告'
    };
    return actions[action] || action;
  }

  _formatDetail(data) {
    if (data.memberCount !== undefined) {
      return `${data.memberCount}人`;
    }
    if (data.decision !== undefined) {
      const docInfo = data.documents > 0 ? `, 文档: ${data.documents}份` : '';
      return `决策: ${data.decision}${docInfo}`;
    }
    if (data.file !== undefined) {
      return data.file;
    }
    return JSON.stringify(data);
  }

  _log(action, data) {
    this.logs.push({
      timestamp: getTimestamp(),
      localTime: getLocalTimeOnly(),
      action,
      data
    });
    // 限制日志大小（批量删除更高效）
    if (this.logs.length > MAX_LOG_SIZE) {
      this.logs.splice(0, this.logs.length - MAX_LOG_SIZE);
    }
  }
}

module.exports = {
  TaskState,
  DECISION,
  VOTE_RESULT,
  VOTE_ACTION,
  TEAM_STATUS,
  COMPLETION_STATUS,
  COGNITIVE_LEVEL,
  FAILURE_MODE,
  WISDOM_WAY,
  NOPUA_EVENT,
  isDocument,
  filterDocuments,
  determineVoteResult
};