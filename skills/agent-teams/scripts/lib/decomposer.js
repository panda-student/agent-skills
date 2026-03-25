/**
 * Agent Teams - 任务分解器
 *
 * 将用户请求分解为可并行执行的子任务
 */

const { generateId, getTimestamp } = require('./utils');

// 任务类型定义
const TASK_TYPES = {
  EXPLORE: 'explore',       // 探索类
  DEVELOP: 'develop',       // 开发类
  FIX: 'fix',               // 修复类
  REVIEW: 'review',         // 评审类
  DEPLOY: 'deploy',         // 部署类
  TEST: 'test'              // 测试类
};

// 任务类型关键词映射
const TASK_KEYWORDS = {
  [TASK_TYPES.EXPLORE]: ['探索', '分析', '了解', '查看', '研究', '理解', '探索', 'explore', 'analyze'],
  [TASK_TYPES.DEVELOP]: ['开发', '实现', '新增', '重构', '添加', '创建', 'develop', 'implement', 'create'],
  [TASK_TYPES.FIX]: ['bug', '修复', '问题', '错误', '缺陷', 'fix', 'bug', 'issue'],
  [TASK_TYPES.REVIEW]: ['评审', '检查', '审查', '审计', 'review', 'audit', 'check'],
  [TASK_TYPES.DEPLOY]: ['部署', '发布', 'CI/CD', '自动化', 'deploy', 'release', 'publish'],
  [TASK_TYPES.TEST]: ['测试', '验证', 'test', 'verify', 'validate']
};

