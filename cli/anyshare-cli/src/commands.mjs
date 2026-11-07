// 命令实现层：whoami / libs / ls / dir / download / sync / token / login / cred-setup（薄：仅编排输出，业务判定在 client/auth 层）
import { loadConfig, saveToken, clearToken, configFilePath, getDefaultDir, setDefaultDir } from './config.mjs';
import { currentToken, validateToken, login, refreshToken } from './auth.mjs';
import { listDocLibs, listSubObjectsAll, fileMetadata, downloadFile } from './client.mjs';
import { BASE_URL, ENDPOINTS } from './endpoints.mjs';
import { ssoSetup, hasSsoCredentials } from './headless-sso.mjs';

/** sync 并行下载并发数：过大会触发服务端限流，4 为实测稳妥值 */
const SYNC_CONCURRENCY = 4;

/** sync 默认跳过的云端子目录：需求规格书各目录下的「历史版本」存旧版文件，同步最新版时无需遍历下载 */
const SYNC_SKIPPED_DIR_NAMES = ['历史版本'];

function fmtSize(n) {
  if (n == null || n < 0) return '-';
  if (n >= 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' MB';
  if (n >= 1024) return (n / 1024).toFixed(1) + ' KB';
  return n + ' B';
}

/** 服务端时间为 UTC ISO 串，统一转本地时区显示，避免与本地文件时间比对时差 8 小时误判新旧 */
function fmtDate(iso) {
  if (!iso) return '-';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 16).replace('T', ' ');
  const pad = (num) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** whoami：token 试活 + 状态报告 */
export async function cmdWhoami() {
  const cfg = loadConfig();
  const token = currentToken();
  if (!token) {
    console.log('✗ 尚未登录（配置无 token）。请执行: anyshare login');
    process.exit(2);
  }
  const ok = await validateToken(token);
  console.log(`token:     ${token.slice(0, 24)}...${token.slice(-8)}`);
  console.log(`状态:      ${ok ? '有效' : '失效（执行命令时会自动走刷新链换新号）'}`);
  console.log(`来源:      ${cfg.tokenSource || '?'}`);
  console.log(`保存时间:  ${cfg.tokenSavedAt ? fmtDate(cfg.tokenSavedAt) : '?'}`);
  console.log(`SSO 凭据:  ${hasSsoCredentials() ? '已配置（无头刷新可用）' : '未配置（刷新走浏览器静默回路）'}`);
  console.log(`配置文件:  ${configFilePath()}`);
}

/** libs：文档库列表 */
export async function cmdLibs() {
  const libs = await listDocLibs();
  for (const lib of libs) {
    console.log(`${lib.name}\t${lib.type}\t${lib.id}`);
  }
}

/** ls [路径]：列目录。路径支持 gns:// 或 "文档库名/子目录/..."；缺省用配置的默认目录 */
export async function cmdLs(pathArg) {
  const gns = await resolveGns(pathArg || getDefaultDir());
  const { dirs, files } = await listSubObjectsAll(gns);
  for (const d of dirs) {
    console.log(`d\t${fmtDate(d.modified_at)}\t${d.name}`);
  }
  for (const f of files) {
    console.log(`f\t${fmtDate(f.modified_at)}\t${fmtSize(f.size)}\t${f.name}\t${f.id}`);
  }
}

/** dir [路径]：查看或设置默认进入目录（写入配置 default_dir，ls 不带路径时生效） */
export async function cmdDir(pathArg) {
  if (!pathArg) {
    const current = getDefaultDir();
    if (!current) {
      console.log('未设置默认目录。设置：anyshare dir <文档库名/子目录 或 gns:// id>');
      return;
    }
    console.log(`默认目录: ${current}`);
    console.log(`网页入口: ${BASE_URL}${ENDPOINTS.webDir(current)}`);
    return;
  }
  const gns = await resolveGns(pathArg);
  setDefaultDir(gns);
  console.log(`✓ 默认目录已保存: ${gns}`);
  console.log(`  网页入口: ${BASE_URL}${ENDPOINTS.webDir(gns)}`);
  console.log(`  之后 anyshare ls 不带路径即列出该目录。`);
}

/** download <路径> [目标]：下载文件。路径支持 gns:// 或 "文档库名/子目录/文件名"；
 *  目标为已存在目录时落到该目录下（用云端文件名），否则视为目标文件路径；缺省落当前目录 */
export async function cmdDownload(pathArg, destArg) {
  if (!pathArg) throw new Error('请指定文件：gns:// id 或 "文档库名/子目录/文件名"');
  const docid = await resolveGns(pathArg);
  const meta = await fileMetadata(docid);
  const destPath = await resolveDownloadDest(destArg, meta.file_name);
  const saved = await downloadFile(docid, destPath);
  console.log(`✓ ${saved.fileName} → ${saved.destPath}（${fmtSize(saved.size)}，已按云端大小校验）`);
}

/** sync <云端路径> <本地目录>：递归同步云端目录到本地。只对比更新时间（云端新于本地才下载，不看大小），
 *  本地多出的文件不删除。--dry-run 仅预览待下载清单，不写入 */
export async function cmdSync(pathArg, localDirArg, opts = {}) {
  if (!pathArg) throw new Error('请指定云端路径：文档库名/子目录 或 gns:// id');
  if (!localDirArg) throw new Error('请指定本地目标目录');
  const { mkdir } = await import('node:fs/promises');
  await mkdir(localDirArg, { recursive: true });
  const stats = { downloaded: 0, skipped: 0 };
  const logs = [];
  await syncCloudDir(await resolveGns(pathArg), localDirArg, opts, logs, stats);
  for (const line of logs) console.log(line);
  console.log(`\n同步完成: 待下载/已下载 ${stats.downloaded}，已是最新 ${stats.skipped}${stats.skippedDirs ? `，跳过历史版本目录 ${stats.skippedDirs}` : ''}${opts.dryRun ? '（dry-run 预览，未实际写入）' : ''}`);
}

/** 递归同步单个云端目录（执行编排：遍历收集下载任务 → 并行池执行；判定规则在 shouldDownload） */
async function syncCloudDir(gns, localDir, opts, logs, stats) {
  const { mkdir } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const downloadTasks = [];
  await collectSyncTasks(gns, localDir, opts, logs, stats, downloadTasks);
  await runPool(downloadTasks, SYNC_CONCURRENCY, async (task) => {
    // 列表接口字段为 name，与元信息接口的 file_name 不同，传入前归一化
    const { name, rev, size, modified_at } = task.cloudFile;
    const saved = await downloadFile(task.cloudFile.id, task.localPath, { file_name: name, rev, size });
    await alignLocalMtimeToCloud(task.localPath, modified_at);
    logs.push(`✓ ${saved.fileName}（${fmtSize(saved.size)}，云端 ${fmtDate(modified_at)}）`);
    stats.downloaded++;
  });
}

/** 遍历云端目录树收集同步任务（本地目录随遍历创建） */
async function collectSyncTasks(gns, localDir, opts, logs, stats, downloadTasks) {
  const { mkdir } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const { dirs, files } = await listSubObjectsAll(gns);
  for (const dir of dirs) {
    if (SYNC_SKIPPED_DIR_NAMES.includes(dir.name)) {
      stats.skippedDirs = (stats.skippedDirs || 0) + 1;
      continue;
    }
    const subLocalDir = join(localDir, dir.name);
    await mkdir(subLocalDir, { recursive: true });
    await collectSyncTasks(dir.id, subLocalDir, opts, logs, stats, downloadTasks);
  }
  for (const cloudFile of files) {
    const localPath = join(localDir, cloudFile.name);
    if (!(await shouldDownload(cloudFile, localPath))) {
      stats.skipped++;
      continue;
    }
    if (opts.dryRun) {
      logs.push(`[预览] ${cloudFile.name}（云端 ${fmtDate(cloudFile.modified_at)}）`);
      stats.downloaded++;
    } else {
      downloadTasks.push({ cloudFile, localPath });
    }
  }
}

/** 固定并发数的任务池：并发执行下载，避免逐个串行等待 */
async function runPool(tasks, concurrency, worker) {
  let nextIndex = 0;
  const runners = Array.from({ length: Math.min(concurrency, tasks.length) }, async () => {
    while (nextIndex < tasks.length) {
      await worker(tasks[nextIndex++]);
    }
  });
  await Promise.all(runners);
}

/** 同步判定（纯决策）：本地不存在 → 下载；云端更新时间晚于本地 mtime → 下载；否则跳过。不看文件大小 */
async function shouldDownload(cloudFile, localPath) {
  const { stat } = await import('node:fs/promises');
  try {
    const localInfo = await stat(localPath);
    return new Date(cloudFile.modified_at).getTime() > localInfo.mtimeMs;
  } catch {
    return true; // 本地不存在 → 下载
  }
}

/** 下载后把本地 mtime 对齐云端更新时间：保证下次按时间比对的正确性（含云端回退旧版本场景） */
async function alignLocalMtimeToCloud(localPath, isoTime) {
  const { utimes } = await import('node:fs/promises');
  const cloudTime = new Date(isoTime);
  if (!Number.isNaN(cloudTime.getTime())) {
    await utimes(localPath, new Date(), cloudTime);
  }
}

/** 下载目标判定（纯决策）：已存在目录 → 目录/云端文件名；否则 → 原样作为文件路径；缺省 → 当前目录/云端文件名 */
async function resolveDownloadDest(destArg, cloudFileName) {
  const { stat } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const { cwd } = await import('node:process');
  if (!destArg) return join(cwd(), cloudFileName);
  try {
    const info = await stat(destArg);
    if (info.isDirectory()) return join(destArg, cloudFileName);
  } catch { /* 目标不存在 → 视为文件路径 */ }
  return destArg;
}

/** 路径 → gns:// id 解析（业务判定：库名/目录名逐级匹配，末段允许命中文件，供下载使用） */
async function resolveGns(pathArg) {
  if (!pathArg) throw new Error('请指定路径：文档库名 或 "文档库名/子目录"，或 gns:// id');
  if (pathArg.startsWith('gns://')) return pathArg;
  const segs = pathArg.split('/').filter(Boolean);
  const libs = await listDocLibs();
  const lib = libs.find((l) => l.name === segs[0])
    || libs.find((l) => l.name.includes(segs[0]));
  if (!lib) {
    throw new Error(`文档库不存在: ${segs[0]}。可用库执行 anyshare libs 查看。`);
  }
  let gns = lib.id;
  for (let i = 1; i < segs.length; i++) {
    const seg = segs[i];
    const isLast = i === segs.length - 1;
    const { dirs, files } = await listSubObjectsAll(gns);
    const hit = dirs.find((d) => d.name === seg) || dirs.find((d) => d.name.includes(seg))
      || (isLast && (files.find((f) => f.name === seg) || files.find((f) => f.name.includes(seg))));
    if (!hit) throw new Error(`路径不存在: ${seg}（在 ${gns} 下）`);
    gns = hit.id;
  }
  return gns;
}

/** token：输出当前 token（供 curl 复用）；--refresh 强制走刷新链 */
export async function cmdToken(opts = {}) {
  let token;
  if (opts.refresh) {
    token = await refreshToken();
  } else {
    token = currentToken();
    if (!token) token = await refreshToken();
  }
  console.log(token);
}

/** login：登录/换号（无头优先 → 浏览器捕获） */
export async function cmdLogin() {
  const token = await login();
  console.log(`✓ 登录成功，token 已保存: ${token.slice(0, 24)}...`);
  console.log('  执行 anyshare whoami 查看状态。');
}

/** cred-setup：SSO 凭据一次性弹窗录入 */
export async function cmdCredSetup() {
  const token = await ssoSetup();
  if (token) {
    saveToken(token, 'headless-sso');
    console.log('✓ token 已保存到 ' + configFilePath());
  }
}

/** logout：清除本地 token */
export function cmdLogout() {
  clearToken();
  console.log('✓ 已清除本地 token（' + configFilePath() + '）。SSO 凭据保留。');
}
