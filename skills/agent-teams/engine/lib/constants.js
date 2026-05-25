/**
 * Agent Teams - 常量定义
 */

const path = require('path');
const { execSync } = require('child_process');

// ============ 路径常量 ============

// 工作目录根目录（项目根目录下的 .planning）
const WORKSPACE_ROOT = '.planning';  // {项目根目录}/.planning/{任务名称}/

// 技能目录路径（agent-teams 目录）
const SKILL_DIR = path.resolve(__dirname, '..', '..');
const THEORIES_DIR = path.join(SKILL_DIR, 'theories');
const THEORIES_README = path.join(THEORIES_DIR, 'README.md');

/**
 * 获取项目根目录（通过 git 命令）
 */
function detectProjectRoot() {
  try {
    const gitRoot = execSync('git rev-parse --show-toplevel', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();
    return gitRoot;
  } catch {
    return process.cwd();
  }
}

/**
 * 获取路径配置
 *
 * 所有产出物统一放在 .planning 目录下：
 * .planning/
 *   {taskName}/
 *     docs/      - 文档
 *     reports/   - 报告
 *
 * @param {string} baseDir - 项目根目录
 * @param {string} taskName - 任务名称
 */
function getPaths(baseDir, taskName = '') {
  const workspaceDir = path.join(baseDir, WORKSPACE_ROOT);

  const taskDir = taskName
    ? path.join(workspaceDir, sanitizeDirName(taskName))
    : workspaceDir;

  return {
    workspace: workspaceDir,
    taskDir,
    docs: path.join(taskDir, 'docs'),
    reports: path.join(taskDir, 'reports')
  };
}

/**
 * 清理目录名称
 */
function sanitizeDirName(name) {
  if (!name) return 'task';
  return name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^\w\u4e00-\u9fa5\-_]/g, '')
    .slice(0, 50);
}

module.exports = {
  WORKSPACE_ROOT,
  getPaths,
  sanitizeDirName,
  detectProjectRoot,
  // 理论路径（供 AI 动态查询）
  SKILL_DIR,
  THEORIES_DIR,
  THEORIES_README
};