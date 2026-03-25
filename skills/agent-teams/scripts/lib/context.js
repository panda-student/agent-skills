/**
 * Agent Teams - 上下文管理器
 *
 * 核心状态管理模块，协调WAL、检查点、状态文件
 */

const { getPaths, DIRS, FILES, TASK_STATUS, RETENTION, BATCH_CONFIG } = require('./constants');
const { ensureDir, writeYAML, readYAML, writeFile, readFile, appendFile, generateId, getTimestamp } = require('./utils');
const WALManager = require('./wal');
const CheckpointManager = require('./checkpoint');
const path = require('path');

class ContextManager {
  /**
   * @param {string} baseDir - 项目根目录
   */
  constructor(baseDir) {
    this.baseDir = baseDir;
    this.paths = getPaths(baseDir);
    this.checkpointManager = new CheckpointManager(baseDir);

    // 当前状态
    this.state = null;
    this.currentSegment = null;
    this.currentWAL = null;

    // 批量写入缓冲区
    this.buffer = [];
    this.lastFlush = Date.now();

    // 初始化目录结构
    this._initDirectories();
  }

  /**
   * 初始化目录结构
   */
  _initDirectories() {
    for (const key of Object.keys(DIRS)) {
      ensureDir(this.paths[key.toLowerCase()] || path.join(this.paths.context, DIRS[key.toLowerCase()]));
    }

    // 确保关键目录存在
    ensureDir(this.paths.core);
    ensureDir(this.paths.active);
    ensureDir(this.paths.segments);
    ensureDir(this.paths.checkpoints);
    ensureDir(this.paths.history);
    ensureDir(this.paths.workers);
  }

  /**
   * 初始化新任务
   * @param {object} mission - 任务信息
   * @returns {object} 初始状态
   */
  initMission(mission) {
    const missionId = generateId('mission');
    const timestamp = getTimestamp();

    // 创建任务文件
    const missionContent = `# 任务目标\n\n## 目标\n${mission.goal}\n\n## 成功标准\n${mission.successCriteria || '待定义'}\n\n## 约束条件\n${mission.constraints || '无特殊约束'}\n`;
    writeFile(this.paths.mission, missionContent);

    // 创建约束文件
    const constraintsContent = `# 约束条件\n\n## 技术约束\n- 编程语言: ${mission.language || '不限'}\n- 框架: ${mission.framework || '不限'}\n\n## 质量约束\n- 必须通过编译\n- 必须通过类型检查\n- 必须通过测试\n`;
    writeFile(this.paths.constraints, constraintsContent);

    // 创建决策索引
    writeFile(this.paths.decisions, '# 决策日志\n\n| ID | 决策内容 | 原因 | 时间 |\n|----|---------|------|------|\n');

    // 创建恢复触发器
    this._createRecoveryTrigger(missionId, mission.goal);

    // 初始化状态
    this.state = {
      mission_id: missionId,
      mission_goal: mission.goal,
      status: TASK_STATUS.IN_PROGRESS,
      created_at: timestamp,
      last_updated: timestamp,

      current_phase: 'init',
      current_segment: null,

      progress: {
        total_tasks: 0,
        completed_tasks: 0,
        in_progress_tasks: 0,
        pending_tasks: 0,
        percentage: 0
      },

      tasks: [],
      decisions: [],
      files_modified: [],

      workers: [],
      checkpoints: []
    };

    this._saveState();

    // 创建初始检查点
    const checkpoint = this.checkpointManager.createMicro(this.state);
    this.state.checkpoints.push(checkpoint.id);

    return this.state;
  }

