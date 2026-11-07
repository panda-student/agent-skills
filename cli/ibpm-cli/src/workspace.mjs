// 编辑工作区：checkout（导出解包到 ~/.ibpm-cli/workspace/<env>/<defKey>/）→ 编辑 → verify → import
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { homedir } from 'node:os';

export const wsRoot = (envName = 'uat') => join(homedir(), '.ibpm-cli', 'workspace', envName);
export const wsDir = (defKey, envName = 'uat') => join(wsRoot(envName), defKey);

export function checkout(env, def, buf) {
  const dir = wsDir(def.defKey, env.name);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const zip = join(dir, '_origin.zip');
  writeFileSync(zip, buf);
  execSync(`tar -xf "${zip}" -C "${dir}"`, { stdio: 'pipe' });
  rmSync(zip, { force: true });
  const flowDir = join(dir, readdirSync(dir)[0]);
  const info = { defKey: def.defKey, defId: def.defId, version: def.version, checkedOutAt: new Date().toISOString(), env: env.name };
  writeFileSync(join(dir, '_ws.json'), JSON.stringify(info, null, 2), 'utf8');
  return { dir, flowDir, info };
}

export function loadWorkspace(defKey, envName = 'uat') {
  const dir = wsDir(defKey, envName);
  if (!existsSync(join(dir, '_ws.json'))) return null;
  return { dir, info: JSON.parse(readFileSync(join(dir, '_ws.json'), 'utf8')) };
}

export function flowDirOf(ws) {
  return join(ws.dir, readdirSync(ws.dir).find(d => !d.startsWith('_')));
}

export function discard(defKey, envName = 'uat') {
  const dir = wsDir(defKey, envName);
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
}

/** 打包工作区 → zip（tar 正斜杠条目；Compress-Archive 反斜杠会被宏天拒绝） */
export function pack(ws) {
  const flowDir = flowDirOf(ws);
  const folder = flowDir.split(/[\\/]/).pop();
  const out = join(ws.dir, '_pack.zip');
  rmSync(out, { force: true });
  execSync(`tar -a -cf "${out}" -C "${ws.dir}" "${folder}"`, { stdio: 'pipe' });
  return out;
}
