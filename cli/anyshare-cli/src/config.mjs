// 配置层：~/.auth-center/apps/anyshare-cli/config.json（token 明文落盘，个人机使用，勿提交 git）
// 结构：{ token, tokenSavedAt, tokenSource, subscriberId }
// 文件读写下沉到 auth-center，本文件只承载 anyshare 的配置结构语义
import { saveAppConfig, loadAppConfig, configFilePath as coreConfigFilePath } from 'auth-center';

const APP = 'anyshare-cli';

export function loadConfig() {
  return loadAppConfig(APP);
}

export function saveConfig(cfg) {
  saveAppConfig(APP, cfg);
}

export function saveToken(token, source) {
  const cfg = loadConfig();
  cfg.token = token;
  cfg.tokenSavedAt = new Date().toISOString();
  cfg.tokenSource = source;
  saveConfig(cfg);
}

export function clearToken() {
  const cfg = loadConfig();
  delete cfg.token;
  delete cfg.tokenSavedAt;
  delete cfg.tokenSource;
  saveConfig(cfg);
}

/** 默认进入目录（gns:// id）：ls 不带路径、dir 查看时使用 */
export function getDefaultDir() {
  return loadConfig().default_dir || '';
}

export function setDefaultDir(gnsId) {
  const cfg = loadConfig();
  cfg.default_dir = gnsId;
  saveConfig(cfg);
}

export function configFilePath() {
  return coreConfigFilePath(APP);
}
