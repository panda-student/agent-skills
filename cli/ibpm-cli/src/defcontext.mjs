// 流程定义统一查询上下文：defKey → 主版本 defId → 在线真值（全程内存，不下载/不落盘）。
import { defGet, listDefs } from './api.mjs';
import { parseVars } from './flowxml.mjs';
import {
  jsonOf, getDefSetting, getNodes, getOtherParam, getVarsList,
} from './domain-api.mjs';

/** 历史版本列表（平台按主版本 defId 查） */
export async function listVersions(env, mainDefId) {
  const r = await jsonOf(env, `/flow/def/v1/versions?defId=${mainDefId}&defKey=`, {
    method: 'POST',
    body: { pageBean: { page: 1, pageSize: 1000, total: 0 }, sorter: [] },
  });
  return r.rows || r.data?.rows || [];
}

/**
 * defKey → 定义行
 * 默认主版本；opts.version / opts.defId 可指定历史版本
 */
export async function resolveDef(env, defKey, { version, defId } = {}) {
  const rows = await listDefs(env, defKey);
  const main = rows.filter(r => r.defKey === defKey && r.isMain !== 'N').sort((a, b) => b.version - a.version)[0]
    || rows.filter(r => r.defKey === defKey).sort((a, b) => b.version - a.version)[0];
  if (!main) { console.error(`✗ 未找到流程 ${defKey}`); process.exit(1); }

  if (version === undefined && defId === undefined) return main;

  const versions = await listVersions(env, main.defId);
  const hit = defId !== undefined
    ? versions.find(v => String(v.defId) === String(defId))
    : versions.find(v => Number(v.version) === Number(version));
  if (!hit) {
    console.error(`✗ 未找到 ${defKey} 的${defId !== undefined ? ` defId=${defId}` : ` v${version}`}`);
    console.error(`  可用版本: ${versions.map(v => `v${v.version}${v.isMain === 'Y' ? '(主)' : ''}`).join(', ')}`);
    process.exit(1);
  }
  return hit;
}

// 轻量查询：不需要 defGet（bpmnXml/defJson）的命令直接复用
export const getNodeSet = getDefSetting;
export { getVarsList };

/**
 * 统一查询上下文（全部在线接口，内存处理）
 * @param {object} env
 * @param {string} defKey
 * @param {object} opts { nodeSet, flowProp, nodes, varsContract, version, defId }
 */
export async function getDefContext(env, defKey, opts = {}) {
  const row = await resolveDef(env, defKey, { version: opts.version, defId: opts.defId });
  const live = await defGet(env, row.defId);
  const ctx = {
    env,
    row,
    defId: row.defId,
    defKey: row.defKey,
    live,
    xml: live.bpmDefData?.bpmnXml || '',
    defJson: live.bpmDefData?.defJson || live.defJson || '',
    version: live.version ?? row.version,
    isMain: row.isMain !== 'N',
    selected: opts.version !== undefined || opts.defId !== undefined,
    varsXml: [],
  };
  ctx.varsXml = parseVars(ctx.xml);

  if (opts.nodeSet) ctx.nodeSet = await getDefSetting(env, row.defId);
  if (opts.flowProp) ctx.flowProp = (await getOtherParam(env, row.defId)).prop || {};
  if (opts.nodes) ctx.nodes = await getNodes(env, row.defId);
  if (opts.varsContract) ctx.varsContract = await getVarsList(env, row.defId);

  return ctx;
}