  /**
   * 创建恢复触发器
   */
  _createRecoveryTrigger(missionId, goal) {
    const content = `# 恢复触发器

> 此文件由系统自动维护，AI每次执行任务前必须检查

---

## 状态检查（必读）

| 检查项 | 当前值 |
|--------|--------|
| 任务进行中 | YES |
| 任务ID | ${missionId} |
| 任务目标 | ${goal} |
| 最后更新 | ${getTimestamp()} |

---

## 恢复判断规则

\`\`\`
IF 当前对话中未提及任务上下文 THEN
    → 触发恢复流程
    → 读取 active/state.yaml
    → 读取 active/current.md
\`\`\`

---

## 恢复执行命令

**若上述条件满足，立即执行**：

1. 读取 \`.claude/context/history/checkpoints/{latest_checkpoint}.yaml\`
2. 读取 \`.claude/context/active/state.yaml\`
3. 输出"【上下文已恢复】任务：{mission_goal}，进度：{progress}%"

---

## 元信息（系统维护）

- 创建时间: ${getTimestamp()}
- 最后更新: ${getTimestamp()}
`;

    writeFile(this.paths.recoveryTrigger, content);
  }

  /**
   * 加载状态
   * @returns {object|null} 状态数据
   */
  loadState() {
    this.state = readYAML(this.paths.state);
    // 确保数组字段正确
    if (this.state) {
      if (!Array.isArray(this.state.tasks)) this.state.tasks = [];
      if (!Array.isArray(this.state.decisions)) this.state.decisions = [];
      if (!Array.isArray(this.state.files_modified)) this.state.files_modified = [];
      if (!Array.isArray(this.state.workers)) this.state.workers = [];
      if (!Array.isArray(this.state.checkpoints)) this.state.checkpoints = [];
    }
    return this.state;
  }

  /**
   * 保存状态
   */
  _saveState() {
    if (this.state) {
      this.state.last_updated = getTimestamp();
      writeYAML(this.paths.state, this.state);
    }
  }

  /**
   * 更新当前摘要
   */
  updateCurrentSummary() {
    if (!this.state) return;

    const content = `# 当前执行状态

## 任务概览
- **任务ID**: ${this.state.mission_id}
- **目标**: ${this.state.mission_goal}
- **当前阶段**: ${this.state.current_phase}
- **当前分段**: ${this.state.current_segment || '无'}
- **整体进度**: ${this.state.progress.percentage}%

## 进度统计
- 总任务数: ${this.state.progress.total_tasks}
- 已完成: ${this.state.progress.completed_tasks}
- 进行中: ${this.state.progress.in_progress_tasks}
- 待处理: ${this.state.progress.pending_tasks}

## 当前任务
| 任务ID | 名称 | 状态 | 进度 |
|--------|------|------|------|
${this._formatTasksTable()}

## 关键决策
| ID | 决策内容 |
|----|---------|
${this._formatDecisionsTable()}

## 最近修改的文件
${this._formatFilesList()}

## 下一步操作
${this._getNextSteps()}
`;

    writeFile(this.paths.current, content);
  }

  _formatTasksTable() {
    if (!this.state.tasks || this.state.tasks.length === 0) {
      return '| - | 暂无任务 | - | - |\n';
    }
    return this.state.tasks
      .slice(-5)
      .map(t => `| ${t.id} | ${t.name} | ${t.status} | ${t.progress || 0}% |`)
      .join('\n');
  }

  _formatDecisionsTable() {
    if (!this.state.decisions || this.state.decisions.length === 0) {
      return '| - | 暂无决策 |\n';
    }
    return this.state.decisions
      .slice(-5)
      .map(d => `| ${d.id} | ${d.content} |`)
      .join('\n');
  }

  _formatFilesList() {
    if (!this.state.files_modified || this.state.files_modified.length === 0) {
      return '- 暂无修改';
    }
    return this.state.files_modified
      .slice(-10)
      .map(f => `- ${f}`)
      .join('\n');
  }

  _getNextSteps() {
    const pending = this.state.tasks?.filter(t => t.status === TASK_STATUS.PENDING) || [];
    if (pending.length === 0) return '- 所有任务已完成';
    return pending.slice(0, 3).map(t => `- ${t.name}`).join('\n');
  }

