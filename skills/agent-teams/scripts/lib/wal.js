/**
 * Agent Teams - WAL（Write-Ahead Log）管理器
 *
 * 实现WAL持久化机制，确保状态变更可恢复
 */

const { WAL_TYPES, RETENTION } = require('./constants');
const { generateId, getTimestamp, appendFile, readFile, ensureDir, deleteFile } = require('./utils');
const path = require('path');

class WALManager {
  /**
   * @param {string} segmentDir - 分段目录路径
   * @param {string} segmentId - 分段ID
   */
  constructor(segmentDir, segmentId) {
    this.segmentDir = segmentDir;
    this.segmentId = segmentId;
    this.walFile = path.join(segmentDir, 'wal.log');
    this.lastSeq = 0;
    this.buffer = [];
    this.bufferSize = RETENTION.WAL_ENTRIES;

    this._loadLastSeq();
  }

  /**
   * 加载最后序列号
   */
  _loadLastSeq() {
    const content = readFile(this.walFile);
    if (content) {
      const lines = content.trim().split('\n').filter(l => l.trim());
      if (lines.length > 0) {
        try {
          const lastLine = lines[lines.length - 1];
          const lastEntry = JSON.parse(lastLine);
          this.lastSeq = lastEntry.seq || 0;
        } catch (e) {
          this.lastSeq = 0;
        }
      }
    }
  }

  /**
   * 写入WAL条目
   * @param {string} type - 操作类型
   * @param {object} data - 操作数据
   * @returns {object} 写入的条目
   */
  write(type, data = {}) {
    this.lastSeq++;
    const entry = {
      ts: getTimestamp(),
      seq: this.lastSeq,
      type: type,
      seg: this.segmentId,
      data: data
    };

    // 追加写入文件
    appendFile(this.walFile, JSON.stringify(entry));

    // 添加到缓冲区
    this.buffer.push(entry);

    return entry;
  }

  /**
   * 任务开始
   */
  taskStart(taskId, taskName, agentId) {
    return this.write(WAL_TYPES.TASK_START, {
      task_id: taskId,
      task_name: taskName,
      agent: agentId
    });
  }

  /**
   * 任务完成
   */
  taskComplete(taskId, result) {
    return this.write(WAL_TYPES.TASK_COMPLETE, {
      task_id: taskId,
      result: result
    });
  }

  /**
   * 进度更新
   */
  progress(taskId, percent, message) {
    return this.write(WAL_TYPES.PROGRESS, {
      task_id: taskId,
      percent: percent,
      message: message
    });
  }

  /**
   * 决策记录
   */
  decision(decisionId, content, reason) {
    return this.write(WAL_TYPES.DECISION, {
      id: decisionId,
      content: content,
      reason: reason
    });
  }

  /**
   * 错误记录
   */
  error(errorType, message, details) {
    return this.write(WAL_TYPES.ERROR, {
      error_type: errorType,
      message: message,
      details: details
    });
  }

  /**
   * 文件修改
   */
  fileModify(taskId, filePath, action) {
    return this.write(WAL_TYPES.FILE_MODIFY, {
      task_id: taskId,
      file: filePath,
      action: action  // create, modify, delete
    });
  }

  /**
   * 检查点创建
   */
  checkpoint(checkpointId) {
    return this.write(WAL_TYPES.CHECKPOINT, {
      checkpoint_id: checkpointId
    });
  }

  /**
   * 阶段完成
   */
  phaseComplete(phaseId) {
    return this.write(WAL_TYPES.PHASE_COMPLETE, {
      phase_id: phaseId
    });
  }

  /**
   * 质量门通过
   */
  qualityGate(phaseId, results) {
    return this.write(WAL_TYPES.QUALITY_GATE, {
      phase_id: phaseId,
      results: results
    });
  }

  /**
   * 恢复记录
   */
  recovery(checkpointId, reason) {
    return this.write(WAL_TYPES.RECOVERY, {
      checkpoint_id: checkpointId,
      reason: reason
    });
  }

  /**
   * 读取所有条目
   * @returns {Array} WAL条目数组
   */
  readAll() {
    const content = readFile(this.walFile);
    if (!content) return [];

    return content.trim().split('\n')
      .filter(line => line.trim())
      .map(line => {
        try {
          return JSON.parse(line);
        } catch (e) {
          return null;
        }
      })
      .filter(entry => entry !== null);
  }

  /**
   * 读取未处理条目
   * @param {number} lastProcessedSeq - 最后处理的序列号
   * @returns {Array} 未处理条目
   */
  readUnprocessed(lastProcessedSeq) {
    return this.readAll().filter(entry => entry.seq > lastProcessedSeq);
  }

  /**
   * 压缩WAL为摘要
   * @returns {object} 摘要数据
   */
  compress() {
    const entries = this.readAll();
    const summary = {
      segment_id: this.segmentId,
      total_entries: entries.length,
      start_time: entries[0]?.ts,
      end_time: entries[entries.length - 1]?.ts,

      // 聚合数据
      tasks_started: [],
      tasks_completed: [],
      decisions: [],
      errors: [],
      files_modified: []
    };

    for (const entry of entries) {
      switch (entry.type) {
        case WAL_TYPES.TASK_START:
          summary.tasks_started.push(entry.data.task_id);
          break;
        case WAL_TYPES.TASK_COMPLETE:
          summary.tasks_completed.push({
            task_id: entry.data.task_id,
            result: entry.data.result
          });
          break;
        case WAL_TYPES.DECISION:
          summary.decisions.push({
            id: entry.data.id,
            content: entry.data.content
          });
          break;
        case WAL_TYPES.ERROR:
          summary.errors.push({
            type: entry.data.error_type,
            message: entry.data.message
          });
          break;
        case WAL_TYPES.FILE_MODIFY:
          if (!summary.files_modified.includes(entry.data.file)) {
            summary.files_modified.push(entry.data.file);
          }
          break;
      }
    }

    return summary;
  }

  /**
   * 清理旧条目（保留最近的）
   */
  cleanup() {
    const entries = this.readAll();
    if (entries.length > this.bufferSize) {
      const keepEntries = entries.slice(-this.bufferSize);

      // 重写文件
      const fs = require('fs');
      const content = keepEntries.map(e => JSON.stringify(e)).join('\n');
      fs.writeFileSync(this.walFile, content + '\n', 'utf-8');

      console.log(`WAL清理: 保留最近 ${keepEntries.length} 条记录`);
    }
  }
}

module.exports = WALManager;