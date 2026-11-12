// 流程级「其它设置」：ext:extProperties + bpmDefinition 属性 ↔ getOtherParam.prop / saveProp。
// 设计原则：从线上 getOtherParam.prop 出发，只覆盖 XML 中真实存在的字段，未表示字段原样保留。
import { esc } from './flowxml.mjs';
import { attrOf, setAttr, textOf } from './xml-util.mjs';

/** XML 中可编辑字段：kind = extAttr | extChild | defAttr */
export const FLOW_PROP_META = {
  // ext:extProperties 属性
  allowExecutorEmpty: { kind: 'extAttr', type: 'boolean' },
  backToCurNodeVisible: { kind: 'extAttr', type: 'boolean' },
  dateType: { kind: 'extAttr', type: 'string' },
  dueTime: { kind: 'extAttr', type: 'number' },
  msgConfig: { kind: 'extAttr', type: 'string' },
  skipExecutorEmpty: { kind: 'extAttr', type: 'boolean' },
  skipRules: { kind: 'extAttr', type: 'string' },
  testNotifyType: { kind: 'extAttr', type: 'string' },

  // ext:extProperties 子元素
  subjectRule: { kind: 'extChild', type: 'string', cdata: true },
  summaryRule: { kind: 'extChild', type: 'string', cdata: true },
  bizKeyRule: { kind: 'extChild', type: 'string', cdata: true },
  description: { kind: 'extChild', type: 'string' },
  startNotifyType: { kind: 'extChild', type: 'string' },
  archiveNotifyType: { kind: 'extChild', type: 'string' },
  notifyType: { kind: 'extChild', type: 'string' },
  skipFirstNode: { kind: 'extChild', type: 'boolean' },
  firstNodeUserAssign: { kind: 'extChild', type: 'boolean' },
  skipSameUser: { kind: 'extChild', type: 'boolean' },
  allowCopyTo: { kind: 'extChild', type: 'boolean' },
  allowTransTo: { kind: 'extChild', type: 'boolean' },
  useMainForm: { kind: 'extChild', type: 'string' },
  doneDataVersion: { kind: 'extChild', type: 'string' },
  allowReference: { kind: 'extChild', type: 'boolean' },
  allowRefCounts: { kind: 'extChild', type: 'number' },
  checkLimit: { kind: 'extChild', type: 'string' },
  startLimit: { kind: 'extChild', type: 'string' },

  // bpmDefinition 属性
  status: { kind: 'defAttr', type: 'string' },
  testStatus: { kind: 'defAttr', type: 'string' },
  showUrgentState: { kind: 'defAttr', type: 'boolean01' },
  showModifyRecord: { kind: 'defAttr', type: 'boolean01' },
  readRevoke: { kind: 'defAttr', xmlName: 'isReadRevoke', type: 'boolean' },
  urgentMailTel: { kind: 'defAttr', type: 'string' },
  urgentSmsTel: { kind: 'defAttr', type: 'string' },
};

export function isFlowPropKey(k) { return !!FLOW_PROP_META[k]; }

/** 直接在 getOtherParam.prop 对象上应用 --prop（不依赖 XML/工作区） */
export function applyFlowPropValues(prop, assignments) {
  const out = { ...(prop || {}) };
  const unknown = Object.keys(assignments).filter(k => !isFlowPropKey(k));
  if (unknown.length) {
    throw new Error(`不支持热改的流程级字段: ${unknown.join(', ')}（可用字段: ${Object.keys(FLOW_PROP_META).join(', ')}）`);
  }
  for (const [key, raw] of Object.entries(assignments)) {
    const meta = FLOW_PROP_META[key];
    let value;
    if (meta.type === 'boolean' || meta.type === 'boolean01') {
      const s = String(raw);
      if (!['true', 'false', '1', '0'].includes(s)) throw new Error(`${key} 需要布尔值 true/false（收到: ${raw}）`);
      value = s === 'true' || s === '1';
    } else if (meta.type === 'number') {
      value = Number(raw);
      if (!Number.isFinite(value)) throw new Error(`${key} 需要数字（收到: ${raw}）`);
    } else {
      value = String(raw);
    }
    out[key] = value;

    if (key === 'skipRules') {
      out.skipSameUser = String(raw).split(',').map(s => s.trim()).includes('sameUser');
    }
    if (key === 'skipSameUser') {
      const types = new Set(String(out.skipRules || '').split(',').map(s => s.trim()).filter(Boolean));
      if (value) types.add('sameUser'); else types.delete('sameUser');
      out.skipRules = [...types].join(',');
    }
  }
  return out;
}

const cast = (type, raw) => {
  if (type === 'boolean') return String(raw) === 'true' || String(raw) === '1';
  if (type === 'boolean01') return String(raw) === 'true' || String(raw) === '1';
  if (type === 'number') return Number(raw);
  return String(raw ?? '');
};

