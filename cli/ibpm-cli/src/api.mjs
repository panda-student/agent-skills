// IBPM API 封装：统一鉴权守卫 + 查/导接口（全部为已实测验证的路径）
import { tokenStatus } from './config.mjs';

function fmtRemain(sec) {
  if (sec >= 86400) return `${Math.floor(sec / 86400)} 天`;
  if (sec >= 3600) return `${Math.floor(sec / 3600)} 小时`;
  return `${Math.floor(sec / 60)} 分钟`;
}

/** 鉴权守卫：token 缺失/过期时给出登录指引后退出（exit code 2 = 需要登录） */
export function ensureAuth(envName) {
  const st = tokenStatus(envName);
  if (st.state === 'valid') return st.env;
  const why = st.state === 'missing' ? '尚未登录'
    : st.state === 'expired' ? `token 已过期 ${fmtRemain(-st.remain)}`
      : 'token 无法解析';
  console.error(`✗ ${why}（环境: ${envName}）。请执行: ibpm login --env ${envName}`);
  process.exit(2);
}

export async function api(env, path, { method = 'GET', body, form } = {}) {
  const url = env.baseUrl + env.bpmModel + path;
  const headers = { Authorization: `Bearer ${env.token}` };
  let payload;
  if (form) {
    payload = form; // FormData（Node 18+ 原生）
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(url, { method, headers, body: payload });
  if (res.status === 401) {
    console.error('✗ 认证失败(401)：token 已失效。请执行: ibpm login');
    process.exit(2);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status} ${path}: ${text.slice(0, 300)}`);
  }
  return res;
}

/** 流程定义列表：querys 过滤协议（实测 page/rows 参数被服务端忽略，固定 10/页，必须靠 querys 缩小范围）
 *  有 keyword → defKey/name 双 LIKE；无 keyword → 按环境分类名过滤 */
export async function listDefs(env, keyword = '') {
  const querys = keyword
    ? [
        { group: 'main', operation: 'LIKE', property: 'defKey', relation: 'OR', value: keyword },
        { group: 'main', operation: 'LIKE', property: 'name', relation: 'OR', value: keyword },
      ]
    : [{ group: 'main', operation: 'LIKE', property: 'typeName', relation: 'AND', value: (env.typeName || '').split('_')[0] }];
  const res = await api(env, '/flow/def/v1/listJson', {
    method: 'POST',
    body: { querys },
  });
  const data = await res.json();
  return data.rows || [];
}

/** 导出流程 zip → Buffer */
export async function exportZip(env, defId) {
  const res = await api(env, `/flow/def/v1/exportXml?bpmDefId=${defId}`);
  return Buffer.from(await res.arrayBuffer());
}

/** 单个流程定义信息 */
export async function defGet(env, defId) {
  const res = await api(env, `/flow/def/v1/defGet?defId=${defId}`);
  const data = await res.json();
  return data.value || data;
}