  /**
   * 创建新分段
   * @param {string} segmentId - 分段ID
   * @param {object} config - 分段配置
   * @returns {WALManager} WAL管理器
   */
  createSegment(segmentId, config) {
    const segmentDir = path.join(this.paths.segments, segmentId);
    ensureDir(segmentDir);

    // 创建分段配置
    const segmentConfig = {
      id: segmentId,
      type: config.type || 'parallel_group',
      parent_phase: config.phase,
      tasks: config.tasks || [],
      status: TASK_STATUS.IN_PROGRESS,
      created_at: getTimestamp()
    };

    writeYAML(path.join(segmentDir, 'segment.yaml'), segmentConfig);

    // 更新状态
    this.state.current_segment = segmentId;
    this._saveState();

    // 创建WAL管理器
    this.currentWAL = new WALManager(segmentDir, segmentId);

    return this.currentWAL;
  }

  /**
   * 完成分段
   * @param {string} segmentId - 分段ID
   */
  completeSegment(segmentId) {
    if (this.currentWAL) {
      // 压缩WAL
      const summary = this.currentWAL.compress();
      writeFile(
        path.join(this.paths.segments, segmentId, 'summary.md'),
        `# 分段摘要\n\n## ${segmentId}\n\n完成时间: ${getTimestamp()}\n\n任务数: ${summary.tasks_completed?.length || 0}\n`
      );

      // 创建分段检查点
      const checkpoint = this.checkpointManager.createSegment(this.state);
      this.state.checkpoints.push(checkpoint.id);
    }

    this.currentWAL = null;
    this.state.current_segment = null;
    this._saveState();
  }

  /**
   * 记录状态变更
   * @param {string} type - 变更类型
   * @param {object} data - 变更数据
   * @returns {object|null} 压缩任务指令（如果需要压缩）
   */
  recordChange(type, data) {
    if (this.currentWAL) {
      this.currentWAL.write(type, data);
    }

    // 更新缓冲区
    this.buffer.push({ type, data, ts: getTimestamp() });

    // 检查是否需要刷新
    if (this.buffer.length >= BATCH_CONFIG.BUFFER_SIZE ||
        Date.now() - this.lastFlush > BATCH_CONFIG.MAX_WAIT_MS) {
      this.flush();
    }

    // 返回压缩任务指令（由主Agent调度子Agent执行）
    return this._checkCompressNeeded();
  }

  /**
   * 检查是否需要压缩，返回任务指令
   * @returns {object|null} 压缩任务指令
   */
  _checkCompressNeeded() {
    if (!this.state) return null;

    const usage = this.getContextUsage();

    if (usage.recommendation === 'compress') {
      return {
        action: 'launch_compress_agent',
        reason: 'context_usage_high',
        current_usage: usage.usage_percent,
        task: {
          type: 'compress',
          agent: 'compressor',
          description: '压缩状态，归档已完成任务',
          params: {
            keepRecent: 5,
            estimated_tokens: usage.estimated_tokens
          }
        }
      };
    }

    return null;
  }

  /**
   * 刷新缓冲区
   */
  flush() {
    if (this.buffer.length === 0) return;

    this._saveState();
    this.updateCurrentSummary();
    this._updateRecoveryTrigger();

    this.buffer = [];
    this.lastFlush = Date.now();
  }

