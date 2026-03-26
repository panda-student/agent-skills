/**
 * Agent Teams - 任务复杂度评估器
 *
 * 复杂度评估由 Agent 智能分析完成
 * 此模块提供分析指令生成和结果处理功能
 */

const COMPLEXITY_LEVELS = {
  SIMPLE: 'simple',
  MEDIUM: 'medium',
  COMPLEX: 'complex'
};

const EXECUTION_STRATEGIES = {
  [COMPLEXITY_LEVELS.SIMPLE]: 'direct',
  [COMPLEXITY_LEVELS.MEDIUM]: 'simplified',
  [COMPLEXITY_LEVELS.COMPLEX]: 'full'
};

class ComplexityAnalyzer {
  analyze(request, context = {}) {
    return {
      needs_analysis: true,
      analysis_instruction: this._getAnalysisInstruction(request, context)
    };
  }

  _getAnalysisInstruction(request, context) {
    return {
      action: 'launch_analysis_agent',
      agent_type: 'general-purpose',
      prompt: this._buildAnalysisPrompt(request, context),
      expected_output: {
        level: 'string (simple/medium/complex)',
        score: 'number (1-10)',
        reason: 'string',
        factors: {
          scope: { score: 'number', description: 'string' },
          action: { score: 'number', description: 'string' },
          dependency: { score: 'number', description: 'string' }
        },
        recommendation: {
          action: 'string',
          useDecomposition: 'boolean',
          useTeam: 'boolean',
          estimatedSubtasks: 'number'
        }
      }
    };
  }

  _buildAnalysisPrompt(request, context) {
    return `评估以下任务的复杂度。

## 任务请求
${request}

## 上下文信息
${JSON.stringify(context, null, 2)}

## 评估维度

### 1. 作用范围 (scope)
- 1分: 单个文件
- 2分: 少量文件
- 3分: 单个模块
- 4分: 多个模块
- 5分: 整个项目

### 2. 操作类型 (action)
- 1分: 只读操作（查看、读取、显示）
- 2分: 简单修改（重命名、小改动）
- 3分: Bug修复、重构
- 4分: 新功能开发
- 5分: 架构变更

### 3. 依赖关系 (dependency)
- 1分: 无依赖
- 2分: 内部依赖
- 3分: 外部依赖
- 4分: 破坏性变更

## 复杂度级别
- simple (分数 < 5): 简单任务，直接执行
- medium (5 <= 分数 < 8): 中等任务，简化分解
- complex (分数 >= 8): 复杂任务，完整分解

请以JSON格式返回评估结果。`;
  }

  applyAnalysisResult(analysisResult) {
    const level = analysisResult.level || COMPLEXITY_LEVELS.MEDIUM;
    const score = analysisResult.score || 5;

    return {
      level,
      score,
      strategy: EXECUTION_STRATEGIES[level],
      factors: analysisResult.factors || {},
      reason: analysisResult.reason || '',
      recommendation: analysisResult.recommendation || {
        action: this._getRecommendedAction(level),
        useDecomposition: level !== COMPLEXITY_LEVELS.SIMPLE,
        useTeam: level === COMPLEXITY_LEVELS.COMPLEX,
        estimatedSubtasks: this._estimateSubtaskCount(score)
      }
    };
  }

  _getRecommendedAction(level) {
    const actions = {
      [COMPLEXITY_LEVELS.SIMPLE]: 'direct_execution',
      [COMPLEXITY_LEVELS.MEDIUM]: 'simplified_decomposition',
      [COMPLEXITY_LEVELS.COMPLEX]: 'full_decomposition'
    };
    return actions[level];
  }

  _estimateSubtaskCount(score) {
    if (score < 5) return 1;
    if (score < 6) return 2;
    if (score < 7) return 3;
    if (score < 8) return 4;
    if (score < 10) return 6;
    return 8;
  }

  getExecutionPlan(complexityResult) {
    const { level } = complexityResult;

    const plans = {
      [COMPLEXITY_LEVELS.SIMPLE]: {
        phases: 1,
        useTeam: false,
        useParallel: false,
        steps: [
          { step: 1, action: 'execute', agent: 'general-purpose', description: '直接执行任务' }
        ]
      },
      [COMPLEXITY_LEVELS.MEDIUM]: {
        phases: 2,
        useTeam: false,
        useParallel: true,
        parallelLimit: 2,
        steps: [
          { step: 1, action: 'analyze', agent: 'explorer', description: '快速分析', parallel: false },
          { step: 2, action: 'execute', agent: 'developer', description: '执行任务', parallel: true }
        ]
      },
      [COMPLEXITY_LEVELS.COMPLEX]: {
        phases: 4,
        useTeam: true,
        useParallel: true,
        parallelLimit: 4,
        steps: [
          { step: 1, action: 'analyze', agent: 'explorer', description: '需求分析', parallel: false },
          { step: 2, action: 'design', agent: 'developer', description: '技术设计', parallel: true },
          { step: 3, action: 'develop', agent: 'developer', description: '开发实现', parallel: true },
          { step: 4, action: 'verify', agent: 'tester', description: '测试验证', parallel: false }
        ]
      }
    };

    return plans[level];
  }
}

module.exports = {
  ComplexityAnalyzer,
  COMPLEXITY_LEVELS,
  EXECUTION_STRATEGIES
};
