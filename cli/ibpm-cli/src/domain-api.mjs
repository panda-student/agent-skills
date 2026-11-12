// 流程定义域查询接口统一封装（hot/cfg/defcontext/direct 共用）
import { api } from './api.mjs';

export const jsonOf = async (env, path, opts) => (await api(env, path, opts)).json();

/** 写接口：POST/DELETE 并解析 JSON 响应（401 统一由 api.mjs 处理） */
export async function writeJson(env, path, body, method = 'POST') {
  const res = await api(env, path, { method, body });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
}

export const getDefSetting = async (env, defId) => {
  const r = await jsonOf(env, `/flow/node/v1/getDefSetting?defId=${defId}&topDefKey=`);
  return r.value || r;
};

export const getOtherParam = async (env, defId) => {
  const r = await jsonOf(env, `/flow/def/v1/getOtherParam?defId=${defId}`);
  return r.value || r;
};

export const getNodes = (env, defId) =>
  jsonOf(env, `/flow/node/v1/getNodes?defId=${defId}`);

export const getBranches = (env, defId, nodeId) =>
  jsonOf(env, `/flow/node/v1/branchConditionEdit?defId=${defId}&nodeId=${nodeId}`);

export const getSignConfig = (env, defId, nodeId) =>
  jsonOf(env, `/flow/node/v1/getSignConfig?defId=${defId}&nodeId=${nodeId}`);

export const getVarsList = async (env, defId) => {
  const r = await jsonOf(env, `/flow/var/v1/listJson?defId=${defId}&nodeId=`);
  return Array.isArray(r) ? r : (r.value || r.data || []);
};