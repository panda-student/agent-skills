/**
 * Agent Teams - 检查点管理器
 *
 * 实现多层次检查点机制，支持快速恢复
 */

const { CHECKPOINT_TYPES, RETENTION, getPaths } = require('./constants');
const { generateId, getTimestamp, writeYAML, readYAML, readFile, listFiles, ensureDir, deleteFile, checksum } = require('./utils');
const path = require('path');

class CheckpointManager {
  /**
   * @param {string} baseDir - 项目根目录
   */
  constructor(baseDir) {
    this.baseDir = baseDir;
    this.paths = getPaths(baseDir);
    this.checkpointsDir = this.paths.checkpoints;
    this.indexFile = path.join(this.checkpointsDir, 'index.md');

    ensureDir(this.checkpointsDir);
  }

  /**
   * 创建检查点
   * @param {string} type - 检查点类型
   * @param {object} state - 状态数据
   * @returns {object} 检查点数据
   */
  create(type, state) {
    const checkpointId = generateId('cp');
    const timestamp = getTimestamp();

    const checkpoint = {
      id: checkpointId,
      type: type,
      timestamp: timestamp,

      // 位置信息
      location: {
        segment: state.current_segment || null,
        phase: state.current_phase || null,
        parallel_group: state.parallel_group || null
      },

      // 进度信息
      progress: {
        total_tasks: state.progress?.total_tasks || state.total_tasks || 0,
        completed: state.progress?.completed_tasks || state.completed_tasks || 0,
        in_progress: state.progress?.in_progress_tasks || state.in_progress_tasks || 0,
        pending: state.progress?.pending_tasks || state.pending_tasks || 0,
        percentage: state.progress?.percentage || state.progress_percentage || 0
      },

      // 当前任务
      current: {
        active_tasks: (Array.isArray(state.tasks) ? state.tasks.filter(t => t.status === 'in_progress') : []) || state.active_tasks || [],
        pending_tasks: (Array.isArray(state.tasks) ? state.tasks.filter(t => t.status === 'pending') : []) || state.pending_tasks_list || []
      },

      // 决策记录
      decisions: Array.isArray(state.decisions) ? state.decisions : [],

      // 文件修改
      files_modified: Array.isArray(state.files_modified) ? state.files_modified : [],

      // 校验信息
      validation: {
        created_at: timestamp,
        version: 1
      }
    };

    // 计算校验和
    const content = JSON.stringify(checkpoint);
    checkpoint.validation.checksum = checksum(content);

    // 写入检查点文件
    const checkpointFile = path.join(this.checkpointsDir, `${checkpointId}.yaml`);
    writeYAML(checkpointFile, checkpoint);

    // 更新索引
    this._updateIndex(checkpoint);

    // 清理旧检查点
    this._cleanup(type);

    return checkpoint;
  }

  /**
   * 创建微检查点（任务完成时）
   */
  createMicro(state) {
    return this.create(CHECKPOINT_TYPES.MICRO, state);
  }

  /**
   * 创建分段检查点
   */
  createSegment(state) {
    return this.create(CHECKPOINT_TYPES.SEGMENT, state);
  }

  /**
   * 创建阶段检查点
   */
  createPhase(state) {
    return this.create(CHECKPOINT_TYPES.PHASE, state);
  }

  /**
   * 创建质量门检查点
   */
  createQualityGate(state) {
    return this.create(CHECKPOINT_TYPES.QUALITY_GATE, state);
  }

  /**
   * 获取检查点
   * @param {string} checkpointId - 检查点ID
   * @returns {object|null} 检查点数据
   */
  get(checkpointId) {
    const file = path.join(this.checkpointsDir, `${checkpointId}.yaml`);
    return readYAML(file);
  }

  /**
   * 获取最新检查点
   * @param {string} type - 类型过滤（可选）
   * @returns {object|null} 检查点数据
   */
  getLatest(type = null) {
    const files = listFiles(this.checkpointsDir, '.yaml');
    if (files.length === 0) return null;

    // 按时间戳降序排序
    const checkpoints = files
      .map(f => readYAML(path.join(this.checkpointsDir, f)))
      .filter(cp => cp !== null && (type === null || cp.type === type))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return checkpoints[0] || null;
  }

