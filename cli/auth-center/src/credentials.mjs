// 执行层：SSO 凭据存取。
// 密码唯一权威来源是 vault（操作见 vault-ops 技能）：本模块运行时按 app → 条目映射取用，
// 不再把密码写入 sso-credentials.json；浏览器自身保存的登录态不在此模块范围内。
//
// 映射写在 ~/.auth-center/apps/<app>/config.json 的 vault 字段：
//   { "vault": { "entryId": "<id>", "groupId": "default", "field": "password" } }
//   { "vault": { "query": "zentao", "title": "禅道账号" } }
//   多环境：{ "vault": { "uat": { "query": "ibpm", "title": "IBPM 平台 Web 登录" } } }
// 未配置映射时，默认按 app 名去掉 -cli 作为检索词。
import { spawnSync } from 'node:child_process';
import { readFileSync, unlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { ensureAppFile, credentialsFilePath } from './paths.mjs';
import { loadAppConfig } from './config-store.mjs';

export { credentialsFilePath };

const DEFAULT_FIELD = 'password';
const VAULT_TIMEOUT_MS = 120_000;

function vaultCli() {
  return process.env.AUTH_CENTER_VAULT_CLI || 'vault';
}

/** Windows 下通过 cmd.exe 解析 .cmd shim；仅对含空白/特殊字符的参数加引号 */
function quoteWinArg(arg) {
  const s = String(arg);
  return /[\s"&|<>^]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function runVault(args) {
  // Windows 下优先直接用 node 执行 vault-cli 脚本，避免 cmd.exe / PowerShell 子进程弹出控制台窗口
  const nodeExe = process.execPath;
  const vaultScript = join(dirname(nodeExe), 'node_modules', 'vault-cli', 'bin', 'vault.js');
  if (existsSync(vaultScript)) {
    return spawnSync(nodeExe, [vaultScript, ...args], {
      encoding: 'utf8', timeout: VAULT_TIMEOUT_MS, windowsHide: true,
    });
  }
  const cli = vaultCli();
  if (process.platform === 'win32') {
    const line = [cli, ...args].map(quoteWinArg).join(' ');
    return spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', line], {
      encoding: 'utf8', timeout: VAULT_TIMEOUT_MS, windowsHide: true,
    });
  }
  return spawnSync(cli, args, { encoding: 'utf8', timeout: VAULT_TIMEOUT_MS });
}

function vaultError(action, result) {
  const detail = (result.stderr || result.stdout || '').trim().split('\n')[0];
  const hint = result.error && result.error.code === 'ENOENT'
    ? 'vault CLI 不可用，请先安装（操作见 vault-ops 技能）'
    : detail || '未知错误';
  return new Error(`vault ${action} 失败：${hint}`);
}

function parseVaultJson(result, action) {
  const text = (result.stdout || '').trim();
  try { return JSON.parse(text); }
  catch { throw new Error(`vault ${action} 返回无法解析：${text.slice(0, 160)}`); }
}

function resolveMapping(appName, env) {
  const vault = loadAppConfig(appName).vault;
  if (!vault || typeof vault !== 'object' || Array.isArray(vault)) return {};
  if (env && vault[env] && typeof vault[env] === 'object' && !Array.isArray(vault[env])) return vault[env];
  return vault;
}