// Agent类型映射
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

  /**
   * 识别任务类型
   * @param {string} request - 用户请求
   * @returns {string} 任务类型
   */
  identifyTaskType(request) {
    const lowerRequest = request.toLowerCase();

    for (const [type, keywords] of Object.entries(TASK_KEYWORDS)) {
      for (const keyword of keywords) {
        if (lowerRequest.includes(keyword.toLowerCase())) {
          return type;
        }
      }
    }

    return TASK_TYPES.DEVELOP; // 默认为开发类
  }

  /**
   * 分解任务
   * @param {string} request - 用户请求
   * @param {object} context - 上下文信息
   * @returns {object} 分解结果
   */
  decompose(request, context = {}) {
    const taskType = this.identifyTaskType(request);
    const missionId = generateId('mission');
    const timestamp = getTimestamp();

    // 根据任务类型生成子任务
    let subTasks = [];
    switch (taskType) {
      case TASK_TYPES.EXPLORE:
        subTasks = this._decomposeExplore(request, context);
        break;
      case TASK_TYPES.DEVELOP:
        subTasks = this._decomposeDevelop(request, context);
        break;
      case TASK_TYPES.FIX:
        subTasks = this._decomposeFix(request, context);
        break;
      case TASK_TYPES.REVIEW:
        subTasks = this._decomposeReview(request, context);
        break;
      case TASK_TYPES.DEPLOY:
        subTasks = this._decomposeDeploy(request, context);
        break;
      case TASK_TYPES.TEST:
        subTasks = this._decomposeTest(request, context);
        break;
      default:
        subTasks = this._decomposeDevelop(request, context);
    }

    // 为每个子任务分配ID和Agent
    subTasks = subTasks.map((task, index) => ({
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
      total_tasks: subTasks.length,
      tasks: subTasks,
      created_at: timestamp
    };
  }

  /**
   * 分解探索类任务
   */
  _decomposeExplore(request, context) {
    return [
      { name: '目录结构探索', type: TASK_TYPES.EXPLORE, scope: 'root', description: '探索项目根目录结构' },
      { name: '核心模块探索', type: TASK_TYPES.EXPLORE, scope: 'src/core/', description: '探索核心模块实现' },
      { name: '依赖关系探索', type: TASK_TYPES.EXPLORE, scope: 'package.json', description: '分析项目依赖' },
      { name: '配置文件探索', type: TASK_TYPES.EXPLORE, scope: '*.config.*', description: '分析项目配置' },
      { name: '入口文件探索', type: TASK_TYPES.EXPLORE, scope: 'main.*,index.*', description: '识别入口文件' },
      { name: '测试结构探索', type: TASK_TYPES.EXPLORE, scope: 'test/', description: '探索测试结构' },
      { name: '文档结构探索', type: TASK_TYPES.EXPLORE, scope: 'docs/,*.md', description: '探索文档结构' },
      { name: '架构总结', type: TASK_TYPES.EXPLORE, scope: 'all', description: '汇总架构分析结果' }
    ];
  }

  /**
   * 分解开发类任务
   */
  _decomposeDevelop(request, context) {
    return [
      { name: '需求分析', type: TASK_TYPES.EXPLORE, scope: 'all', description: '分析功能需求和技术要求', phase: 'analysis' },
      { name: '技术设计', type: TASK_TYPES.DEVELOP, scope: 'docs/', description: '设计技术方案', phase: 'design', depends_on: ['T1'] },
      { name: 'API设计', type: TASK_TYPES.DEVELOP, scope: 'src/api/', description: '设计API接口', phase: 'design', depends_on: ['T1'] },
      { name: '数据模型设计', type: TASK_TYPES.DEVELOP, scope: 'src/models/', description: '设计数据模型', phase: 'design', depends_on: ['T1'] },
      { name: '核心逻辑开发', type: TASK_TYPES.DEVELOP, scope: 'src/', description: '实现核心逻辑', phase: 'develop', depends_on: ['T2', 'T3', 'T4'] },
      { name: '接口开发', type: TASK_TYPES.DEVELOP, scope: 'src/api/', description: '实现API接口', phase: 'develop', depends_on: ['T2', 'T3'] },
      { name: '单元测试', type: TASK_TYPES.TEST, scope: 'test/', description: '编写单元测试', phase: 'test', depends_on: ['T5', 'T6'] },
      { name: '集成测试', type: TASK_TYPES.TEST, scope: 'test/', description: '执行集成测试', phase: 'test', depends_on: ['T7'] }
    ];
  }

  /**
   * 分解修复类任务
   */
  _decomposeFix(request, context) {
    return [
      { name: '问题定位', type: TASK_TYPES.EXPLORE, scope: 'all', description: '定位问题根源', phase: 'analysis' },
      { name: '代码分析', type: TASK_TYPES.REVIEW, scope: 'related', description: '分析相关代码', phase: 'analysis', depends_on: ['T1'] },
      { name: '影响分析', type: TASK_TYPES.EXPLORE, scope: 'related', description: '分析修复影响范围', phase: 'analysis', depends_on: ['T1'] },
      { name: '修复实施', type: TASK_TYPES.FIX, scope: 'related', description: '实施问题修复', phase: 'fix', depends_on: ['T1', 'T2', 'T3'] },
      { name: '验证测试', type: TASK_TYPES.TEST, scope: 'related', description: '验证修复结果', phase: 'verify', depends_on: ['T4'] },
      { name: '回归测试', type: TASK_TYPES.TEST, scope: 'all', description: '执行回归测试', phase: 'verify', depends_on: ['T5'] }
    ];
  }

  /**
   * 分解评审类任务
   */
  _decomposeReview(request, context) {
    return [
      { name: '代码规范检查', type: TASK_TYPES.REVIEW, scope: 'src/', description: '检查代码规范', aspect: 'style' },
      { name: '安全检查', type: TASK_TYPES.REVIEW, scope: 'src/', description: '检查安全问题', aspect: 'security' },
      { name: '性能检查', type: TASK_TYPES.REVIEW, scope: 'src/', description: '检查性能问题', aspect: 'performance' },
      { name: '逻辑检查', type: TASK_TYPES.REVIEW, scope: 'src/', description: '检查逻辑问题', aspect: 'logic' },
      { name: '汇总评审报告', type: TASK_TYPES.REVIEW, scope: 'all', description: '生成评审报告', depends_on: ['T1', 'T2', 'T3', 'T4'] }
    ];
  }

  /**
   * 分解部署类任务
   */
  _decomposeDeploy(request, context) {
    return [
      { name: '环境检查', type: TASK_TYPES.DEPLOY, scope: 'env', description: '检查部署环境', phase: 'prepare' },
      { name: '依赖安装', type: TASK_TYPES.DEPLOY, scope: 'deps', description: '安装项目依赖', phase: 'prepare', depends_on: ['T1'] },
      { name: '构建打包', type: TASK_TYPES.DEPLOY, scope: 'build', description: '执行构建打包', phase: 'build', depends_on: ['T2'] },
      { name: '部署发布', type: TASK_TYPES.DEPLOY, scope: 'deploy', description: '执行部署发布', phase: 'deploy', depends_on: ['T3'] },
      { name: '部署验证', type: TASK_TYPES.TEST, scope: 'prod', description: '验证部署结果', phase: 'verify', depends_on: ['T4'] }
    ];
  }

  /**
   * 分解测试类任务
   */
  _decomposeTest(request, context) {
    return [
      { name: '单元测试', type: TASK_TYPES.TEST, scope: 'unit', description: '执行单元测试' },
      { name: '集成测试', type: TASK_TYPES.TEST, scope: 'integration', description: '执行集成测试' },
      { name: '覆盖率分析', type: TASK_TYPES.TEST, scope: 'coverage', description: '分析测试覆盖率', depends_on: ['T1', 'T2'] },
      { name: '测试报告', type: TASK_TYPES.TEST, scope: 'report', description: '生成测试报告', depends_on: ['T3'] }
    ];
  }
}

module.exports = {
  TaskDecomposer,
  TASK_TYPES,
  TASK_KEYWORDS,
  AGENT_MAP
};