// 跨进程互斥锁：同一个应用的 token 刷新（尤其是会打开浏览器的 CDP 段）同一时刻只允许一个进程执行。
// 语义：
//   1) 抢到锁的进程负责真正刷新，刷新结束后（成功/失败）释放；
//   2) 没抢到的进程只等结果（轮询配置里出现可用 token），不再各自开浏览器；
//   3) 持锁进程已退出（pid 不存在）或持锁超龄 → 视为僵死锁，原子摘除后重抢。
// 动机（2026-11-07 实测）：sync 按目录起多个进程 + 单进程内 4 路并发下载，
// 每个 401 都独立走完刷新链 → 每层各 spawn 一个 Edge → 一次弹出一堆登录窗口。
import {
  closeSync, existsSync, linkSync, mkdirSync, openSync, readFileSync,
  renameSync, statSync, unlinkSync, writeFileSync, writeSync,
} from 'node:fs';
import { dirname } from 'node:path';
import crypto from 'node:crypto';

function isPidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM'; // 进程存在但当前用户无信号权限
  }
}

export function createRefreshLock(lockPath) {
  // 持有者标识：释放时先校验，避免误删「僵死锁被摘除后别人抢到的新锁」
  const ownerId = `${process.pid}-${crypto.randomBytes(6).toString('hex')}`;
  const tempPath = `${lockPath}.${ownerId}.tmp`;

  function exists() {
    return existsSync(lockPath);
  }

  function readHolder() {
    try {
      return JSON.parse(readFileSync(lockPath, 'utf8'));
    } catch {
      return null;
    }
  }

  /** 原子抢锁：先写临时文件再硬链接落位，成功返回 true，已被占用返回 false */
  function tryAcquire() {
    mkdirSync(dirname(lockPath), { recursive: true });
    const record = JSON.stringify({ pid: process.pid, ownerId, startedAt: new Date().toISOString() });
    try {
      writeFileSync(tempPath, record, 'utf8');
      try {
        linkSync(tempPath, lockPath); // 原子：已存在则 EEXIST，且不会出现「空锁文件」窗口
        return true;
      } catch (error) {
        if (error.code === 'EEXIST') return false;
        // 极少数文件系统不支持硬链接：退回 O_EXCL 创建（空文件窗口由 isStale 的 mtime 兜底）
        const fd = openSync(lockPath, 'wx');
        try {
          writeSync(fd, record);
        } finally {
          closeSync(fd);
        }
        return true;
      } finally {
        try { unlinkSync(tempPath); } catch { /* 临时文件已清理 */ }
      }
    } catch (error) {
      if (error.code === 'EEXIST') return false;
      throw error;
    }
  }

  /** 僵死锁判定：持有者进程已退出，或持锁时间超过 maxAgeMs；内容暂不可读时按文件年龄兜底 */
  function isStale(maxAgeMs) {
    let stat;
    try {
      stat = statSync(lockPath);
    } catch {
      return true;
    }
    const holder = readHolder();
    if (!holder) {
      // 另一进程刚创建、还没写完（窗口极短）：只有存在超过 5 秒才当僵死
      return Date.now() - stat.mtimeMs > 5_000;
    }
    if (!isPidAlive(holder.pid)) return true;
    const startedAt = new Date(holder.startedAt).getTime();
    return Number.isFinite(startedAt) && Date.now() - startedAt > maxAgeMs;
  }

  /** 释放：只删自己的锁（ownerId 不匹配说明锁已被摘除并换人，不能动） */
  function release() {
    const holder = readHolder();
    if (holder && holder.ownerId && holder.ownerId !== ownerId) return false;
    try {
      unlinkSync(lockPath);
      return true;
    } catch {
      return false;
    }
  }

  /** 原子摘除僵死锁：rename 到唯一名再删除，避免误删别人随后抢到的新锁 */
  function removeStale() {
    const trash = `${lockPath}.stale-${ownerId}`;
    try {
      renameSync(lockPath, trash);
    } catch {
      return false; // 别人先摘除或已释放
    }
    try { unlinkSync(trash); } catch { /* 尽力清理 */ }
    return true;
  }

  return { exists, readHolder, tryAcquire, isStale, release, removeStale };
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}