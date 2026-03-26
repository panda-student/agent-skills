/**
 * Agent Teams - 任务分解器
 *
 * 将用户请求分解为可并行执行的子任务
 * 任务类型识别和分解由 Agent 智能分析完成
 */

const { generateId, getTimestamp } = require('./utils');

const TASK_TYPES = {
  EXPLORE: 'explore',
  DEVELOP: 'develop',
  FIX: 'fix',
  REVIEW: 'review',
  DEPLOY: 'deploy',
  TEST: 'test'
};

const DECOMPOSITION_MODES = {
  DIRECT: 'direct',
  SIMPLIFIED: 'simplified',
  FULL: 'full'
};

const AGENT_MAP = {
  [TASK_TYPES.EXPLORE]: 'explorer',
  [TASK_TYPES.DEVELOP]: 'developer',
  [TASK_TYPES.FIX]: 'developer',
  [TASK_TYPES.REVIEW]: 'reviewer',
  [TASK_TYPES.DEPLOY]: 'developer',
  [TASK_TYPES.TEST]: 'tester',
  'compress': 'compressor'
};

class TaskDecomposer {
  constructor() {
    this.tasks = [];
  }

  decompose(request, context = {}) {
    const missionId = generateId('mission');
    const timestamp = getTimestamp();

    return {
      mission_id: missionId,
      mission_goal: request,
      needs_analysis: true,
      analysis_instruction: this._getAnalysisInstruction(request, context),
      created_at: timestamp
    };
  }

  _getAnalysisInstruction(request, context) {
    return {
      action: 'launch_analysis_agent',
      agent_type: 'general-purpose',
      prompt: this._buildAnalysisPrompt(request, context),
      expected_output: {
        task_type: 'string (explore/develop/fix/review/deploy/test)',
        complexity: {
          level: 'string (simple/medium/complex)',
          score: 'number',
          reason: 'string'
        },
        decomposition_mode: 'string (direct/simplified/full)',
        subtasks: [
          {
            name: 'string',
            type: 'string',
            scope: 'string',
            description: 'string',
            phase: 'string (optional)',
            depends_on: 'string[] (optional)'
          }
        ],
        execution_strategy: {
          use_team: 'boolean',
          parallel: 'boolean',
          phases: 'number'
        }
      }
    };
  }

  _buildAnalysisPrompt(request, context) {
    return `分析以下任务请求，提供任务分解方案。

## 任务请求
${request}

## 上下文信息
${JSON.stringify(context, null, 2)}

## 分析要求

### 1. 任务类型识别
根据任务内容判断类型：
- explore: 探索、分析、了解代码库
- develop: 开发新功能、实现新特性
- fix: 修复Bug、解决问题
- review: 代码评审、质量检查
- deploy: 部署、发布、CI/CD
- test: 测试、验证

### 2. 复杂度评估
评估任务复杂度：
- simple: 简单任务，如查看文件、简单修改、重命名等
- medium: 中等任务，如小功能开发、简单Bug修复
- complex: 复杂任务，如完整功能开发、系统重构

考虑因素：
- 涉及的文件/模块数量
- 操作的复杂程度
- 是否需要多阶段协作

### 3. 分解模式选择
- direct: 简单任务，直接执行不分解
- simplified: 中等任务，2-3个子任务
- full: 复杂任务，完整分解流程

### 4. 子任务分解
根据任务类型和复杂度，分解为合理的子任务：
- 每个子任务应该有明确的目标和范围
- 标注任务之间的依赖关系
- 分配适当的执行阶段

### 5. 执行策略
- 是否需要创建团队协作
- 是否可以并行执行
- 预计需要几个执行阶段

请以JSON格式返回分析结果。`;
  }

  applyAnalysisResult(request, analysisResult, context = {}) {
    const missionId = generateId('mission');
    const timestamp = getTimestamp();

    const taskType = analysisResult.task_type || TASK_TYPES.DEVELOP;
    const mode = analysisResult.decomposition_mode || DECOMPOSITION_MODES.FULL;
    const subTasks = analysisResult.subtasks || [];

    const processedTasks = subTasks.map((task, index) => ({
      ...task,
      id: `T${index + 1}`,
      mission_id: missionId,
      agent: AGENT_MAP[task.type] || 'developer',
      status: 'pending',
      created_at: timestamp
    }));

    return {
      mission_id: missionId,
      mission_goal: request,
      task_type: taskType,
      decomposition_mode: mode,
      complexity: analysisResult.complexity,
      total_tasks: processedTasks.length,
      tasks: processedTasks,
      execution_strategy: analysisResult.execution_strategy,
      created_at: timestamp
    };
  }

  decomposeWithResult(request, analysisResult, context = {}) {
    return this.applyAnalysisResult(request, analysisResult, context);
  }
}

module.exports = {
  TaskDecomposer,
  TASK_TYPES,
  AGENT_MAP,
  DECOMPOSITION_MODES
};
