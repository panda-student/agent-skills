// 统一用户目录：所有 app 的配置与凭据都收在 ~/.auth-center/apps/<app>/
//   config.json          token 缓存 + 业务 CLI 自己的连接配置
//   sso-credentials.json 仅历史遗留（已停用；密码统一由 vault 管理）
// 可用 AUTH_CENTER_HOME 覆盖根目录。
import { existsSync, mkdirSync, renameSync, copyFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

export const APP_HOME = process.env.AUTH_CENTER_HOME
  || process.env.UNIFIED_AUTH_HOME
  || process.env.JOMOO_AUTH_HOME
  || join(homedir(), '.auth-center');
export const APPS_DIR = join(APP_HOME, 'apps');

export function appDir(appName) {
  return join(APPS_DIR, appName);
}

export function configFilePath(appName) {
  return join(appDir(appName), 'config.json');
}

export function credentialsFilePath(appName) {
  return join(appDir(appName), 'sso-credentials.json');
}

/** 旧路径：~/.<app>/<fileName> */
export function legacyPath(appName, fileName) {
  return join(homedir(), '.' + appName, fileName);
}

/**
 * 一次性迁移旧路径 → 新路径；目标已存在不覆盖。
 * 返回最终路径（无论是否迁移）。
 */
export function ensureAppFile(appName, fileName) {
  const target = join(appDir(appName), fileName);
  const legacy = legacyPath(appName, fileName);
  if (!existsSync(target) && existsSync(legacy)) {
    mkdirSync(dirname(target), { recursive: true });
    try {
      renameSync(legacy, target);
    } catch {
      // 跨盘/并发/文件被占用：退回复制；目标已存在说明别的进程已迁移
      if (!existsSync(target)) {
        try {
          copyFileSync(legacy, target);
          try { unlinkSync(legacy); } catch { /* 旧文件残留不影响读取 */ }
        } catch {
          return existsSync(legacy) ? legacy : target;
        }
      }
    }
  }
  return target;
}