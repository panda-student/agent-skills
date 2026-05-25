/**
 * Agent Teams - 引擎入口
 *
 * API 设计：
 * - 引擎只负责状态管理
 * - 所有决策由主 Agent（AI）完成
 *
 * 目录说明：
 * - 业务项目目录：运行技能的用户项目，产出物保存在此
 * - 技能目录：agent-teams 技能自身所在目录
 * - 默认自动检测业务项目目录，避免污染技能目录
 */

const { TaskState, DECISION, VOTE_RESULT, VOTE_ACTION, TEAM_STATUS, COMPLETION_STATUS, COGNITIVE_LEVEL, FAILURE_MODE, WISDOM_WAY, NOPUA_EVENT, isDocument, filterDocuments, determineVoteResult } = require('./lib/core');
const { detectProjectRoot, THEORIES_DIR, THEORIES_README } = require('./lib/constants');

const _taskStates = new Map();
let _detectedProjectRoot = null;

/**
 * 获取默认的项目根目录
 * 自动检测并缓存，避免重复检测
 */
function getDefaultBaseDir() {
  if (!_detectedProjectRoot) {
    _detectedProjectRoot = detectProjectRoot();
  }
  return _detectedProjectRoot;
}

/**
 * 清除缓存的项目根目录（用于测试或目录切换）
 */
function clearCache() {
  _detectedProjectRoot = null;
}

function getTaskState(baseDir) {
  const key = baseDir || getDefaultBaseDir();
  if (!_taskStates.has(key)) _taskStates.set(key, new TaskState(key));
  return _taskStates.get(key);
}

/**
 * 重置指定目录的 TaskState 实例（用于测试）
 */
function resetTaskState(baseDir) {
  const key = baseDir || getDefaultBaseDir();
  _taskStates.delete(key);
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
  determineVoteResult,
  resetTaskState,
  clearCache,
  detectProjectRoot,
  getDefaultBaseDir,
  // 理论路径（供 AI 动态查询）
  THEORIES_DIR,
  THEORIES_README,

  /**
   * 注册团队配置（仅记录状态，不创建真正的 Agent）
   * 真正的 Agent 需通过 TeamCreate 工具创建
   */
  registerTeam(config, taskName, baseDir) {
    return getTaskState(baseDir).registerTeam(config, taskName);
  },

  /**
   * 接收团队反馈
   *
   * @param {string} teamId - 团队ID
   * @param {Object} result - 执行结果
   * @param {string[]} result.outputs - 所有产出物路径
   * @param {Object[]} result.documents - 文档内容 [{path, content}]
   * @param {string} result.decision - 决策：complete/delegate
   * @param {string} result.reason - 决策理由（必填）
   *   - 委托时：为什么需要委托
   *   - 完成时：为什么认为任务已完成
   * @param {string} result.delegateRequest - 委托请求（decision=delegate时）
   * @param {string} result.delegateType - 建议的委托团队类型（可选）
   * @param {Object[]} result.votes - 投票记录（可选）
   * @param {string} baseDir - 基础目录
   * @returns {Object} 返回结果，包含 reviewPrompt 或 decisionPrompt 供主Agent决策
   */
  feedback(teamId, result, baseDir) {
    return getTaskState(baseDir).feedback(teamId, result);
  },

  /**
   * 批准团队完成
   *
   * @param {string} teamId - 团队ID
   * @param {string} baseDir - 基础目录
   */
  approveCompletion(teamId, baseDir) {
    return getTaskState(baseDir).approveCompletion(teamId);
  },

  /**
   * 驳回团队完成，要求重新处理
   *
   * @param {string} teamId - 团队ID
   * @param {string} reason - 驳回理由（必填）
   * @param {string} baseDir - 基础目录
   */
  rejectCompletion(teamId, reason, baseDir) {
    return getTaskState(baseDir).rejectCompletion(teamId, reason);
  },

  /**
   * 检查是否有待处理委托
   */
  hasPending(baseDir) {
    return getTaskState(baseDir).hasPending();
  },

  /**
   * 获取待处理委托
   */
  getPendingDelegate(baseDir) {
    return getTaskState(baseDir).getPendingDelegate();
  },

  /**
   * 获取当前状态
   */
  getStatus(baseDir) {
    return getTaskState(baseDir).getStatus();
  },

  /**
   * 获取任务目录
   */
  getTaskDir(baseDir) {
    const state = getTaskState(baseDir);
    return state.taskDir;
  },

  /**
   * 生成汇总报告
   */
  summary(baseDir) {
    return getTaskState(baseDir).summary();
  },

  // ============ NoPUA 状态管理 API ============

  updateNoPUA(teamId, nopuaUpdate, baseDir) {
    return getTaskState(baseDir).updateNoPUA(teamId, nopuaUpdate);
  },

  getNoPUAState(teamId, baseDir) {
    return getTaskState(baseDir).getNoPUAState(teamId);
  },

  generateNoPUAReport(teamId, baseDir) {
    return getTaskState(baseDir).generateNoPUAReport(teamId);
  },

  getTransferContext(teamId, baseDir) {
    return getTaskState(baseDir).getTransferContext(teamId);
  },

  // ============ 理论绑定 API ============

  getTeamTheories(teamId, baseDir) {
    return getTaskState(baseDir).getTeamTheories(teamId);
  }
};