  /**
   * 更新恢复触发器
   */
  _updateRecoveryTrigger() {
    if (!this.state) return;

    const latestCheckpoint = this.checkpointManager.getLatest();
    const content = `# 恢复触发器

> 此文件由系统自动维护，AI每次执行任务前必须检查

---

## 状态检查（必读）

| 检查项 | 当前值 |
|--------|--------|
| 任务进行中 | ${this.state.status === TASK_STATUS.IN_PROGRESS ? 'YES' : 'NO'} |
| 任务ID | ${this.state.mission_id} |
| 任务目标 | ${this.state.mission_goal} |
| 当前进度 | ${this.state.progress.percentage}% |
| 最后更新 | ${this.state.last_updated} |
| 最新检查点 | ${latestCheckpoint?.id || '无'} |

---

## 恢复判断规则

\`\`\`
IF 当前对话中未提及任务上下文 THEN
    → 触发恢复流程
\`\`\`

---

## 恢复执行命令

1. 读取 \`.claude/context/history/checkpoints/${latestCheckpoint?.id || 'latest'}.yaml\`
2. 读取 \`.claude/context/active/state.yaml\`
3. 输出"【上下文已恢复】"

---

## 元信息

- 创建时间: ${this.state.created_at}
- 最后更新: ${this.state.last_updated}
`;

    writeFile(this.paths.recoveryTrigger, content);
  }

  /**
   * 广播状态
   */
  broadcast() {
    if (!this.state) return;

    const content = `
## 状态广播

**时间**: ${getTimestamp()}
**任务**: ${this.state.mission_goal}
**阶段**: ${this.state.current_phase}
**进度**: ${this.state.progress.percentage}%

**已完成**: ${this.state.progress.completed_tasks}/${this.state.progress.total_tasks}

---
`;

    appendFile(this.paths.broadcast, content);

    // 保留最近的广播
    this._cleanupBroadcast();
  }

  /**
   * 清理广播日志
   */
  _cleanupBroadcast() {
    const content = readFile(this.paths.broadcast);
    if (!content) return;

    const broadcasts = content.split('---\n').filter(b => b.trim());
    if (broadcasts.length > RETENTION.BROADCAST_ENTRIES) {
      const keep = broadcasts.slice(-RETENTION.BROADCAST_ENTRIES);
      writeFile(this.paths.broadcast, keep.join('---\n') + '---\n');
    }
  }

  /**
   * 完成任务
   */
  completeMission() {
    this.state.status = TASK_STATUS.COMPLETED;
    this._saveState();

    // 创建最终检查点
    this.checkpointManager.createPhase(this.state);

    // 删除恢复触发器
    const fs = require('fs');
    if (fs.existsSync(this.paths.recoveryTrigger)) {
      fs.unlinkSync(this.paths.recoveryTrigger);
    }
  }

  // ============ 状态压缩机制 ============

  /**
   * 压缩状态 - 减少上下文占用
   * @param {object} options - 压缩选项
   * @returns {object} 压缩后的摘要
   */
  compressState(options = {}) {
    if (!this.state) return null;

    const keepRecent = options.keepRecent || 5;
    const archiveCompleted = options.archiveCompleted !== false;

    // 创建压缩摘要
    const summary = {
      mission_id: this.state.mission_id,
      mission_goal: this.state.mission_goal,
      status: this.state.status,
      current_phase: this.state.current_phase,
      progress: { ...this.state.progress },
      last_updated: this.state.last_updated
    };

    // 保留最近的任务（精简版）
    if (this.state.tasks && this.state.tasks.length > 0) {
      const recentTasks = this.state.tasks.slice(-keepRecent);
      summary.recent_tasks = recentTasks.map(t => ({
        id: t.id,
        name: t.name,
        status: t.status
      }));

      // 归档已完成任务
      if (archiveCompleted) {
        const completed = this.state.tasks.filter(t => t.status === TASK_STATUS.COMPLETED);
        if (completed.length > keepRecent) {
          this._archiveTasks(completed.slice(0, -keepRecent));
          this.state.tasks = this.state.tasks.filter(t =>
            t.status !== TASK_STATUS.COMPLETED ||
            this.state.tasks.indexOf(t) >= this.state.tasks.length - keepRecent
          );
        }
      }
    }

    // 保留关键决策（最近3条）
    if (this.state.decisions && this.state.decisions.length > 3) {
      summary.key_decisions = this.state.decisions.slice(-3);
      this.state.decisions = this.state.decisions.slice(-3);
    }

    // 清理旧文件列表
    if (this.state.files_modified && this.state.files_modified.length > 20) {
      summary.files_count = this.state.files_modified.length;
      this.state.files_modified = this.state.files_modified.slice(-20);
    }

    // 清理旧检查点引用
    if (this.state.checkpoints && this.state.checkpoints.length > 10) {
      this.state.checkpoints = this.state.checkpoints.slice(-10);
    }

    // 保存压缩后的状态
    this._saveState();

    // 写入压缩摘要
    const summaryPath = path.join(this.paths.history, `compress-${getTimestamp().replace(/:/g, '-')}.yaml`);
    writeYAML(summaryPath, summary);

    return summary;
  }