/** 解析工作区 XML 中真实存在的流程级字段（仅返回存在的字段，供覆盖线上 prop） */
export function parseFlowProps(bpmn, outerXml) {
  const out = {};
  const block = bpmn.match(/<ext:extProperties\b([^>]*)>([\s\S]*?)<\/ext:extProperties>/);
  if (block) {
    const [, attrs, body] = block;
    for (const [key, meta] of Object.entries(FLOW_PROP_META)) {
      if (meta.kind === 'extAttr') {
        const v = attrOf(attrs, key);
        if (v !== undefined) out[key] = cast(meta.type, v);
      } else if (meta.kind === 'extChild') {
        const re = new RegExp(`<ext:${key}(?:\\s[^>]*)?(?:/>|>([\\s\\S]*?)<\\/ext:${key}>)`);
        const m = body.match(re);
        if (m) out[key] = cast(meta.type, textOf(m[1] || ''));
      }
    }
  }
  const def = outerXml.match(/<bpmDefinition\b([^>]*)>/);
  if (def) {
    for (const [key, meta] of Object.entries(FLOW_PROP_META)) {
      if (meta.kind !== 'defAttr') continue;
      const v = attrOf(def[1], meta.xmlName || key);
      if (v !== undefined) out[key] = meta.type === 'boolean01' ? (v === '1' || v === 'true') : (meta.type === 'boolean' ? v === 'true' : v);
    }
  }
  return out;
}

function setChild(bpmn, key, value, cdata) {
  const content = cdata ? `<![CDATA[${value}]]>` : esc(String(value));
  // 必须限定在 ext:extProperties 段内——ext:description 等标签在 varDefs 中也大量存在
  const blockMatch = bpmn.match(/<ext:extProperties\b[^>]*>[\s\S]*?<\/ext:extProperties>/);
  if (!blockMatch) throw new Error('工作区 bpmnXml 缺少 ext:extProperties 段');
  let block = blockMatch[0];
  const re = new RegExp(`(<ext:${key}(?:\\s[^>]*)?>)([\\s\\S]*?)(<\\/ext:${key}>)`);
  if (re.test(block)) {
    block = block.replace(re, `$1${content}$3`);
  } else {
    const self = new RegExp(`<ext:${key}\\s*/>`);
    if (self.test(block)) block = block.replace(self, `<ext:${key}>${content}</ext:${key}>`);
    else block = block.replace('</ext:extProperties>', `  <ext:${key}>${content}</ext:${key}>\n</ext:extProperties>`);
  }
  return bpmn.replace(blockMatch[0], block);
}

/** 在工作区 XML 上应用 --prop 赋值；返回 { bpmn, xml, messages } */
export function applyFlowProps({ bpmn, xml }, assignments) {
  const msgs = [];
  const keys = Object.keys(assignments);
  const unknown = keys.filter(k => !isFlowPropKey(k));
  if (unknown.length) {
    throw new Error(`不支持热改的流程级字段: ${unknown.join(', ')}（可用字段: ${Object.keys(FLOW_PROP_META).join(', ')}）`);
  }

  // skipRules 与 skipSameUser 联动：先处理 skipRules，再让显式 skipSameUser 覆盖
  for (const [key, raw] of Object.entries(assignments)) {
    const meta = FLOW_PROP_META[key];
    const value = raw;
    if (meta.kind === 'extAttr') {
      bpmn = bpmn.replace(/<ext:extProperties\b[^>]*>/, tag => setAttr(tag, key, value));
      msgs.push(`${key}=${value}`);
    } else if (meta.kind === 'extChild') {
      bpmn = setChild(bpmn, key, value, meta.cdata);
      msgs.push(`${key}=${value}`);
    } else {
      const attrName = meta.xmlName || key;
      const attrValue = meta.type === 'boolean01'
        ? (String(value) === 'true' || String(value) === '1' ? '1' : '0')
        : value;
      xml = xml.replace(/<bpmDefinition\b[^>]*>/, tag => setAttr(tag, attrName, attrValue));
      msgs.push(`${key}=${value}`);
    }
    if (key === 'skipRules') {
      const on = String(value).split(',').map(s => s.trim()).includes('sameUser');
      bpmn = setChild(bpmn, 'skipSameUser', on ? 'true' : 'false', false);
    }
    if (key === 'skipSameUser') {
      const block = bpmn.match(/<ext:extProperties\b([^>]*)>/);
      const current = block ? (attrOf(block[1], 'skipRules') || '') : '';
      const types = new Set(current.split(',').map(s => s.trim()).filter(Boolean));
      if (String(value) === 'true' || String(value) === '1') types.add('sameUser');
      else types.delete('sameUser');
      const next = [...types].join(',');
      bpmn = bpmn.replace(/<ext:extProperties\b[^>]*>/, tag => setAttr(tag, 'skipRules', next));
    }
  }
  return { bpmn, xml, messages: msgs };
}