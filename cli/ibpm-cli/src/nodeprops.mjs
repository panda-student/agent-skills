// 节点属性热改：走 saveDefConf（按 defId 写入，不新增版本），与设计器节点属性保存同一通道。
// 关键点：saveDefConf 对 nodePropertieMap 里的节点是「整条 propers 替换」，
// 所以必须先从 bpmnXml 读出该节点现有属性，只覆盖指定 key，再整条回写——否则其它属性会被默认模板重置。
import { defGet } from './api.mjs';
import {
  buildSettingFromXml, coerceNodeProps, listNodeIds, nodeProps,
  parseNodePropers, saveDefConf,
} from './defconf.mjs';

/** 解析 "k=v" 形式；值保持字符串，写入前按现有属性类型转换 */
export function parsePropAssignments(values) {
  const out = {};
  for (const item of values) {
    const i = item.indexOf('=');
    if (i <= 0) throw new Error(`属性参数格式应为 key=value: ${item}`);
    out[item.slice(0, i).trim()] = item.slice(i + 1);
  }
  return out;
}

/** 按当前值的类型转换（兼容 CLI 字符串与直接布尔/数字） */
export function coerceValue(key, value, current) {
  if (typeof current === 'boolean') {
    if (typeof value === 'boolean') return value;
    if (value === 'true' || value === '1') return true;
    if (value === 'false' || value === '0') return false;
    throw new Error(`属性 ${key} 是布尔值，请用 true/false（收到: ${value}）`);
  }
  if (typeof current === 'number') {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const n = Number(value);
    if (!Number.isFinite(n)) throw new Error(`属性 ${key} 是数字，收到: ${value}`);
    return n;
  }
  return value;
}

/**
 * 通用节点 propers 合并：读取现有 propers → 只覆盖 overrides
 * @param {object} opts { createPropers, noPropersMessage }
 */
export function buildNodePropertieMap(bpmnXml, nodes, overrides, { createPropers = false, noPropersMessage } = {}) {
  const existing = parseNodePropers(bpmnXml);
  const map = {};
  for (const nodeId of nodes) {
    const raw = existing[nodeId];
    let base;
    if (raw) {
      base = coerceNodeProps(raw, nodeId);
      base.nodeId = nodeId;
    } else if (createPropers) {
      // 无 propers = 引擎不校验（放行）。显式化时把 allowInterfaceApproval 设 true，保持原有放行效果。
      base = nodeProps(nodeId, true);
    } else {
      throw new Error(noPropersMessage
        ? noPropersMessage(nodeId)
        : `节点 ${nodeId} 当前无 propers（引擎按默认放行）。写入会显式化配置，确认创建请加 --create-propers` +
          '（将自动把 allowInterfaceApproval 设为 true，维持现状“无 propers=放行”）。');
    }
    for (const [key, value] of Object.entries(overrides)) {
      if (!(key in base)) throw new Error(`未知节点属性: ${key}（可用属性见 nodeProps 模板）`);
      base[key] = coerceValue(key, value, base[key]);
    }
    map[nodeId] = base;
  }
  return map;
}

const fmt = v => (v === undefined ? '(未设置)' : String(v));

/** 热改节点属性：读取现有 propers → 增量覆盖 → saveDefConf → 回读复核 */
export async function setNodeProps(env, defId, { nodes, overrides, createPropers = false }) {
  const targets = (nodes || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!targets.length) throw new Error('需要 --node "NodeA[,NodeB]"');
  if (!Object.keys(overrides).length) throw new Error('需要至少一个 --prop key=value');

  const before = await defGet(env, defId);
  const xml = before.bpmDefData.bpmnXml;
  const existing = parseNodePropers(xml);
  const allIds = listNodeIds(xml);
  const missing = targets.filter(n => !allIds.includes(n));
  if (missing.length) throw new Error(`节点不存在: ${missing.join(',')}`);

  const nodePropertieMap = buildNodePropertieMap(xml, targets, overrides, { createPropers });

  const setting = buildSettingFromXml(xml, nodePropertieMap);
  await saveDefConf(env, defId, setting);

  const after = await defGet(env, defId);
  const afterProps = parseNodePropers(after.bpmDefData.bpmnXml);

  let ok = true;
  for (const nodeId of targets) {
    const line = [];
    for (const key of Object.keys(overrides)) {
      const got = afterProps[nodeId]?.[key];
      const expected = nodePropertieMap[nodeId][key];
      const same = String(got) === String(expected);
      if (!same) ok = false;
      line.push(`${key}=${fmt(got)}${same ? '' : ` (期望 ${fmt(expected)})`}`);
    }
    const existed = existing[nodeId] ? '' : '（本次新建 propers）';
    console.log(`  ${nodeId.padEnd(24)} ${line.join('  ')}${existed}`);
  }

  const changedOthers = Object.keys(existing)
    .filter(n => !targets.includes(n))
    .flatMap(n => Object.keys(overrides)
      .filter(k => existing[n][k] !== undefined && String(existing[n][k]) !== String(afterProps[n]?.[k]))
      .map(k => `${n}.${k}: ${existing[n][k]}→${fmt(afterProps[n]?.[k])}`));

  const versionChanged = String(before.version) !== String(after.version);
  console.log(`\n版本: ${before.version} → ${after.version}${versionChanged ? '  ⚠️ 版本发生变化' : '（未变更）'}`);
  if (changedOthers.length) console.log(`⚠️ 非目标节点变化: ${changedOthers.join(', ')}`);
  console.log(`${ok ? '✅ 验证通过：目标属性均已生效' : '❌ 验证失败：回读值与期望不一致'}（saveDefConf 热生效，新发起实例立即使用）`);
  if (!ok) process.exitCode = 1;
}