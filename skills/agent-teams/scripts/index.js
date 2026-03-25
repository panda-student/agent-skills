/**
 * Agent Teams - 模块入口
 *
 * 提供统一API，主Agent调用这些API完成任务分解、依赖分析、调度
 */

const ContextManager = require('./lib/context');
const RecoveryManager = require('./lib/recovery');
const CheckpointManager = require('./lib/checkpoint');
const WALManager = require('./lib/wal');
const { TaskDecomposer, TASK_TYPES, AGENT_MAP } = require('./lib/decomposer');
const { DependencyAnalyzer } = require('./lib/analyzer');
const { ParallelScheduler } = require('./lib/scheduler');
const { getTimestamp, generateId } = require('./lib/utils');

module.exports = {
  // 核心模块
  ContextManager,
  RecoveryManager,
  CheckpointManager,
  WALManager,
  TaskDecomposer,
  DependencyAnalyzer,
  ParallelScheduler,

  // 常量
  TASK_TYPES,
  AGENT_MAP,

  // 工具
  getTimestamp,
  generateId,

  // ============ 主调度API ============

  /**
   * 检查恢复
   */
  checkRecovery(baseDir) {
    const rm = new RecoveryManager(baseDir);
    return rm.checkRecoveryNeeded();
  },

  /**
   * 执行恢复
   */
  recover(baseDir) {
    const rm = new RecoveryManager(baseDir);
    return rm.recover();
  },

  /**
   * 任务分解 - 主API
   * @param {string} request - 用户请求
   * @param {object} options - 选项
   * @returns {object} 分解结果
   */
  decompose(request, options = {}) {
    const decomposer = new TaskDecomposer();
    return decomposer.decompose(request, options);
  },

  /**
   * 依赖分析 - 主API
   * @param {Array} tasks - 任务列表
   * @returns {object} 分析结果
   */
  analyzeDependencies(tasks) {
    const analyzer = new DependencyAnalyzer();
    return analyzer.analyze(tasks);
  },

  /**
   * 生成调度计划 - 主API
   * @param {object} plan - 任务计划
   * @param {string} baseDir - 项目目录
   * @returns {object} 调度计划
   */
  schedule(plan, baseDir) {
    // 分析依赖
    const analyzer = new DependencyAnalyzer();
    const analysis = analyzer.analyze(plan.tasks);

    // 生成执行计划
    const phases = [];
    for (const group of analysis.parallel_groups) {
      phases.push({
        phase_id: group.group_id,
        strategy: group.strategy,
        tasks: group.tasks.map(task => ({
          id: task.id,
          name: task.name,
          agent: task.agent,
          scope: task.scope,
          parallel: group.tasks.length > 1 && group.strategy === 'max_parallel'
        }))
      });
    }

    return {
      mission_id: plan.mission_id,
      mission_goal: plan.mission_goal,
      execution_plan: { phases },
      total_phases: phases.length,
      parallel_groups: analysis.parallel_groups,
      conflicts: analysis.conflicts,
      next_action: phases.length > 0 ? {
        action: 'launch_agents',
        phase: phases[0].phase_id,
        parallel: phases[0].tasks.length > 1,
        agents: phases[0].tasks.map(t => ({
          type: t.agent,
          task_id: t.id,
          task_name: t.name
        }))
      } : null
    };
  },

  /**
   * 完整流程 - 分解 + 分析 + 调度
   * @param {string} baseDir - 项目目录
   * @param {string} request - 用户请求
   * @returns {object} 完整执行计划
   */
  plan(baseDir, request) {
    // 1. 检查恢复
    const recoveryCheck = this.checkRecovery(baseDir);

    // 2. 任务分解
    const decomposed = this.decompose(request);

    // 3. 依赖分析
    const analysis = this.analyzeDependencies(decomposed.tasks);

    // 4. 生成调度计划
    const schedule = this.schedule(decomposed, baseDir);

    return {
      mission_id: decomposed.mission_id,
      mission_goal: decomposed.mission_goal,
      task_type: decomposed.task_type,
      recovery: recoveryCheck,
      decomposition: {
        total_tasks: decomposed.total_tasks,
        tasks: decomposed.tasks
      },
      analysis: {
        parallel_groups: analysis.parallel_groups,
        conflicts: analysis.conflicts,
        critical_path: analysis.critical_path
      },
      schedule: schedule,
      next_action: this._getNextAction(schedule)
    };
  },

  /**
   * 获取下一步行动
   */
  _getNextAction(schedule) {
    const firstPhase = schedule.execution_plan?.phases?.[0];
    if (!firstPhase) return null;

    return {
      action: 'launch_agents',
      phase: firstPhase.phase_id,
      parallel: firstPhase.parallel,
      agents: firstPhase.tasks.map(t => ({
        type: t.agent,
        task_id: t.id,
        task_name: t.name
      }))
    };
  },

  // ============ 状态管理API ============

  init(baseDir, goal) {
    const cm = new ContextManager(baseDir);
    return cm.initMission({ goal });
  },

  status(baseDir) {
    const cm = new ContextManager(baseDir);
    return cm.loadState();
  },

  checkpoint(baseDir, type = 'micro') {
    const cm = new ContextManager(baseDir);
    const state = cm.loadState();
    if (!state) return null;

    const chkm = new CheckpointManager(baseDir);
    const typeMap = {
      micro: 'createMicro',
      segment: 'createSegment',
      phase: 'createPhase',
      quality: 'createQualityGate'
    };
    return chkm[typeMap[type] || 'createMicro'](state);
  },

  complete(baseDir) {
    const cm = new ContextManager(baseDir);
    cm.loadState();
    cm.completeMission();
  },

  /**
   * 压缩状态 - 减少上下文占用
   */
  compress(baseDir, options = {}) {
    const cm = new ContextManager(baseDir);
    cm.loadState();
    return cm.compressState(options);
  },

  /**
   * 获取上下文使用情况
   */
  contextUsage(baseDir) {
    const cm = new ContextManager(baseDir);
    cm.loadState();
    return cm.getContextUsage();
  },

  /**
   * 获取精简摘要
   */
  getSummary(baseDir) {
    const cm = new ContextManager(baseDir);
    cm.loadState();
    return cm.getSummary();
  },

  /**
   * 检查是否需要压缩
   */
  needsCompression(baseDir) {
    const cm = new ContextManager(baseDir);
    cm.loadState();
    return cm.needsCompression();
  },

  // ============ Agent生命周期管理 ============

  /**
   * 生成关闭Team的指令
   * 主Agent调用此方法获取关闭步骤
   */
  getShutdownInstructions(teamName) {
    return {
      steps: [
        {
          step: 1,
          action: 'send_shutdown_request',
          description: '发送关闭请求给所有Team成员',
          tool: 'SendMessage',
          params: {
            to: '*',  // 广播给所有成员
            message: {
              type: 'shutdown_request',
              reason: '任务完成，准备关闭团队'
            }
          }
        },
        {
          step: 2,
          action: 'wait_response',
          description: '等待所有成员返回 shutdown_response(approve: true)'
        },
        {
          step: 3,
          action: 'cleanup',
          description: '清理团队资源',
          tool: 'TeamDelete',
          params: {}
        }
      ],
      note: '如果成员拒绝，检查reason后重新协调'
    };
  },

  /**
   * 生成启动压缩Agent的指令
   */
  getCompressAgentInstruction(compressTask) {
    return {
      action: 'launch_agent',
      tool: 'Agent',
      params: {
        subagent_type: 'general-purpose',
        description: '执行状态压缩',
        prompt: `执行状态压缩任务：
1. 读取 .claude/context/active/state.yaml
2. 归档已完成任务到 history/archived-tasks.yaml
3. 保留最近${compressTask.task.params.keepRecent}条任务
4. 保存压缩后状态
5. 返回压缩摘要

参数：keepRecent=${compressTask.task.params.keepRecent}`
      }
    };
  }
};