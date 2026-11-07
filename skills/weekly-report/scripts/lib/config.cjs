/**
 * 统一配置与路径解析（技能自包含）
 *
 * 配置查找顺序（命中即用）：
 *   1) 环境变量（调用方显式指定，便于换机器/换项目）
 *   2) <技能根>/config/<文件名>     ← 技能自带配置（推荐，随技能迁移）
 *   3) <项目根>/.config/<文件名>     ← 兼容项目内旧位置
 *
 * 项目根探测：从 cwd 向上，
 *   ① docs + (.agents|.claude) 工作区标记（取最外层，子仓库内执行也能归位）
 *   ② .git 版本库根
 *   找不到返回 null，调用方自行兜底（不猜当前目录）。
 */
const fs = require('fs');
const path = require('path');

const SKILL_ROOT = path.resolve(__dirname, '..', '..');

function findProjectRoot(start) {
    let probe = path.resolve(start || process.cwd());
    let gitRoot = null;
    for (;;) {
        if (fs.existsSync(path.join(probe, 'docs')) &&
            (fs.existsSync(path.join(probe, '.agents')) || fs.existsSync(path.join(probe, '.claude')))) {
            return probe;
        }
        if (!gitRoot && fs.existsSync(path.join(probe, '.git'))) gitRoot = probe;
        const parent = path.dirname(probe);
        if (parent === probe) return gitRoot;
        probe = parent;
    }
}

function configCandidates(fileName, envVar) {
    const out = [];
    if (envVar && process.env[envVar]) out.push(process.env[envVar]);
    out.push(path.join(SKILL_ROOT, 'config', fileName));
    const root = findProjectRoot();
    if (root) out.push(path.join(root, '.config', fileName));
    return out;
}

function resolveConfigPath(fileName, envVar) {
    const candidates = configCandidates(fileName, envVar);
    for (const p of candidates) if (fs.existsSync(p)) return p;
    throw new Error(`${fileName} 未找到。已查找：\n  ${candidates.join('\n  ')}\n` +
        `请执行 setup：把配置放到 ${path.join(SKILL_ROOT, 'config', fileName)}，或用环境变量 ${envVar || '<ENV>'} 指定`);
}

function loadConfig(fileName, envVar) {
    return JSON.parse(fs.readFileSync(resolveConfigPath(fileName, envVar), 'utf8'));
}

/**
 * 校验密钥已由 vault 注入。配置文件里保留 {{credential}} 占位符，
 * 运行时由 AI 用 vault 的 write_credential 填充（AI 不接触明文）。
 */
function requireSecret(value, label) {
    if (!value || String(value).includes('{{credential}}')) {
        throw new Error(`${label} 未注入。请先用 vault 的 write_credential 填充配置（流程见 SKILL.md「凭据注入」），不要手写明文`);
    }
    return value;
}

module.exports = { SKILL_ROOT, findProjectRoot, resolveConfigPath, loadConfig, requireSecret };