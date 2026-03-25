/**
 * Agent Teams - 常量定义
 *
 * 定义系统运行所需的所有常量和配置
 */

const path = require('path');

// 上下文根目录
const CONTEXT_ROOT = '.claude/context';

// 目录结构
const DIRS = {
  CORE: 'core',
  ACTIVE: 'active',
  SEGMENTS: 'segments',
  CHECKPOINTS: 'checkpoints',
  HISTORY: 'history',
  WORKERS: 'workers'
};

// 文件名
const FILES = {
  MISSION: 'mission.md',
  CONSTRAINTS: 'constraints.md',
  DECISIONS: 'decisions.md',
  RECOVERY_TRIGGER: 'RECOVERY_TRIGGER.md',
  STATE: 'state.yaml',
  CURRENT: 'current.md',
  PROGRESS: 'progress.md',
  PENDING: 'pending.md',
  BROADCAST: 'broadcast.log',
  WAL: 'wal.log',
  SEGMENT: 'segment.yaml',
  SUMMARY: 'summary.md',
  CHECKPOINT: 'checkpoint.yaml',
  SNAPSHOT: 'snapshot.yaml',
  INDEX: 'index.md'
};

// WAL操作类型
const WAL_TYPES = {
  TASK_START: 'task_start',
  TASK_COMPLETE: 'task_complete',
  PROGRESS: 'progress',
  DECISION: 'decision',
  ERROR: 'error',
  FILE_MODIFY: 'file_modify',
  CHECKPOINT: 'checkpoint',
  PHASE_COMPLETE: 'phase_complete',
  QUALITY_GATE: 'quality_gate',
  RECOVERY: 'recovery'
};

// 检查点类型
const CHECKPOINT_TYPES = {
  MICRO: 'micro_checkpoint',        // 任务完成
  SEGMENT: 'segment_checkpoint',    // 分段完成
  PHASE: 'phase_checkpoint',        // 阶段完成
  QUALITY_GATE: 'quality_gate_checkpoint'  // 质量通过
};

// 任务状态
const TASK_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  FAILED: 'failed',
  BLOCKED: 'blocked'
};

// 依赖类型
const DEPENDENCY_TYPES = {
  HARD: 'hard',      // 必须等待
  SOFT: 'soft',      // 默认并行
  NONE: 'none'       // 无依赖
};

// 并行策略
const PARALLEL_STRATEGY = {
  MAX_PARALLEL: 'max_parallel',      // 最大化并行
  SAFE_PARALLEL: 'safe_parallel',    // 安全并行
  SERIAL: 'serial'                   // 串行
};

// 质量门优先级
const QUALITY_PRIORITY = {
  P0: 'P0',  // 必须通过（编译、类型检查、测试）
  P1: 'P1',  // 应该通过（代码规范）
  P2: 'P2'   // 可选（文档检查）
};

// 保留策略
const RETENTION = {
  MICRO_CHECKPOINT: 10,
  SEGMENT_CHECKPOINT: 5,
  PHASE_CHECKPOINT: 3,
  QUALITY_GATE_CHECKPOINT: 3,
  WAL_ENTRIES: 100,
  BROADCAST_ENTRIES: 10
};

// 批量写入配置
const BATCH_CONFIG = {
  BUFFER_SIZE: 10,
  MAX_WAIT_MS: 30000  // 30秒
};

// 路径生成函数
function getPaths(baseDir) {
  const contextDir = path.join(baseDir, CONTEXT_ROOT);

  return {
    context: contextDir,
    core: path.join(contextDir, DIRS.CORE),
    active: path.join(contextDir, DIRS.ACTIVE),
    segments: path.join(contextDir, DIRS.SEGMENTS),
    checkpoints: path.join(contextDir, DIRS.CHECKPOINTS),
    history: path.join(contextDir, DIRS.HISTORY),
    workers: path.join(contextDir, DIRS.WORKERS),

    // 核心文件
    mission: path.join(contextDir, DIRS.CORE, FILES.MISSION),
    constraints: path.join(contextDir, DIRS.CORE, FILES.CONSTRAINTS),
    decisions: path.join(contextDir, DIRS.CORE, FILES.DECISIONS),
    recoveryTrigger: path.join(contextDir, DIRS.CORE, FILES.RECOVERY_TRIGGER),

    // 活跃文件
    state: path.join(contextDir, DIRS.ACTIVE, FILES.STATE),
    current: path.join(contextDir, DIRS.ACTIVE, FILES.CURRENT),
    progress: path.join(contextDir, DIRS.ACTIVE, FILES.PROGRESS),
    pending: path.join(contextDir, DIRS.ACTIVE, FILES.PENDING),
    broadcast: path.join(contextDir, DIRS.ACTIVE, FILES.BROADCAST),

    // 索引
    index: path.join(contextDir, FILES.INDEX)
  };
}

module.exports = {
  CONTEXT_ROOT,
  DIRS,
  FILES,
  WAL_TYPES,
  CHECKPOINT_TYPES,
  TASK_STATUS,
  DEPENDENCY_TYPES,
  PARALLEL_STRATEGY,
  QUALITY_PRIORITY,
  RETENTION,
  BATCH_CONFIG,
  getPaths
};