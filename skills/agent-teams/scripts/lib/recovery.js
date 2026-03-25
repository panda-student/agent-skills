/**
 * Agent Teams - 恢复机制
 *
 * 实现自动检测和恢复功能
 */

const { getPaths, TASK_STATUS } = require('./constants');
const { readYAML, readFile, ensureDir, writeFile, getTimestamp } = require('./utils');
const CheckpointManager = require('./checkpoint');
const path = require('path');

class RecoveryManager {
  /**
   * @param {string} baseDir - 项目根目录
   */
  constructor(baseDir) {
    this.baseDir = baseDir;
    this.paths = getPaths(baseDir);
    this.checkpointManager = new CheckpointManager(baseDir);
  }

  /**
   * 检查是否需要恢复
   * @returns {object|null} 恢复信息或null
   */
  checkRecoveryNeeded() {
    // 检查恢复触发器是否存在
    const triggerContent = readFile(this.paths.recoveryTrigger);
    if (!triggerContent) {
      return { needed: false, reason: '无进行中的任务' };
    }

    // 检查状态文件
    const state = readYAML(this.paths.state);
    if (!state) {
      return { needed: false, reason: '状态文件不存在' };
    }

    // 检查任务状态
    if (state.status === TASK_STATUS.COMPLETED) {
      return { needed: false, reason: '任务已完成' };
    }

    if (state.status === TASK_STATUS.IN_PROGRESS) {
      return {
        needed: true,
        reason: '检测到未完成的任务',
        mission_id: state.mission_id,
        mission_goal: state.mission_goal,
        progress: state.progress,
        current_phase: state.current_phase,
        current_segment: state.current_segment
      };
    }

    return { needed: false, reason: '任务状态异常' };
  }

  /**
   * 执行恢复
   * @returns {object} 恢复结果
   */
  recover() {
    console.log('\n【检测到未完成任务，正在恢复...】\n');

    const result = {
      success: false,
      recovered_state: null,
      checkpoint_used: null,
      wal_entries: []
    };

    // 步骤1：获取最新检查点
    const latestCheckpoint = this.checkpointManager.getLatest();
    if (latestCheckpoint) {
      result.checkpoint_used = latestCheckpoint.id;

      // 验证检查点
      if (this.checkpointManager.validate(latestCheckpoint.id)) {
        result.recovered_state = this.checkpointManager.restore(latestCheckpoint.id);
        console.log(`【使用检查点: ${latestCheckpoint.id}】`);
      } else {
        console.warn(`【检查点验证失败，尝试从状态文件恢复】`);
      }
    }

    // 步骤2：读取状态文件
    const state = readYAML(this.paths.state);
    if (state && !result.recovered_state) {
      result.recovered_state = state;
      console.log('【从状态文件恢复】');
    }

    // 步骤3：检查WAL未处理条目
    if (state && state.current_segment) {
      const walFile = path.join(this.paths.segments, state.current_segment, 'wal.log');
      const walContent = readFile(walFile);

      if (walContent) {
        const entries = walContent.trim().split('\n')
          .filter(l => l.trim())
          .map(l => {
            try { return JSON.parse(l); } catch (e) { return null; }
          })
          .filter(e => e !== null);

        // 获取最后处理的序列号
        const lastProcessed = state.last_processed_seq || 0;
        result.wal_entries = entries.filter(e => e.seq > lastProcessed);

        if (result.wal_entries.length > 0) {
          console.log(`【发现 ${result.wal_entries.length} 条未处理WAL条目】`);
        }
      }
    }

    // 步骤4：读取当前摘要
    const currentSummary = readFile(this.paths.current);
    if (currentSummary) {
      result.current_summary = currentSummary;
    }

    result.success = result.recovered_state !== null;

    if (result.success) {
      console.log('\n【上下文已恢复】');
      console.log(`- 任务: ${result.recovered_state.mission_goal || '未知'}`);
      console.log(`- 进度: ${result.recovered_state.progress?.percentage || 0}%`);
      console.log(`- 阶段: ${result.recovered_state.current_phase || '未知'}\n`);
    }

    return result;
  }

  /**
   * 生成恢复报告
   * @param {object} recoveryResult - 恢复结果
   * @returns {string} 报告内容
   */
  generateRecoveryReport(recoveryResult) {
    const lines = [
      '# 恢复报告',
      '',
      `**时间**: ${getTimestamp()}`,
      `**状态**: ${recoveryResult.success ? '成功' : '失败'}`,
      '',
      '## 恢复信息',
      ''
    ];

    if (recoveryResult.checkpoint_used) {
      lines.push(`- 检查点ID: ${recoveryResult.checkpoint_used}`);
    }

    if (recoveryResult.recovered_state) {
      lines.push(`- 任务ID: ${recoveryResult.recovered_state.mission_id}`);
      lines.push(`- 任务目标: ${recoveryResult.recovered_state.mission_goal}`);
      lines.push(`- 当前进度: ${recoveryResult.recovered_state.progress?.percentage || 0}%`);
      lines.push(`- 当前阶段: ${recoveryResult.recovered_state.current_phase || '未知'}`);
    }

    if (recoveryResult.wal_entries.length > 0) {
      lines.push('');
      lines.push('## 未处理WAL条目');
      lines.push('');
      for (const entry of recoveryResult.wal_entries.slice(0, 5)) {
        lines.push(`- [${entry.type}] ${entry.ts}`);
      }
      if (recoveryResult.wal_entries.length > 5) {
        lines.push(`- ... 还有 ${recoveryResult.wal_entries.length - 5} 条`);
      }
    }

    lines.push('');
    lines.push('## 下一步操作');
    lines.push('');
    lines.push('1. 继续执行当前任务');
    lines.push('2. 检查未完成的工作');
    lines.push('3. 完成后创建新的检查点');

    return lines.join('\n');
  }

  /**
   * 更新恢复触发器
   * @param {object} state - 当前状态
   */
  updateRecoveryTrigger(state) {
    const latestCheckpoint = this.checkpointManager.getLatest();

    const content = `# 恢复触发器

> 此文件由系统自动维护，AI每次执行任务前必须检查

---

## 状态检查（必读）

| 检查项 | 当前值 |
|--------|--------|
| 任务进行中 | ${state.status === TASK_STATUS.IN_PROGRESS ? 'YES' : 'NO'} |
| 任务ID | ${state.mission_id} |
| 任务目标 | ${state.mission_goal} |
| 当前进度 | ${state.progress?.percentage || 0}% |
| 最后更新 | ${state.last_updated} |
| 最新检查点 | ${latestCheckpoint?.id || '无'} |

---

## 恢复判断规则

\`\`\`
IF 当前对话中未提及任务上下文 THEN
    → 触发恢复流程
\`\`\`

---

## 恢复执行命令

1. 读取检查点: \`.claude/context/history/checkpoints/${latestCheckpoint?.id || 'latest'}.yaml\`
2. 读取状态: \`.claude/context/active/state.yaml\`
3. 读取摘要: \`.claude/context/active/current.md\`
4. 输出"【上下文已恢复】"

---

## 元信息

- 创建时间: ${state.created_at}
- 最后更新: ${state.last_updated}
`;

    ensureDir(path.dirname(this.paths.recoveryTrigger));
    writeFile(this.paths.recoveryTrigger, content);
  }

  /**
   * 清除恢复触发器
   */
  clearRecoveryTrigger() {
    const fs = require('fs');
    if (fs.existsSync(this.paths.recoveryTrigger)) {
      fs.unlinkSync(this.paths.recoveryTrigger);
      console.log('【恢复触发器已清除】');
    }
  }
}

module.exports = RecoveryManager;