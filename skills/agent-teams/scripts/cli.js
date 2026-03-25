#!/usr/bin/env node

/**
 * Agent Teams CLI
 *
 * 命令行工具入口
 */

const path = require('path');
const ContextManager = require('./lib/context');
const RecoveryManager = require('./lib/recovery');
const CheckpointManager = require('./lib/checkpoint');
const { getTimestamp, generateId } = require('./lib/utils');

// 解析命令行参数
const args = process.argv.slice(2);
const command = args[0];
const baseDir = process.cwd();

const contextManager = new ContextManager(baseDir);
const recoveryManager = new RecoveryManager(baseDir);
const checkpointManager = new CheckpointManager(baseDir);

function printHelp() {
  console.log(`
Agent Teams CLI - 上下文管理工具

用法:
  node cli.js <command> [options]

命令:
  init <goal>              初始化新任务
  status                   显示当前状态
  checkpoint [type]        创建检查点 (micro|segment|phase|quality)
  recover                  执行恢复
  check                    检查是否需要恢复
  broadcast                广播当前状态
  complete                 完成任务
  list                     列出所有检查点
  clean                    清理旧数据

示例:
  node cli.js init "实现用户登录功能"
  node cli.js status
  node cli.js checkpoint segment
  node cli.js recover
`);
}

async function main() {
  try {
    switch (command) {
      case 'init':
        await handleInit(args[1]);
        break;

      case 'status':
        await handleStatus();
        break;

      case 'checkpoint':
        await handleCheckpoint(args[1]);
        break;

      case 'recover':
        await handleRecover();
        break;

      case 'check':
        await handleCheck();
        break;

      case 'broadcast':
        await handleBroadcast();
        break;

      case 'complete':
        await handleComplete();
        break;

      case 'list':
        await handleList();
        break;

      case 'clean':
        await handleClean();
        break;

      case 'help':
      case '--help':
      case '-h':
      default:
        printHelp();
        break;
    }
  } catch (error) {
    console.error('执行失败:', error.message);
    process.exit(1);
  }
}

async function handleInit(goal) {
  if (!goal) {
    console.error('请提供任务目标');
    process.exit(1);
  }

  console.log(`\n初始化任务: ${goal}\n`);

  const mission = {
    goal: goal,
    successCriteria: '功能正常运行，测试通过',
    constraints: '遵循项目代码规范'
  };

  const state = contextManager.initMission(mission);

  console.log('任务已初始化:');
  console.log(`- 任务ID: ${state.mission_id}`);
  console.log(`- 目标: ${state.mission_goal}`);
  console.log(`- 状态: ${state.status}`);
  console.log(`- 时间: ${state.created_at}`);
  console.log('\n上下文目录已创建: .claude/context/');
}

async function handleStatus() {
  const state = contextManager.loadState();

  if (!state) {
    console.log('无进行中的任务');
    return;
  }

  console.log('\n=== 当前任务状态 ===\n');
  console.log(`任务ID: ${state.mission_id}`);
  console.log(`目标: ${state.mission_goal}`);
  console.log(`状态: ${state.status}`);
  console.log(`当前阶段: ${state.current_phase || '未知'}`);
  console.log(`当前分段: ${state.current_segment || '无'}`);
  console.log('\n进度:');
  console.log(`- 总任务: ${state.progress?.total_tasks || 0}`);
  console.log(`- 已完成: ${state.progress?.completed_tasks || 0}`);
  console.log(`- 进行中: ${state.progress?.in_progress_tasks || 0}`);
  console.log(`- 待处理: ${state.progress?.pending_tasks || 0}`);
  console.log(`- 进度: ${state.progress?.percentage || 0}%`);
  console.log(`\n最后更新: ${state.last_updated}`);
}

async function handleCheckpoint(type = 'micro') {
  const state = contextManager.loadState();
  if (!state) {
    console.log('无进行中的任务');
    return;
  }

  const typeMap = {
    micro: 'createMicro',
    segment: 'createSegment',
    phase: 'createPhase',
    quality: 'createQualityGate'
  };

  const method = typeMap[type] || 'createMicro';
  const checkpoint = checkpointManager[method](state);

  console.log(`\n检查点已创建:`);
  console.log(`- ID: ${checkpoint.id}`);
  console.log(`- 类型: ${checkpoint.type}`);
  console.log(`- 时间: ${checkpoint.timestamp}`);
  console.log(`- 进度: ${checkpoint.progress?.percentage || 0}%`);
}

async function handleRecover() {
  const result = recoveryManager.recover();

  if (result.success) {
    console.log('\n恢复成功!');

    // 生成恢复报告
    const report = recoveryManager.generateRecoveryReport(result);
    console.log('\n' + report);
  } else {
    console.log('\n恢复失败:', result.reason || '未知原因');
  }
}

async function handleCheck() {
  const result = recoveryManager.checkRecoveryNeeded();

  console.log('\n恢复检查结果:');
  console.log(`- 需要恢复: ${result.needed ? '是' : '否'}`);
  console.log(`- 原因: ${result.reason}`);

  if (result.needed) {
    console.log('\n任务信息:');
    console.log(`- ID: ${result.mission_id}`);
    console.log(`- 目标: ${result.mission_goal}`);
    console.log(`- 进度: ${result.progress?.percentage || 0}%`);
  }
}

async function handleBroadcast() {
  contextManager.broadcast();
  console.log('\n状态已广播到: .claude/context/active/broadcast.log');
}

async function handleComplete() {
  const state = contextManager.loadState();
  if (!state) {
    console.log('无进行中的任务');
    return;
  }

  contextManager.completeMission();

  console.log('\n任务已完成:');
  console.log(`- 任务ID: ${state.mission_id}`);
  console.log(`- 目标: ${state.mission_goal}`);
  console.log('- 恢复触发器已清除');
}

async function handleList() {
  const checkpoints = checkpointManager.list();

  if (checkpoints.length === 0) {
    console.log('无检查点');
    return;
  }

  console.log('\n检查点列表:\n');

  for (const cp of checkpoints) {
    console.log(`[${cp.id}] ${cp.type}`);
    console.log(`  时间: ${cp.timestamp}`);
    console.log(`  进度: ${cp.progress?.percentage || 0}%`);
    console.log('');
  }
}

async function handleClean() {
  // 清理旧的检查点
  checkpointManager._cleanup('micro_checkpoint');
  checkpointManager._cleanup('segment_checkpoint');
  checkpointManager._cleanup('phase_checkpoint');

  console.log('\n清理完成');
}

main();