/**
 * Agent Teams - 模块入口
 *
 * 提供统一API，主Agent调用这些API完成任务分解、依赖分析、调度
 * 任务分析和分解由 Agent 智能完成
 */

const ContextManager = require('./lib/context');
const RecoveryManager = require('./lib/recovery');
const CheckpointManager = require('./lib/checkpoint');
const WALManager = require('./lib/wal');
const { TaskDecomposer, TASK_TYPES, AGENT_MAP, DECOMPOSITION_MODES } = require('./lib/decomposer');
const { DependencyAnalyzer } = require('./lib/analyzer');
const { ParallelScheduler } = require('./lib/scheduler');
const { ComplexityAnalyzer, COMPLEXITY_LEVELS, EXECUTION_STRATEGIES } = require('./lib/complexity-analyzer');
const { getTimestamp, generateId, ensureDir, writeFile, writeYAML, readYAML, readFile, deleteFile } = require('./lib/utils');
const { getPaths, DIRS } = require('./lib/constants');
const path = require('path');
const fs = require('fs');

module.exports = {
  ContextManager,
  RecoveryManager,
  CheckpointManager,
  WALManager,
  TaskDecomposer,
  DependencyAnalyzer,
  ParallelScheduler,
  ComplexityAnalyzer,

  TASK_TYPES,
  AGENT_MAP,
  DECOMPOSITION_MODES,
  COMPLEXITY_LEVELS,
  EXECUTION_STRATEGIES,

  getTimestamp,
  generateId,

  getAnalysisInstruction(request, context = {}) {
    const decomposer = new TaskDecomposer();
    return decomposer.decompose(request, context);
  },

  applyAnalysisResult(request, analysisResult, context = {}) {
    const decomposer = new TaskDecomposer();
    return decomposer.applyAnalysisResult(request, analysisResult, context);
  },

  getComplexityAnalysisInstruction(request, context = {}) {
    const analyzer = new ComplexityAnalyzer();
    return analyzer.analyze(request, context);
  },

  applyComplexityResult(analysisResult) {
    const analyzer = new ComplexityAnalyzer();
    return analyzer.applyAnalysisResult(analysisResult);
  },

  checkRecovery(baseDir) {
    const rm = new RecoveryManager(baseDir);
    return rm.checkRecoveryNeeded();
  },

  recover(baseDir) {
    const rm = new RecoveryManager(baseDir);
    return rm.recover();
  },

  decompose(request, options = {}) {
    const decomposer = new TaskDecomposer();
    return decomposer.decompose(request, options);
  },

  analyzeDependencies(tasks) {
    const analyzer = new DependencyAnalyzer();
    return analyzer.analyze(tasks);
  },

  schedule(plan, baseDir) {
    const analyzer = new DependencyAnalyzer();
    const analysis = analyzer.analyze(plan.tasks);

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

  plan(baseDir, request, options = {}) {
    const recoveryCheck = this.checkRecovery(baseDir);
    if (recoveryCheck.needed) {
      return {
        recovery_needed: true,
        recovery: recoveryCheck,
        message: '检测到未完成任务，请先调用 recover() 恢复'
      };
    }

    return {
      needs_analysis: true,
      mission_goal: request,
      analysis_instruction: this.getAnalysisInstruction(request, options).analysis_instruction
    };
  },

  planWithResult(baseDir, request, analysisResult, options = {}) {
    const recoveryCheck = this.checkRecovery(baseDir);
    if (recoveryCheck.needed) {
      return {
        recovery_needed: true,
        recovery: recoveryCheck,
        message: '检测到未完成任务，请先调用 recover() 恢复'
      };
    }

    const decomposed = this.applyAnalysisResult(request, analysisResult, options);

    const cm = new ContextManager(baseDir);
    cm.initMission({ goal: request });

    cm.state.tasks = decomposed.tasks;
    cm.state.progress.total_tasks = decomposed.total_tasks;
    cm.state.progress.pending_tasks = decomposed.total_tasks;
    cm._saveState();

    const chkm = new CheckpointManager(baseDir);
    const initialCheckpoint = chkm.createMicro(cm.state);
    cm.state.checkpoints.push(initialCheckpoint.id);
    cm._saveState();

    const analysis = this.analyzeDependencies(decomposed.tasks);

    const schedule = this.schedule(decomposed, baseDir);

    const planFile = this._persistPlan(baseDir, {
      decomposed,
      analysis,
      schedule,
      timestamp: getTimestamp()
    });

    cm.updateCurrentSummary();

    return {
      mission_id: decomposed.mission_id,
      mission_goal: decomposed.mission_goal,
      task_type: decomposed.task_type,
      decomposition_mode: decomposed.decomposition_mode,
      complexity: decomposed.complexity,
      execution_strategy: decomposed.execution_strategy,
      recovery: recoveryCheck,
      decomposition: {
        total_tasks: decomposed.total_tasks,
        tasks: decomposed.tasks,
        mode: decomposed.decomposition_mode
      },
      analysis: {
        parallel_groups: analysis.parallel_groups,
        conflicts: analysis.conflicts,
        critical_path: analysis.critical_path
      },
      schedule: schedule,
      next_action: this._getNextAction(schedule),
      persisted: true,
      plan_file: planFile,
      checkpoint_id: initialCheckpoint.id
    };
  },

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

  _persistPlan(baseDir, data) {
    const paths = getPaths(baseDir);
    const plansDir = paths.plans;
    ensureDir(plansDir);

    const timestamp = data.timestamp || getTimestamp();
    const missionId = data.decomposed.mission_id;
    const shortId = missionId.split('-').pop().substring(0, 8);
    const fileName = `执行计划-${shortId}.md`;
    const filePath = path.join(plansDir, fileName);

    const content = this._renderPlanDocument(data);
    writeFile(filePath, content);

    return filePath;
  },

  _renderPlanDocument(data) {
    const { decomposed, analysis, schedule, timestamp } = data;

    let content = `# 执行计划

**实例ID**: ${decomposed.mission_id}
**创建时间**: ${timestamp}
**任务类型**: ${decomposed.task_type}
**分解模式**: ${decomposed.decomposition_mode}

---

## 一、需求概述

### 1.1 任务描述

${decomposed.mission_goal}

### 1.2 任务统计

- 总任务数: ${decomposed.total_tasks}
- 总阶段数: ${schedule.total_phases}
- 并行组数: ${analysis.parallel_groups.length}

---

## 二、执行计划

### 2.1 阶段划分

`;

    for (const phase of schedule.execution_plan.phases) {
      content += `#### 阶段${phase.phase_id}

- **执行方式**: ${phase.parallel ? '并行' : '串行'}
- **任务列表**:
`;
      for (const task of phase.tasks) {
        content += `  - [${task.id}] ${task.name} (${task.agent})\n`;
      }
      content += '\n';
    }

    content += `### 2.2 并行执行计划

\`\`\`
`;
    for (const phase of schedule.execution_plan.phases) {
      const mode = phase.parallel ? '并行' : '串行';
      const tasks = phase.tasks.map(t => t.name).join(', ');
      content += `阶段${phase.phase_id} (${mode}): ${tasks}\n`;
      if (phase.phase_id < schedule.execution_plan.phases.length) {
        content += `    │\n    ▼\n`;
      }
    }
    content += `\`\`\`

### 2.3 关键路径

${analysis.critical_path.map(id => `T${id}`).join(' → ') || '无'}

---

## 三、依赖关系

| 任务 | 依赖 |
|------|------|
`;
    for (const task of decomposed.tasks) {
      const deps = task.depends_on?.join(', ') || '无';
      content += `| ${task.id} - ${task.name} | ${deps} |\n`;
    }

    if (analysis.conflicts.length > 0) {
      content += `
---

## 四、冲突检测

| 类型 | 任务 | 范围 | 解决方案 |
|------|------|------|----------|
`;
      for (const conflict of analysis.conflicts) {
        content += `| ${conflict.type} | ${conflict.tasks.join(', ')} | ${conflict.scope} | ${conflict.resolution} |\n`;
      }
    }

    content += `
---

## 五、下一步操作

\`\`\`json
${JSON.stringify(schedule.next_action, null, 2)}
\`\`\`

---

## 更新记录

- ${timestamp}: 计划创建
`;

    return content;
  },

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
    const checkpoint = chkm[typeMap[type] || 'createMicro'](state);

    cm.state.checkpoints.push(checkpoint.id);
    cm._saveState();

    return checkpoint;
  },

  complete(baseDir) {
    const cm = new ContextManager(baseDir);
    cm.loadState();
    cm.completeMission();
  },

  compress(baseDir, options = {}) {
    const cm = new ContextManager(baseDir);
    cm.loadState();
    return cm.compressState(options);
  },

  contextUsage(baseDir) {
    const cm = new ContextManager(baseDir);
    cm.loadState();
    return cm.getContextUsage();
  },

  getSummary(baseDir) {
    const cm = new ContextManager(baseDir);
    cm.loadState();
    return cm.getSummary();
  },

  needsCompression(baseDir) {
    const cm = new ContextManager(baseDir);
    cm.loadState();
    return cm.needsCompression();
  },

  startPhase(baseDir, phaseId, tasks) {
    const cm = new ContextManager(baseDir);
    const state = cm.loadState();
    if (!state) {
      return { error: 'No active mission' };
    }

    const segmentId = `phase-${phaseId}-${Date.now()}`;
    const wal = cm.createSegment(segmentId, {
      phase: phaseId,
      type: 'parallel_group',
      tasks: tasks
    });

    cm.state.current_phase = phaseId;
    cm.state.current_segment = segmentId;
    cm._saveState();

    return {
      segment_id: segmentId,
      phase_id: phaseId,
      wal_initialized: true,
      tasks: tasks
    };
  },

  updateTaskProgress(baseDir, taskId, updates) {
    const cm = new ContextManager(baseDir);
    const state = cm.loadState();
    if (!state) {
      return { error: 'No active mission' };
    }

    const task = state.tasks.find(t => t.id === taskId);
    if (!task) {
      return { error: `Task ${taskId} not found` };
    }

    const oldStatus = task.status;
    task.status = updates.status || task.status;
    task.progress = updates.progress ?? task.progress;
    task.result = updates.result || task.result;
    task.completed_at = updates.status === 'completed' ? getTimestamp() : task.completed_at;

    if (updates.status === 'completed') {
      if (oldStatus === 'in_progress') {
        state.progress.in_progress_tasks--;
      }
      state.progress.completed_tasks++;
    } else if (updates.status === 'in_progress') {
      if (oldStatus === 'pending' || oldStatus === 'assigned') {
        state.progress.in_progress_tasks++;
        state.progress.pending_tasks--;
      }
    } else if (updates.status === 'failed') {
      if (oldStatus === 'in_progress') {
        state.progress.in_progress_tasks--;
      }
    }

    state.progress.percentage = Math.round(
      (state.progress.completed_tasks / state.progress.total_tasks) * 100
    );

    cm._saveState();

    const compressInstruction = cm.recordChange('task_progress', {
      task_id: taskId,
      updates: updates
    });

    cm.updateCurrentSummary();

    return {
      task_id: taskId,
      status: task.status,
      progress: task.progress,
      mission_progress: state.progress.percentage,
      compress_instruction: compressInstruction
    };
  },

  completePhase(baseDir, phaseId) {
    const cm = new ContextManager(baseDir);
    const state = cm.loadState();
    if (!state) {
      return { error: 'No active mission' };
    }

    cm.completeSegment(state.current_segment);

    const chkm = new CheckpointManager(baseDir);
    const checkpoint = chkm.createSegment(state);
    cm.state.checkpoints.push(checkpoint.id);
    cm._saveState();

    const reportFile = this._persistPhaseReport(baseDir, {
      phase_id: phaseId,
      state: state,
      timestamp: getTimestamp()
    });

    return {
      phase_id: phaseId,
      checkpoint_id: checkpoint.id,
      report_file: reportFile,
      progress: state.progress.percentage
    };
  },

  _persistPhaseReport(baseDir, data) {
    const paths = getPaths(baseDir);
    const reportsDir = paths.reports;
    ensureDir(reportsDir);

    const timestamp = data.timestamp || getTimestamp();
    const dateStr = timestamp.split('T')[0];
    const fileName = `阶段${data.phase_id}报告-${dateStr}.md`;
    const filePath = path.join(reportsDir, fileName);

    const completedTasks = data.state.tasks.filter(t => t.status === 'completed');
    const failedTasks = data.state.tasks.filter(t => t.status === 'failed');

    const content = `# 阶段报告

**阶段ID**: ${data.phase_id}
**报告时间**: ${timestamp}
**任务ID**: ${data.state.mission_id}

---

## 执行摘要

- 总任务数: ${data.state.progress.total_tasks}
- 已完成: ${data.state.progress.completed_tasks}
- 进行中: ${data.state.progress.in_progress_tasks}
- 待处理: ${data.state.progress.pending_tasks}
- 整体进度: ${data.state.progress.percentage}%

---

## 本阶段完成的任务

| 任务ID | 名称 | 状态 | 完成时间 |
|--------|------|------|----------|
${completedTasks.map(t => `| ${t.id} | ${t.name} | ${t.status} | ${t.completed_at || '-'} |`).join('\n')}

---

${failedTasks.length > 0 ? `## 失败任务

| 任务ID | 名称 | 错误信息 |
|--------|------|----------|
${failedTasks.map(t => `| ${t.id} | ${t.name} | ${t.result?.error || 'Unknown'} |`).join('\n')}

---` : ''}

## 下一步

继续执行下一阶段任务。

---

*报告自动生成*
`;

    writeFile(filePath, content);
    return filePath;
  },

  recordDecision(baseDir, decision) {
    const cm = new ContextManager(baseDir);
    const state = cm.loadState();
    if (!state) {
      return { error: 'No active mission' };
    }

    const decisionRecord = {
      id: generateId('decision'),
      content: decision.content,
      reason: decision.reason,
      timestamp: getTimestamp()
    };

    state.decisions.push(decisionRecord);
    cm._saveState();

    cm.recordChange('decision', decisionRecord);

    return decisionRecord;
  },

  recordFileModify(baseDir, taskId, filePath, action) {
    const cm = new ContextManager(baseDir);
    const state = cm.loadState();
    if (!state) {
      return { error: 'No active mission' };
    }

    if (!state.files_modified.includes(filePath)) {
      state.files_modified.push(filePath);
    }

    cm._saveState();

    cm.recordChange('file_modify', {
      task_id: taskId,
      file: filePath,
      action: action
    });

    return { recorded: true, file: filePath };
  },

  registerWorker(baseDir, workerInfo) {
    const cm = new ContextManager(baseDir);
    const state = cm.loadState();
    if (!state) {
      return { error: 'No active mission' };
    }

    const worker = {
      id: workerInfo.id || generateId('worker'),
      name: workerInfo.name,
      type: workerInfo.type || 'general-purpose',
      role: workerInfo.role || 'worker',
      status: 'active',
      created_at: getTimestamp(),
      tasks_assigned: [],
      last_heartbeat: getTimestamp()
    };

    state.workers.push(worker);
    cm._saveState();

    const workersDir = path.join(baseDir, '.claude', 'context', 'workers');
    ensureDir(workersDir);
    const workerFile = path.join(workersDir, `${worker.id}.yaml`);
    writeYAML(workerFile, worker);

    cm.recordChange('worker_registered', {
      worker_id: worker.id,
      worker_name: worker.name,
      worker_type: worker.type
    });

    return {
      registered: true,
      worker_id: worker.id,
      worker: worker
    };
  },

  updateWorkerHeartbeat(baseDir, workerId) {
    const cm = new ContextManager(baseDir);
    const state = cm.loadState();
    if (!state) {
      return { error: 'No active mission' };
    }

    const worker = state.workers.find(w => w.id === workerId);
    if (!worker) {
      return { error: `Worker ${workerId} not found` };
    }

    worker.last_heartbeat = getTimestamp();
    cm._saveState();

    return { updated: true, worker_id: workerId };
  },

  assignTaskToWorker(baseDir, workerId, taskId) {
    const cm = new ContextManager(baseDir);
    const state = cm.loadState();
    if (!state) {
      return { error: 'No active mission' };
    }

    const worker = state.workers.find(w => w.id === workerId);
    const task = state.tasks.find(t => t.id === taskId);
    
    if (!worker || !task) {
      return { error: 'Worker or Task not found' };
    }

    task.assigned_to = workerId;
    worker.tasks_assigned.push(taskId);
    task.status = 'assigned';
    
    cm._saveState();
    
    cm.recordChange('task_assigned', {
      task_id: taskId,
      worker_id: workerId
    });

    return {
      assigned: true,
      task_id: taskId,
      worker_id: workerId
    };
  },

  getShutdownInstructions(teamName) {
    return {
      steps: [
        {
          step: 1,
          action: 'send_shutdown_request',
          description: '发送关闭请求给所有Team成员',
          tool: 'SendMessage',
          params: {
            to: '*',
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
  },

  generateFinalReport(baseDir) {
    const cm = new ContextManager(baseDir);
    const state = cm.loadState();
    if (!state) {
      return { error: 'No active mission' };
    }

    const paths = getPaths(baseDir);
    const reportsDir = paths.reports;
    ensureDir(reportsDir);

    const timestamp = getTimestamp();
    const dateStr = timestamp.split('T')[0];
    const fileName = `最终报告-${dateStr}.md`;
    const filePath = path.join(reportsDir, fileName);

    const completedTasks = state.tasks.filter(t => t.status === 'completed');
    const failedTasks = state.tasks.filter(t => t.status === 'failed');

    const content = `# 最终报告

**任务ID**: ${state.mission_id}
**任务目标**: ${state.mission_goal}
**报告时间**: ${timestamp}
**创建时间**: ${state.created_at}

---

## 执行摘要

| 指标 | 数值 |
|------|------|
| 总任务数 | ${state.progress.total_tasks} |
| 已完成 | ${state.progress.completed_tasks} |
| 失败 | ${failedTasks.length} |
| 整体进度 | ${state.progress.percentage}% |

---

## 任务详情

### 已完成任务

| 任务ID | 名称 | 完成时间 |
|--------|------|----------|
${completedTasks.map(t => `| ${t.id} | ${t.name} | ${t.completed_at || '-'} |`).join('\n')}

${failedTasks.length > 0 ? `### 失败任务

| 任务ID | 名称 | 错误 |
|--------|------|------|
${failedTasks.map(t => `| ${t.id} | ${t.name} | ${t.result?.error || 'Unknown'} |`).join('\n')}

` : ''}
---

## 关键决策

| ID | 决策内容 | 原因 | 时间 |
|----|---------|------|------|
${state.decisions.map(d => `| ${d.id} | ${d.content} | ${d.reason || '-'} | ${d.timestamp} |`).join('\n')}

---

## 修改的文件

${state.files_modified.map(f => `- ${f}`).join('\n') || '无'}

---

## 检查点记录

共创建 ${state.checkpoints.length} 个检查点。

---

*报告自动生成 by Agent Teams*
`;

    writeFile(filePath, content);

    return {
      report_file: filePath,
      mission_id: state.mission_id,
      progress: state.progress.percentage
    };
  },

  generateReviewReport(baseDir, reviewData) {
    const cm = new ContextManager(baseDir);
    const state = cm.loadState();
    if (!state) {
      return { error: 'No active mission' };
    }

    const timestamp = getTimestamp();
    const reviewResults = reviewData.results || [];
    const issues = reviewData.issues || [];
    const suggestions = reviewData.suggestions || [];

    const passCount = reviewResults.filter(r => r.status === 'pass').length;
    const failCount = reviewResults.filter(r => r.status === 'fail').length;
    const warnCount = reviewResults.filter(r => r.status === 'warning').length;

    state.review_result = {
      timestamp: timestamp,
      type: reviewData.type || '代码评审',
      results: reviewResults,
      issues: issues,
      suggestions: suggestions,
      pass_count: passCount,
      fail_count: failCount,
      warn_count: warnCount,
      pass_rate: reviewResults.length > 0 ? Math.round(passCount / reviewResults.length * 100) : 0
    };
    cm._saveState();

    cm.recordChange('review_report', {
      type: reviewData.type || 'code_review',
      pass_rate: reviewResults.length > 0 ? Math.round(passCount / reviewResults.length * 100) : 0,
      issues_count: issues.length
    });

    return {
      recorded: true,
      mission_id: state.mission_id,
      pass_rate: reviewResults.length > 0 ? Math.round(passCount / reviewResults.length * 100) : 0,
      issues_count: issues.length,
      status: failCount > 0 ? 'failed' : warnCount > 0 ? 'warning' : 'passed'
    };
  },

  generateTestReport(baseDir, testData) {
    const cm = new ContextManager(baseDir);
    const state = cm.loadState();
    if (!state) {
      return { error: 'No active mission' };
    }

    const timestamp = getTimestamp();
    const testSuites = testData.suites || [];
    const totalTests = testData.total || 0;
    const passed = testData.passed || 0;
    const failed = testData.failed || 0;
    const skipped = testData.skipped || 0;
    const coverage = testData.coverage || {};

    state.test_result = {
      timestamp: timestamp,
      total: totalTests,
      passed: passed,
      failed: failed,
      skipped: skipped,
      duration: testData.duration || '0s',
      environment: testData.environment || '本地',
      coverage: coverage,
      suites: testSuites,
      failures: testData.failures || []
    };
    cm._saveState();

    cm.recordChange('test_report', {
      total: totalTests,
      passed: passed,
      failed: failed,
      coverage: coverage.statements || 0
    });

    return {
      recorded: true,
      mission_id: state.mission_id,
      pass_rate: totalTests > 0 ? Math.round(passed / totalTests * 100) : 0,
      failed_count: failed,
      coverage: coverage,
      status: failed > 0 ? 'failed' : 'passed'
    };
  },

  generateSummaryReport(baseDir, options = {}) {
    const cm = new ContextManager(baseDir);
    const state = cm.loadState();
    if (!state) {
      return { error: 'No active mission' };
    }

    const paths = getPaths(baseDir);
    const reportsDir = paths.reports;
    ensureDir(reportsDir);

    const timestamp = getTimestamp();
    const shortId = state.mission_id.split('-').pop().substring(0, 8);
    const fileName = `汇总报告-${shortId}.md`;
    const filePath = path.join(reportsDir, fileName);

    const completedTasks = state.tasks.filter(t => t.status === 'completed');
    const failedTasks = state.tasks.filter(t => t.status === 'failed');
    const inProgressTasks = state.tasks.filter(t => t.status === 'in_progress');
    const pendingTasks = state.tasks.filter(t => t.status === 'pending');

    const taskTypes = {};
    state.tasks.forEach(t => {
      taskTypes[t.type] = (taskTypes[t.type] || 0) + 1;
    });

    const phases = {};
    state.tasks.forEach(t => {
      phases[t.phase] = (phases[t.phase] || 0) + 1;
    });

    const duration = state.created_at ? 
      Math.round((new Date(timestamp) - new Date(state.created_at)) / 1000 / 60) : 0;

    const testData = options.testData || state.test_result || null;
    const reviewData = options.reviewData || state.review_result || null;

    let testSection = '';
    if (testData) {
      const totalTests = testData.total || 0;
      const passed = testData.passed || 0;
      const failed = testData.failed || 0;
      const coverage = testData.coverage || {};
      
      testSection = `
## 四、测试结果

### 4.1 测试摘要

| 指标 | 数值 |
|------|------|
| 总测试数 | ${totalTests} |
| 通过 | ${passed} |
| 失败 | ${failed} |
| 通过率 | ${totalTests > 0 ? Math.round(passed / totalTests * 100) : 0}% |
| 执行时间 | ${testData.duration || '-'} |

### 4.2 测试覆盖率

| 类型 | 覆盖率 | 状态 |
|------|--------|------|
| 语句覆盖 | ${coverage.statements || 0}% | ${(coverage.statements || 0) >= 80 ? '✅' : '⚠️'} |
| 分支覆盖 | ${coverage.branches || 0}% | ${(coverage.branches || 0) >= 80 ? '✅' : '⚠️'} |
| 函数覆盖 | ${coverage.functions || 0}% | ${(coverage.functions || 0) >= 80 ? '✅' : '⚠️'} |
| 行覆盖 | ${coverage.lines || 0}% | ${(coverage.lines || 0) >= 80 ? '✅' : '⚠️'} |

${testData.failures && testData.failures.length > 0 ? `### 4.3 失败的测试

| 测试名称 | 错误信息 |
|---------|---------|
${testData.failures.map(f => `| ${f.name} | ${f.error || 'Unknown'} |`).join('\n')}

` : ''}
**测试结论**: ${failed > 0 ? '❌ 不通过' : '✅ 通过'}

---
`;
    }

    let reviewSection = '';
    if (reviewData) {
      const results = reviewData.results || [];
      const issues = reviewData.issues || [];
      const suggestions = reviewData.suggestions || [];
      const passCount = results.filter(r => r.status === 'pass').length;
      const failCount = results.filter(r => r.status === 'fail').length;
      const warnCount = results.filter(r => r.status === 'warning').length;

      reviewSection = `
## 五、评审结果

### 5.1 评审摘要

| 指标 | 数值 |
|------|------|
| 评审项总数 | ${results.length} |
| 通过 | ${passCount} |
| 失败 | ${failCount} |
| 警告 | ${warnCount} |
| 通过率 | ${results.length > 0 ? Math.round(passCount / results.length * 100) : 0}% |

### 5.2 检查项详情

| 检查项 | 类型 | 状态 | 说明 |
|--------|------|------|------|
${results.map(r => `| ${r.name} | ${r.type || '代码'} | ${r.status === 'pass' ? '✅' : r.status === 'fail' ? '❌' : '⚠️'} | ${r.message || '-'} |`).join('\n')}

${issues.length > 0 ? `### 5.3 发现的问题

| ID | 问题 | 严重程度 | 文件 |
|----|------|---------|------|
${issues.map((issue, idx) => `| ${idx + 1} | ${issue.message} | ${issue.severity || '中等'} | ${issue.file || '-'} |`).join('\n')}

` : ''}
${suggestions.length > 0 ? `### 5.4 改进建议

${suggestions.map((s, idx) => `${idx + 1}. ${s}`).join('\n')}

` : ''}
**评审结论**: ${failCount > 0 ? '❌ 不通过' : warnCount > 0 ? '⚠️ 有条件通过' : '✅ 通过'}

---
`;
    }

    const content = `# 汇总报告

**任务ID**: ${state.mission_id}
**任务目标**: ${state.mission_goal}
**报告时间**: ${timestamp}
**创建时间**: ${state.created_at}
**总耗时**: ${duration} 分钟

---

## 一、执行概况

### 1.1 任务统计

| 指标 | 数值 |
|------|------|
| 总任务数 | ${state.progress.total_tasks} |
| 已完成 | ${state.progress.completed_tasks} |
| 进行中 | ${state.progress.in_progress_tasks} |
| 待处理 | ${state.progress.pending_tasks} |
| 失败 | ${failedTasks.length} |
| 整体进度 | ${state.progress.percentage}% |

### 1.2 任务类型分布

| 类型 | 数量 | 占比 |
|------|------|------|
${Object.entries(taskTypes).map(([type, count]) => `| ${type} | ${count} | ${Math.round(count / state.tasks.length * 100)}% |`).join('\n')}

### 1.3 阶段分布

| 阶段 | 任务数 |
|------|--------|
${Object.entries(phases).map(([phase, count]) => `| ${phase} | ${count} |`).join('\n')}

---

## 二、任务执行详情

### 2.1 已完成任务

| 任务ID | 名称 | 类型 | 负责Agent | 完成时间 |
|--------|------|------|-----------|----------|
${completedTasks.map(t => `| ${t.id} | ${t.name} | ${t.type} | ${t.agent} | ${t.completed_at || '-'} |`).join('\n')}

${failedTasks.length > 0 ? `### 2.2 失败任务

| 任务ID | 名称 | 错误信息 |
|--------|------|----------|
${failedTasks.map(t => `| ${t.id} | ${t.name} | ${t.result?.error || 'Unknown'} |`).join('\n')}

` : ''}
${inProgressTasks.length > 0 ? `### 2.3 进行中任务

| 任务ID | 名称 | 进度 |
|--------|------|------|
${inProgressTasks.map(t => `| ${t.id} | ${t.name} | ${t.progress || 0}% |`).join('\n')}

` : ''}
---

## 三、团队协作

### 3.1 Worker 统计

| Worker ID | 名称 | 类型 | 分配任务数 |
|-----------|------|------|-----------|
${state.workers.map(w => `| ${w.id} | ${w.name} | ${w.type} | ${w.tasks_assigned?.length || 0} |`).join('\n') || '| - | - | - | - |'}

---
${testSection}${reviewSection}
## ${testData || reviewData ? '六' : '四'}、决策记录

| ID | 决策内容 | 原因 | 时间 |
|----|---------|------|------|
${state.decisions.length > 0 ? state.decisions.map(d => `| ${d.id} | ${d.content} | ${d.reason || '-'} | ${d.timestamp} |`).join('\n') : '| - | 无决策记录 | - | - |'}

---

## ${testData || reviewData ? '七' : '五'}、文件变更

### ${testData || reviewData ? '7.1' : '5.1'} 修改的文件

${state.files_modified.length > 0 ? state.files_modified.map(f => `- ${f}`).join('\n') : '无文件修改记录。'}

---

## ${testData || reviewData ? '八' : '六'}、执行指标

| 指标 | 值 |
|------|-----|
| 总耗时 | ${duration} 分钟 |
| 平均任务耗时 | ${completedTasks.length > 0 ? Math.round(duration / completedTasks.length) : 0} 分钟 |
| 任务完成率 | ${state.progress.percentage}% |
| 并行效率 | ${state.workers.length > 1 ? '高' : '低'} |

---

## ${testData || reviewData ? '九' : '七'}、结论与建议

### ${testData || reviewData ? '9.1' : '7.1'} 执行结论

${state.progress.percentage === 100 ? '✅ 所有任务已完成' : state.progress.percentage >= 80 ? '⚠️ 大部分任务已完成，仍有部分任务待处理' : '❌ 任务完成度较低，需要继续执行'}

### ${testData || reviewData ? '9.2' : '7.2'} 下一步建议

${pendingTasks.length > 0 ? `- 继续执行待处理任务: ${pendingTasks.map(t => t.name).join(', ')}` : '- 所有任务已处理完毕'}
${failedTasks.length > 0 ? `- 处理失败任务: ${failedTasks.map(t => t.name).join(', ')}` : ''}

---

## 更新记录

- ${timestamp}: 汇总报告生成

*报告自动生成 by Agent Teams*
`;

    writeFile(filePath, content);

    return {
      report_file: filePath,
      mission_id: state.mission_id,
      short_id: shortId,
      progress: state.progress.percentage,
      duration_minutes: duration,
      completed_tasks: completedTasks.length,
      failed_tasks: failedTasks.length
    };
  },

  requestAcceptance(baseDir) {
    const cm = new ContextManager(baseDir);
    const state = cm.loadState();
    if (!state) {
      return { error: 'No active mission' };
    }

    const summaryReport = this.generateSummaryReport(baseDir);

    return {
      needs_acceptance: true,
      mission_id: state.mission_id,
      mission_goal: state.mission_goal,
      progress: state.progress.percentage,
      summary_report: summaryReport.report_file,
      message: '任务执行完成，请确认是否验收通过。验收通过后将清理中间文件，只保留计划文档和汇总报告。',
      options: [
        { key: 'accept', label: '验收通过', description: '确认任务完成，清理中间文件' },
        { key: 'reject', label: '验收不通过', description: '任务需要修改，保留所有文件' },
        { key: 'review', label: '查看详情', description: '查看汇总报告后再决定' }
      ]
    };
  },

  confirmAcceptance(baseDir, accepted, options = {}) {
    const cm = new ContextManager(baseDir);
    const state = cm.loadState();
    if (!state) {
      return { error: 'No active mission' };
    }

    if (!accepted) {
      return {
        accepted: false,
        message: '验收未通过，所有文件已保留。请继续修改后重新提交验收。',
        mission_id: state.mission_id
      };
    }

    const cleanupResult = this.cleanupIntermediate(baseDir, options);

    state.status = 'completed';
    state.accepted_at = getTimestamp();
    cm._saveState();

    return {
      accepted: true,
      mission_id: state.mission_id,
      message: '验收通过！中间文件已清理，计划文档和汇总报告已保留。',
      cleanup: cleanupResult,
      preserved_files: cleanupResult.preserved_files
    };
  },

  cleanupIntermediate(baseDir, options = {}) {
    const paths = getPaths(baseDir);
    const cm = new ContextManager(baseDir);
    const state = cm.loadState();
    if (!state) {
      return { error: 'No active mission' };
    }

    const preservedFiles = [];
    const deletedFiles = [];
    const deletedDirs = [];

    const plansDir = paths.plans;
    if (fs.existsSync(plansDir)) {
      const planFiles = fs.readdirSync(plansDir).filter(f => f.endsWith('.md'));
      planFiles.forEach(f => {
        preservedFiles.push(path.join(plansDir, f));
      });
    }

    const reportsDir = paths.reports;
    if (fs.existsSync(reportsDir)) {
      const summaryFiles = fs.readdirSync(reportsDir).filter(f => f.startsWith('汇总报告-'));
      summaryFiles.forEach(f => {
        preservedFiles.push(path.join(reportsDir, f));
      });
      const otherReports = fs.readdirSync(reportsDir).filter(f => !f.startsWith('汇总报告-'));
      otherReports.forEach(f => {
        const filePath = path.join(reportsDir, f);
        deletedFiles.push(filePath);
        fs.unlinkSync(filePath);
      });
    }

    const keepCheckpoints = options.keepCheckpoints || false;
    const keepWAL = options.keepWAL || false;
    const keepWorkers = options.keepWorkers || false;

    if (!keepCheckpoints) {
      const checkpointsDir = paths.checkpoints;
      if (fs.existsSync(checkpointsDir)) {
        const cpFiles = fs.readdirSync(checkpointsDir);
        cpFiles.forEach(f => {
          const filePath = path.join(checkpointsDir, f);
          deletedFiles.push(filePath);
          fs.rmSync(filePath, { recursive: true, force: true });
        });
        deletedDirs.push(checkpointsDir);
      }
    }

    if (!keepWAL) {
      const segmentsDir = paths.segments;
      if (fs.existsSync(segmentsDir)) {
        const segments = fs.readdirSync(segmentsDir);
        segments.forEach(s => {
          const segmentPath = path.join(segmentsDir, s);
          deletedFiles.push(segmentPath);
          fs.rmSync(segmentPath, { recursive: true, force: true });
        });
        deletedDirs.push(segmentsDir);
      }
    }

    if (!keepWorkers) {
      const workersDir = paths.workers;
      if (fs.existsSync(workersDir)) {
        const workerFiles = fs.readdirSync(workersDir);
        workerFiles.forEach(f => {
          const filePath = path.join(workersDir, f);
          deletedFiles.push(filePath);
          fs.rmSync(filePath, { recursive: true, force: true });
        });
        deletedDirs.push(workersDir);
      }
    }

    const activeDir = paths.active;
    if (fs.existsSync(activeDir)) {
      const activeFiles = fs.readdirSync(activeDir);
      activeFiles.forEach(f => {
        if (f !== 'state.yaml') {
          const filePath = path.join(activeDir, f);
          deletedFiles.push(filePath);
          fs.unlinkSync(filePath);
        }
      });
    }

    const coreDir = paths.core;
    if (fs.existsSync(coreDir)) {
      const coreFiles = fs.readdirSync(coreDir);
      coreFiles.forEach(f => {
        const filePath = path.join(coreDir, f);
        deletedFiles.push(filePath);
        fs.unlinkSync(filePath);
      });
      deletedDirs.push(coreDir);
    }

    return {
      preserved_files: preservedFiles,
      deleted_files: deletedFiles,
      deleted_dirs: deletedDirs,
      message: `已清理 ${deletedFiles.length} 个中间文件，保留 ${preservedFiles.length} 个交付文件`
    };
  }
};
