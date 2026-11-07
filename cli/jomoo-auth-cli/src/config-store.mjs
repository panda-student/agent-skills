// 配置层：~/.<appName>/config.json 读写唯一定义。
// token 明文落盘（个人机使用，目录勿提交 git）；业务 CLI 只承载各自配置结构语义。
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

/** 应用配置文件绝对路径：~/.<appName>/config.json */
export function configFilePath(appName) {
  return join(homedir(), '.' + appName, 'config.json');
}

/** 读取应用配置。文件不存在或解析失败返回空对象（坏文件视为无配置） */
export function loadAppConfig(appName) {
  const path = configFilePath(appName);
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return {};
  }
}

/** 写入应用配置（目录不存在自动创建，整体覆盖） */
export function saveAppConfig(appName, config) {
  const path = configFilePath(appName);
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, JSON.stringify(config, null, 2), 'utf8');
}