function resolveEntry(mapping, appName) {
  if (mapping.entryId) {
    const result = runVault(['get', String(mapping.entryId)]);
    if (result.status !== 0) throw vaultError('get', result);
    const data = parseVaultJson(result, 'get');
    const entry = data && data.results && data.results[0];
    if (!entry || !entry.id) throw new Error(`vault 中找不到条目 ${mapping.entryId}`);
    return entry;
  }

  const query = mapping.query || appName.replace(/-cli$/, '');
  const result = runVault(['search', String(query)]);
  if (result.status !== 0) throw vaultError('search', result);
  const data = parseVaultJson(result, 'search');
  const entries = (data && data.results && data.results[0] && data.results[0].entries) || [];
  const candidates = entries.filter((e) => (e.groups || []).some((g) => g.hasPassword));
  const filtered = mapping.title
    ? candidates.filter((e) => String(e.title || '').includes(String(mapping.title)))
    : candidates;

  if (!filtered.length) {
    throw new Error(`vault 中未找到 ${appName} 的密码条目（检索词：${query}），请先在 vault 中登记（操作见 vault-ops 技能）`);
  }
  if (filtered.length > 1) {
    const names = filtered.map((e) => e.title || e.id).join('、');
    throw new Error(`vault 中 ${appName} 的密码条目不唯一（${names}），请在 config.json 的 vault 映射中指定 entryId 或 title`);
  }
  return filtered[0];
}

function pickGroup(entry, mapping) {
  const groups = (entry.groups || []).filter((g) => g.hasPassword);
  if (!groups.length) throw new Error(`vault 条目「${entry.title || entry.id}」没有密码`);
  if (mapping.groupId) {
    const group = groups.find((g) => g.id === mapping.groupId);
    if (!group) throw new Error(`vault 条目「${entry.title || entry.id}」中找不到凭据组 ${mapping.groupId}`);
    return group;
  }
  if (mapping.environment !== undefined) {
    const group = groups.find((g) => (g.environment || '') === mapping.environment);
    if (!group) throw new Error(`vault 条目「${entry.title || entry.id}」中找不到环境 ${mapping.environment}`);
    return group;
  }
  if (groups.length === 1) return groups[0];
  throw new Error(`vault 条目「${entry.title || entry.id}」有多个密码凭据组，请在 config.json 的 vault 映射中指定 groupId 或 environment`);
}

/** 把密码注入临时文件后读取并立即删除；密码不落常驻文件 */
function readSecret(entry, group, field) {
  const path = join(
    tmpdir(),
    `auth-center-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.txt`,
  );
  try {
    const result = runVault([
      'fill', String(entry.id),
      '--field', field || DEFAULT_FIELD,
      '--file', path,
      '--group', String(group.id),
      '--mode', 'create',
    ]);
    if (result.status !== 0) throw vaultError('fill', result);
    const secret = readFileSync(path, 'utf8').trim();
    if (!secret) throw new Error('vault 注入的密码为空');
    return secret;
  } finally {
    try { unlinkSync(path); } catch { /* 文件未创建或已删除 */ }
  }
}

/**
 * 读取凭据 { account, password }。密码从 vault 运行时取用。
 * @param {string} appName
 * @param {{env?: string}} [options]
 */
export function loadCredentials(appName, { env } = {}) {
  const mapping = resolveMapping(appName, env);
  const entry = resolveEntry(mapping, appName);
  const group = pickGroup(entry, mapping);
  const cfg = loadAppConfig(appName);
  const account = group.account
    || (env && cfg.envs && cfg.envs[env] && cfg.envs[env].account)
    || (cfg.auth && cfg.auth.account)
    || cfg.account;
  if (!account) {
    throw new Error(`vault 条目「${entry.title || entry.id}」未提供账号，且 app 配置中无 account`);
  }
  return { account, password: readSecret(entry, group, mapping.field) };
}

/** 密码不再落盘：请在 vault 中维护（操作见 vault-ops 技能） */
export function saveCredentials() {
  throw new Error('密码不再落盘：请在 vault 中新增/更新条目（操作见 vault-ops 技能）');
}

/** 清理历史遗留的 sso-credentials.json（迁移用，不再写入新凭据） */
export function clearCredentials(appName) {
  try { unlinkSync(ensureAppFile(appName, 'sso-credentials.json')); } catch { /* 文件不存在 */ }
}

/** 弹窗录入已停用：密码统一由 vault 管理 */
export function promptAndSaveCredentials() {
  throw new Error('凭据录入已停用：请在 vault 中新增/更新条目后重试（操作见 vault-ops 技能）');
}