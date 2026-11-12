// 节点按钮：ext:buttons/ext:button ↔ saveNodeBtns；与 live nodeBtnMap 合并，保留脚本等 XML 未表示字段
import { esc } from './flowxml.mjs';
import { attrOf, textOf } from './xml-util.mjs';

const KNOWN_ATTRS = ['alias', 'buttonType', 'customAlias', 'isLock', 'name'];

export function findNodeBlock(bpmn, nodeKey) {
  return bpmn.match(new RegExp(`<ext:userNode\\b[^>]*bpmnElement="${nodeKey}"[\\s\\S]*?<\\/ext:userNode>`))?.[0]
    || bpmn.match(new RegExp(`<ext:signNode\\b[^>]*bpmnElement="${nodeKey}"[\\s\\S]*?<\\/ext:signNode>`))?.[0]
    || null;
}

/** 解析节点 ext:buttons → [{alias,buttonType,customAlias,isLock,name,rejectMode}] */
export function parseButtons(bpmn, nodeKey) {
  const block = findNodeBlock(bpmn, nodeKey);
  if (!block) throw new Error(`节点 ${nodeKey} 不存在`);
  const m = block.match(/<ext:buttons>([\s\S]*?)<\/ext:buttons>/);
  if (!m) return [];
  const out = [];
  for (const b of m[1].matchAll(/<ext:button\b([^>]*?)(?:\/>|>([\s\S]*?)<\/ext:button>)/g)) {
    const attrs = b[1], body = b[2] || '';
    const found = [...attrs.matchAll(/([A-Za-z0-9_]+)="/g)].map(x => x[1]);
    const unknown = found.filter(a => !KNOWN_ATTRS.includes(a));
    if (unknown.length) throw new Error(`节点 ${nodeKey} 按钮含暂不支持热改的属性: ${unknown.join(', ')}`);
    const rm = body.match(/<ext:rejectMode>([\s\S]*?)<\/ext:rejectMode>/);
    const extra = body.replace(/<ext:rejectMode>[\s\S]*?<\/ext:rejectMode>/g, '').trim();
    if (extra) throw new Error(`节点 ${nodeKey} 按钮含暂不支持热改的子配置`);
    out.push({
      alias: attrOf(attrs, 'alias') || '',
      buttonType: attrOf(attrs, 'buttonType') || 'system',
      customAlias: attrOf(attrs, 'customAlias') || '',
      isLock: attrOf(attrs, 'isLock') === 'true',
      name: attrOf(attrs, 'name') || '',
      rejectMode: rm ? textOf(rm[1]) : '',
    });
  }
  return out;
}

/** 所有节点的按钮配置：{ nodeId: [...] } */
export function parseAllButtons(bpmn) {
  const out = {};
  for (const m of bpmn.matchAll(/<ext:(userNode|signNode)\b[^>]*bpmnElement="([^"]+)"[\s\S]*?<\/ext:\1>/g)) {
    const id = m[2];
    const b = m[0].match(/<ext:buttons>([\s\S]*?)<\/ext:buttons>/);
    if (!b) continue;
    out[id] = parseButtons(bpmn, id);
  }
  return out;
}

const renderButton = b =>
  `<ext:button alias="${esc(b.alias)}" buttonType="${esc(b.buttonType || 'system')}" `
  + `customAlias="${esc(b.customAlias || '')}" isLock="${b.isLock ? 'true' : 'false'}" name="${esc(b.name || '')}">`
  + `<ext:rejectMode><![CDATA[${b.rejectMode || ''}]]></ext:rejectMode></ext:button>`;

/** 在工作区 bpmn 上增/改/删一个按钮；返回新的 bpmn */
export function applyButton(bpmn, nodeKey, opts) {
  const block = findNodeBlock(bpmn, nodeKey);
  if (!block) throw new Error(`节点 ${nodeKey} 不存在`);
  const list = parseButtons(bpmn, nodeKey);
  const alias = opts.alias;
  if (!alias) throw new Error('需要 --alias');
  const idx = list.findIndex(b => b.alias === alias);
  if (opts.remove) {
    if (idx < 0) throw new Error(`节点 ${nodeKey} 没有按钮 ${alias}`);
    list.splice(idx, 1);
  } else {
    const next = idx >= 0 ? { ...list[idx] } : { alias, buttonType: 'system', customAlias: '', isLock: false, name: '', rejectMode: '' };
    if (opts.name !== undefined) next.name = opts.name;
    if (opts.buttonType !== undefined) next.buttonType = opts.buttonType;
    if (opts.customAlias !== undefined) next.customAlias = opts.customAlias;
    if (opts.isLock !== undefined) next.isLock = opts.isLock === true || opts.isLock === 'true';
    if (opts.rejectMode !== undefined) next.rejectMode = opts.rejectMode;
    if (next.buttonType === 'system' && !next.customAlias) next.customAlias = next.alias;
    if (idx >= 0) list[idx] = next; else list.push(next);
  }
  const xml = `<ext:buttons>${list.map(renderButton).join('')}</ext:buttons>`;
  const existing = block.match(/<ext:buttons>[\s\S]*?<\/ext:buttons>/);
  let nextBlock;
  if (existing) {
    nextBlock = block.replace(existing[0], xml);
  } else if (list.length) {
    // 无按钮段：插到 propers 前，或节点结束前
    nextBlock = block.includes('<ext:propers>')
      ? block.replace('<ext:propers>', `${xml}<ext:propers>`)
      : block.replace(/<\/ext:(userNode|signNode)>$/, `${xml}</ext:$1>`);
  } else {
    nextBlock = block;
  }
  return bpmn.replace(block, nextBlock);
}

/** 回读复核投影：只比 XML 可表达字段 */
export const projectButtons = list => (list || []).map(b => ({
  alias: b.alias,
  name: b.name,
  buttonType: b.buttonType,
  isLock: !!b.isLock,
  rejectMode: b.rejectMode || '',
}));

/** 用 XML 按钮覆盖 live 按钮对象，保留脚本/消息等 XML 未表示字段 */
export function mergeButtons(liveList, wsList) {
  const liveByAlias = new Map((liveList || []).map(b => [b.alias, b]));
  return wsList.map(ws => {
    const base = liveByAlias.get(ws.alias) || {
      buttonType: ws.buttonType || 'system',
      customAlias: ws.customAlias || '',
      name: ws.name || '',
      alias: ws.alias,
      beforeScript: null, afterScript: null, groovyScript: null, completeEventGroovyScript: null,
      rejectMode: '', isLock: false, supportScript: false, msgConfig: null, i18nKey: null,
    };
    const out = { ...base, alias: ws.alias, name: ws.name, buttonType: ws.buttonType, isLock: ws.isLock, rejectMode: ws.rejectMode };
    if (ws.customAlias) out.customAlias = ws.customAlias;
    else if (out.buttonType === 'system') out.customAlias = ws.alias;
    delete out.status;
    return out;
  });
}