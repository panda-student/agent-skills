// 会签节点配置：ext:signSetting/ext:signRule ↔ getSignConfig / signConfigSave
import { attrOf, setAttr } from './xml-util.mjs';

export const SIGN_KEYS = ['decideType', 'voteType', 'voteAmount', 'followMode'];
export const isSignKey = k => SIGN_KEYS.includes(k);

export function findSignBlock(bpmn, nodeKey) {
  return bpmn.match(new RegExp(`<ext:signNode\\b[^>]*bpmnElement="${nodeKey}"[\\s\\S]*?<\\/ext:signNode>`))?.[0] || null;
}

const ruleFromBlock = block => {
  const m = block.match(/<ext:signRule\b([^>]*?)\/?>/);
  if (!m) return null;
  return {
    decideType: attrOf(m[1], 'decideType') || 'refuse',
    voteType: attrOf(m[1], 'voteType') || 'amount',
    voteAmount: Number(attrOf(m[1], 'voteAmount') || 1),
    followMode: attrOf(m[1], 'followMode') || 'complete',
  };
};

/** 所有会签节点的 signRule：{ nodeId: {...} } */
export function parseAllSignSettings(bpmn) {
  const out = {};
  for (const m of bpmn.matchAll(/<ext:signNode\b[^>]*bpmnElement="([^"]+)"[\s\S]*?<\/ext:signNode>/g)) {
    const rule = ruleFromBlock(m[0]);
    if (rule) out[m[1]] = rule;
  }
  return out;
}

/** 在工作区 bpmn 上修改会签节点 signRule；返回新的 bpmn */
export function applySignConfig(bpmn, nodeKey, assignments) {
  const block = findSignBlock(bpmn, nodeKey);
  if (!block) throw new Error(`会签节点 ${nodeKey} 不存在（或不是 ext:signNode）`);
  const m = block.match(/<ext:signRule\b([^>]*?)\/?>/);
  if (!m) throw new Error(`会签节点 ${nodeKey} 缺少 ext:signRule`);
  let tag = m[0];
  for (const [k, v] of Object.entries(assignments)) {
    if (!isSignKey(k)) throw new Error(`不支持的会签字段: ${k}（可用: ${SIGN_KEYS.join(', ')}）`);
    if (k === 'voteAmount' && !Number.isFinite(Number(v))) throw new Error(`voteAmount 必须是数字: ${v}`);
    tag = setAttr(tag, k, v);
  }
  return bpmn.replace(block, block.replace(m[0], tag));
}