  /**
   * 列出所有检查点
   * @param {string} type - 类型过滤（可选）
   * @returns {Array} 检查点列表
   */
  list(type = null) {
    const files = listFiles(this.checkpointsDir, '.yaml');

    return files
      .map(f => readYAML(path.join(this.checkpointsDir, f)))
      .filter(cp => cp !== null && (type === null || cp.type === type))
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  /**
   * 验证检查点
   * @param {string} checkpointId - 检查点ID
   * @returns {boolean} 是否有效
   */
  validate(checkpointId) {
    const checkpoint = this.get(checkpointId);
    if (!checkpoint) return false;

    // 检查必填字段
    const required = ['id', 'type', 'timestamp', 'progress'];
    for (const field of required) {
      if (!checkpoint[field]) return false;
    }

    // 验证校验和（如果存在）
    if (checkpoint.validation && checkpoint.validation.checksum) {
      // 校验和验证暂时跳过（简化处理）
      // TODO: 实现正确的校验和验证
    }

    return true;
  }

  /**
   * 更新索引
   * @param {object} checkpoint - 检查点数据
   */
  _updateIndex(checkpoint) {
    let content = `# 检查点索引\n\n`;
    content += `最后更新: ${checkpoint.timestamp}\n\n`;

    const checkpoints = this.list();

    // 按类型分组
    const grouped = {};
    for (const cp of checkpoints) {
      if (!grouped[cp.type]) {
        grouped[cp.type] = [];
      }
      grouped[cp.type].push(cp);
    }

    // 生成索引
    for (const [type, cps] of Object.entries(grouped)) {
      content += `## ${type}\n\n`;
      for (const cp of cps) {
        content += `- **${cp.id}** (${cp.timestamp})\n`;
        content += `  - 进度: ${cp.progress?.percentage || 0}%\n`;
        if (cp.location?.phase) {
          content += `  - 阶段: ${cp.location.phase}\n`;
        }
      }
      content += '\n';
    }

    const fs = require('fs');
    fs.writeFileSync(this.indexFile, content, 'utf-8');
  }

  /**
   * 清理旧检查点
   * @param {string} type - 检查点类型
   */
  _cleanup(type) {
    const retentionMap = {
      [CHECKPOINT_TYPES.MICRO]: RETENTION.MICRO_CHECKPOINT,
      [CHECKPOINT_TYPES.SEGMENT]: RETENTION.SEGMENT_CHECKPOINT,
      [CHECKPOINT_TYPES.PHASE]: RETENTION.PHASE_CHECKPOINT,
      [CHECKPOINT_TYPES.QUALITY_GATE]: RETENTION.QUALITY_GATE_CHECKPOINT
    };

    const maxKeep = retentionMap[type] || 5;
    const checkpoints = this.list(type);

    // 删除超出数量的旧检查点
    if (checkpoints.length > maxKeep) {
      const toDelete = checkpoints.slice(maxKeep);
      for (const cp of toDelete) {
        const file = path.join(this.checkpointsDir, `${cp.id}.yaml`);
        deleteFile(file);
        console.log(`删除旧检查点: ${cp.id}`);
      }
    }
  }

  /**
   * 从检查点恢复状态
   * @param {string} checkpointId - 检查点ID
   * @returns {object|null} 恢复的状态
   */
  restore(checkpointId) {
    // 先验证
    if (!this.validate(checkpointId)) {
      console.error(`检查点验证失败: ${checkpointId}`);
      return null;
    }

    const checkpoint = this.get(checkpointId);
    if (!checkpoint) return null;

    // 构建恢复状态
    return {
      checkpoint_id: checkpoint.id,
      checkpoint_time: checkpoint.timestamp,

      current_segment: checkpoint.location.segment,
      current_phase: checkpoint.location.phase,

      progress_percentage: checkpoint.progress.percentage,
      total_tasks: checkpoint.progress.total_tasks,
      completed_tasks: checkpoint.progress.completed,
      in_progress_tasks: checkpoint.progress.in_progress,
      pending_tasks: checkpoint.progress.pending,

      active_tasks: checkpoint.current.active_tasks,
      pending_tasks_list: checkpoint.current.pending_tasks,

      decisions: checkpoint.decisions,
      files_modified: checkpoint.files_modified
    };
  }
}

module.exports = CheckpointManager;