// 执行层：Edge leveldb 机会扫描。
// 从日常 Edge 各 Profile 的 Local Storage leveldb 中捞 token 候选（ory_at 前缀 +
// Authorization Bearer 形态），无需唤起浏览器。文件可能被运行中的 Edge 锁定，先拷贝再扫。
import { createReadStream, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { createWriteStream } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { pipeline } from 'node:stream/promises';

const ORY_TOKEN_RE = /ory_at_[A-Za-z0-9\-_]+/g;
const BEARER_TOKEN_RE = /Authorization[=:\s"']{1,4}Bearer\s+([A-Za-z0-9\-._~+/]+=*)/gi;

function edgeUserDataDir() {
  for (const root of [
    join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'User Data'),
    join(process.env.ProgramFiles || '', 'Microsoft', 'Edge', 'Application'),
  ]) {
    if (root && existsSync(root)) return root;
  }
  return null;
}

/** 枚举所有 Profile 的 Local Storage leveldb 目录 */
function listLeveldbDirs() {
  const userData = edgeUserDataDir();
  if (!userData) return [];
  const dirs = [];
  for (const entry of readdirSync(userData, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name !== 'Default' && !/^Profile \d+$/.test(entry.name)) continue;
    const leveldb = join(userData, entry.name, 'Local Storage', 'leveldb');
    if (existsSync(leveldb)) dirs.push(leveldb);
  }
  return dirs;
}

/** 扫描单个 leveldb 目录，返回 token 候选数组（去重） */
async function scanLeveldbDir(dir) {
  const candidates = new Set();
  for (const name of readdirSync(dir)) {
    if (!/\.(log|ldb)$/.test(name)) continue;
    const source = join(dir, name);
    let chunk;
    try {
      // 先整体读入（leveldb 文件通常几 MB～几十 MB），锁定文件读失败则跳过
      const tmp = join(tmpdir(), `auth-scan-${process.pid}-${name}`);
      mkdirSync(dirname(tmp), { recursive: true });
      await pipeline(createReadStream(source), createWriteStream(tmp));
      chunk = tmp;
    } catch {
      continue;
    }
    try {
      const { readFileSync, unlinkSync } = await import('node:fs');
      const bytes = readFileSync(chunk);
      for (const match of bytes.toString('latin1').matchAll(ORY_TOKEN_RE)) {
        candidates.add(match[0]);
      }
      for (const match of bytes.toString('latin1').matchAll(BEARER_TOKEN_RE)) {
        candidates.add(match[1]);
      }
    } finally {
      try { rmSync(chunk, { force: true }); } catch { /* 临时文件清理失败可忽略 */ }
    }
  }
  return [...candidates];
}

/** 全量扫描 Edge leveldb，返回 token 候选数组。异常静默返回空数组 */
export async function scanEdgeTokens() {
  const candidates = [];
  try {
    for (const dir of listLeveldbDirs()) {
      candidates.push(...await scanLeveldbDir(dir));
    }
  } catch {
    return [];
  }
  return [...new Set(candidates)];
}