  /**
   * 归档任务到历史
   */
  _archiveTasks(tasks) {
    if (!tasks || tasks.length === 0) return;

    const archivePath = path.join(this.paths.history, 'archived-tasks.yaml');
    let archived = readYAML(archivePath) || { tasks: [] };
    archived.tasks.push(...tasks.map(t => ({
      id: t.id,
      name: t.name,
      status: t.status,
      completed_at: t.completed_at || getTimestamp()
    })));
    writeYAML(archivePath, archived);
  }

  /**
   * 获取上下文使用情况
   * @returns {object} 上下文使用报告
   */
  getContextUsage() {
    if (!this.state) {
      return { status: 'no_state', usage: 0 };
    }

    // 估算状态文件各部分大小（用于判断是否需要压缩状态）
    const estimate = {
      mission_info: 500, // 固定开销
      progress: 200,
      tasks: this._estimateTasksSize(),
      decisions: this._estimateArraySize(this.state.decisions),
      files: this._estimateArraySize(this.state.files_modified),
      workers: this._estimateArraySize(this.state.workers),
      checkpoints: this._estimateArraySize(this.state.checkpoints)
    };

    const total = Object.values(estimate).reduce((a, b) => a + b, 0);

    // 状态文件大小阈值（超过此值建议压缩）
    // 假设状态文件不宜超过 50k tokens（约 200k 字符）
    const stateSizeLimit = 200000; // 字符数
    const estimatedTokens = Math.ceil(total * 0.25);
    const usagePercent = Math.min(100, Math.round((total / stateSizeLimit) * 100));

    return {
      status: usagePercent > 80 ? 'warning' : 'ok',
      state_size_chars: total,
      estimated_tokens: estimatedTokens,
      usage_percent: usagePercent,
      breakdown: estimate,
      recommendation: usagePercent > 80 ? 'compress' : 'ok'
    };
  }

  /**
   * 估算任务大小
   */
  _estimateTasksSize() {
    if (!this.state.tasks) return 0;
    return this.state.tasks.reduce((sum, t) => {
      return sum + (t.name?.length || 0) + (t.description?.length || 0) + 200;
    }, 0);
  }

  /**
   * 估算数组大小
   */
  _estimateArraySize(arr) {
    if (!arr || !Array.isArray(arr)) return 0;
    return arr.reduce((sum, item) => {
      if (typeof item === 'string') return sum + item.length;
      if (typeof item === 'object') return sum + JSON.stringify(item).length;
      return sum + 50;
    }, 0);
  }

  /**
   * 获取精简摘要（用于传递给子Agent）
   * @returns {object} 精简摘要
   */
  getSummary() {
    if (!this.state) return null;

    return {
      mission_id: this.state.mission_id,
      goal: this.state.mission_goal,
      phase: this.state.current_phase,
      progress: `${this.state.progress.completed_tasks}/${this.state.progress.total_tasks}`,
      pending_tasks: (this.state.tasks || [])
        .filter(t => t.status === TASK_STATUS.PENDING)
        .map(t => ({ id: t.id, name: t.name })),
      last_checkpoint: this.state.checkpoints?.slice(-1)[0] || null
    };
  }

  /**
   * 检查是否需要压缩
   */
  needsCompression() {
    const usage = this.getContextUsage();
    return usage.recommendation === 'compress';
  }
}

module.exports = ContextManager;