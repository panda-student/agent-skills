// 执行层：统一 HTTP 请求（Bearer 认证 + 401 自动刷新重试一次）
import { BASE_URL, ENDPOINTS } from './endpoints.mjs';
import { currentToken, refreshToken } from './auth.mjs';

async function rawRequest(pathOrUrl, token, { method = 'GET', body } = {}) {
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : BASE_URL + pathOrUrl;
  const headers = { Authorization: `Bearer ${token}` };
  let payload;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(url, { method, headers, body: payload });
  if (res.status === 401) {
    const err = new Error('401');
    err.isAuthError = true;
    throw err;
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status} ${url}: ${text.slice(0, 300)}`);
  }
  return res;
}

/** 带自动刷新的请求：当前 token 401 → 走刷新链换新号 → 重试一次 */
export async function request(path, opts = {}) {
  const token = currentToken();
  if (!token) return rawRequest(path, await refreshToken(), opts);
  try {
    return await rawRequest(path, token, opts);
  } catch (e) {
    if (!e.isAuthError) throw e;
    return rawRequest(path, await refreshToken({ oldToken: token }), opts);
  }
}

export async function requestJson(path, opts = {}) {
  const res = await request(path, opts);
  return res.json();
}

// ---------- API 封装（已实测验证的路径） ----------

/** 文档库列表：[{ id: "gns://...", name, type, ... }] */
export async function listDocLibs() {
  return requestJson(ENDPOINTS.docLibList);
}

/** 子对象列表（自动翻页聚合）：{ dirs: [...], files: [...] } */
export async function listSubObjectsAll(gnsId) {
  const dirs = [];
  const files = [];
  let marker = '';
  for (let page = 0; page < 100; page++) {
    const data = await requestJson(ENDPOINTS.subObjects(gnsId, { marker }));
    dirs.push(...(data.dirs || []));
    files.push(...(data.files || []));
    marker = data.next_marker || '';
    if (!marker) break;
  }
  return { dirs, files };
}

/** 文件元信息：{ rev, file_name, size, docid, ... } */
export async function fileMetadata(docid) {
  return requestJson(ENDPOINTS.fileMetadata, { method: 'POST', body: { docid } });
}

/** 下载签名：authrequest = [方法, 签名URL, AWS Authorization 头, x-amz-date 头] */
export async function fileOsDownload({ docid, savename, rev }) {
  // osdownload 接口要求所有字段均为字符串类型，传数字会报「参数不合法」
  const body = { docid, authtype: '0', savename, usehttps: '1', rev };
  const data = await requestJson(ENDPOINTS.fileOsDownload, { method: 'POST', body });
  if (!Array.isArray(data.authrequest) || data.authrequest.length < 4) {
    throw new Error(`osdownload 返回异常: ${JSON.stringify(data).slice(0, 300)}`);
  }
  return data.authrequest;
}

/** 下载文件到本地路径（写入后按元信息 size 校验完整性）。
 *  knownMeta：可选，调用方已从列表接口拿到 { file_name, rev, size } 时传入，跳过 metadata 探测省一次请求 */
export async function downloadFile(docid, destPath, knownMeta = null) {
  const meta = knownMeta || await fileMetadata(docid);
  const [method, signedUrl, authHeader, dateHeader] = await fileOsDownload({
    docid,
    savename: meta.file_name,
    rev: meta.rev,
  });
  if (method !== 'GET') throw new Error(`未知下载方法: ${method}`);
  const headers = Object.fromEntries([authHeader, dateHeader].map((line) => {
    const sep = line.indexOf(':');
    return [line.slice(0, sep).trim(), line.slice(sep + 1).trim()];
  }));
  const res = await fetch(signedUrl, { headers });
  if (!res.ok) throw new Error(`签名下载失败 HTTP ${res.status}: ${signedUrl}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const { writeFile } = await import('node:fs/promises');
  await writeFile(destPath, buffer);
  if (buffer.length !== meta.size) {
    throw new Error(`文件大小不一致: 本地 ${buffer.length} / 云端 ${meta.size}（${destPath}）`);
  }
  return { fileName: meta.file_name, size: meta.size, destPath };
}
