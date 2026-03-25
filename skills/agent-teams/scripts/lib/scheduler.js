/**
 * Agent Teams - 并行调度器
 *
 * 调度subagent并行执行任务
 */

const { generateId, getTimestamp } = require('./utils');
const { DependencyAnalyzer } = require('./analyzer');
const { AGENT_MAP } = require('./decomposer');
const ContextManager = require('./context');
const path = require('path');

class ParallelScheduler {
  /**
   * @param {string} baseDir - 项目根目录
   */
  constructor(baseDir) {
    this.baseDir = baseDir;
    this.contextManager = new ContextManager(baseDir);
    this.dependencyAnalyzer = new DependencyAnalyzer();
    this.executionLog = [];
  }

  /**
   * 执行任务计划
   * @param {object} plan - 任务计划（来自decomposer）
   * @returns {object} 执行结果
   */
  async execute(plan) {
    const startTime = Date.now();

    // 分析依赖
    const analysis = this.dependencyAnalyzer.analyze(plan.tasks);

    // 初始化上下文
    this.contextManager.initMission({
      goal: plan.mission_goal
    });

    // 更新任务列表
    this.contextManager.state.tasks = plan.tasks;
    this.contextManager.state.progress.total_tasks = plan.total_tasks;
    this.contextManager._saveState();

    // 生成执行计划
    const executionPlan = this._generateExecutionPlan(analysis);

    // 返回调度指令（由主Agent执行）
    return {
      mission_id: plan.mission_id,
      mission_goal: plan.mission_goal,
      execution_plan: executionPlan,
      total_phases: executionPlan.phases.length,
      parallel_groups: analysis.parallel_groups,
      conflicts: analysis.conflicts,
      instructions: this._generateInstructions(executionPlan)
    };
  }

  /**
   * 生成执行计划
   */
  _generateExecutionPlan(analysis) {
    const phases = [];

    for (const group of analysis.parallel_groups) {
      const phase = {
        phase_id: group.group_id,
        strategy: group.strategy,
        tasks: group.tasks.map(task => ({
          id: task.id,
          name: task.name,
          agent: task.agent,
          scope: task.scope,
          prompt: this._generateAgentPrompt(task)
        })),
        parallel: group.tasks.length > 1 && group.strategy === 'max_parallel'
      };

      phases.push(phase);
    }

    return { phases };
  }

  /**
   * 生成Agent提示词
   */
  _generateAgentPrompt(task) {
    const agentConfig = this._getAgentConfig(task.agent);

    return {
      agent_type: agentConfig.type,
      task_id: task.id,
      task_name: task.name,
      scope: task.scope,
      description: task.description || task.name,
      output_format: agentConfig.outputSchema
    };
  }

  /**
   * 获取Agent配置
   */
  _getAgentConfig(agentId) {
    const configs = {
      explorer: {
        type: 'search',
        outputSchema: {
          summary: 'string',
          structure: 'object',
          key_files: 'string[]',
          insights: 'string[]'
        }
      },
      developer: {
        type: 'general-purpose',
        outputSchema: {
          status: 'success|failed',
          files_modified: 'string[]',
          summary: 'string',
          issues: 'string[]'
        }
      },
      tester: {
        type: 'general-purpose',
        outputSchema: {
          status: 'passed|failed',
          results: 'object',
          coverage: 'number',
          issues: 'string[]'
        }
      },
      reviewer: {
        type: 'general-purpose',
        outputSchema: {
          status: 'approved|changes-requested',
          score: 'number',
          findings: 'object[]',
          suggestions: 'string[]'
        }
      }
    };

    return configs[agentId] || configs.developer;
  }

  /**
   * 生成执行指令
   */
  _generateInstructions(executionPlan) {
    const instructions = [];

    instructions.push('# 执行指令\n');
    instructions.push('主Agent需要按以下步骤调度subagent执行：\n');

    for (const phase of executionPlan.phases) {
      if (phase.parallel) {
        instructions.push(`\n## 阶段 ${phase.phase_id}（并行执行）\n`);
        instructions.push('同时启动以下subagent：\n');
        for (const task of phase.tasks) {
          instructions.push(`- Agent类型: ${task.agent}, 任务: ${task.name}\n`);
        }
      } else {
        instructions.push(`\n## 阶段 ${phase.phase_id}（串行执行）\n`);
        for (const task of phase.tasks) {
          instructions.push(`1. 启动 ${task.agent} agent 执行: ${task.name}\n`);
        }
      }
    }

    instructions.push('\n## 注意事项\n');
    instructions.push('- 每个阶段完成后创建检查点\n');
    instructions.push('- 监控subagent执行状态\n');
    instructions.push('- 聚合结果后进入下一阶段\n');

    return instructions.join('');
  }

  /**
   * 记录执行结果
   */
  recordResult(taskId, result) {
    this.executionLog.push({
      task_id: taskId,
      result: result,
      timestamp: getTimestamp()
    });

    // 更新上下文
    const task = this.contextManager.state.tasks.find(t => t.id === taskId);
    if (task) {
      task.status = result.status === 'success' || result.status === 'passed' ? 'completed' : 'failed';
      task.result = result;
      this.contextManager._saveState();
    }
  }

  /**
   * 聚合执行结果
   */
  aggregateResults() {
    const results = {
      total_tasks: this.contextManager.state.progress.total_tasks,
      completed: 0,
      failed: 0,
      details: []
    };

    for (const task of this.contextManager.state.tasks) {
      if (task.status === 'completed') {
        results.completed++;
      } else if (task.status === 'failed') {
        results.failed++;
      }

      results.details.push({
        id: task.id,
        name: task.name,
        status: task.status,
        result: task.result
      });
    }

    return results;
  }

  /**
   * 创建阶段检查点
   */
  createPhaseCheckpoint(phaseId) {
    this.contextManager.checkpointManager.createSegment({
      ...this.contextManager.state,
      current_phase: phaseId
    });
  }
}

module.exports = {
  ParallelScheduler
};