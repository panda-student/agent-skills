// bpmdefs.flow.xml 读写与块定位（转义形态经原包实证：& < > " 转义，' 不转义；defJson/bpmnXml 双段内嵌）
import { readFileSync, writeFileSync } from 'node:fs';

export const unesc = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
export const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function readFlow(xmlPath) {
  const xml = readFileSync(xmlPath, 'utf8');
  const mDef = xml.match(/<defJson>([\s\S]*?)<\/defJson>/);
  const mBpmn = xml.match(/<bpmnXml>([\s\S]*?)<\/bpmnXml>/);
  if (!mDef || !mBpmn) throw new Error('bpmdefs.flow.xml 缺少 defJson/bpmnXml 段');
  const def = JSON.parse(unesc(mDef[1]));
  const bpmn = unesc(mBpmn[1]);
  const meta = {
    defKey: (xml.match(/defKey="([^"]*)"/) || [])[1] || '',
    name: (xml.match(/<bpmDefinition name="([^"]*)"/) || [])[1] || '',
  };
  return { xmlPath, xml, mDef, mBpmn, def, bpmn, meta };
}

export function writeFlow(flow) {
  let xml = flow.xml;
  xml = xml.replace(flow.mDef[0], '<defJson>' + esc(JSON.stringify(flow.def)) + '</defJson>');
  const mBpmn2 = xml.match(/<bpmnXml>([\s\S]*?)<\/bpmnXml>/);
  xml = xml.replace(mBpmn2[0], '<bpmnXml>' + esc(flow.bpmn) + '</bpmnXml>');
  writeFileSync(flow.xmlPath, xml, 'utf8');
}

// ---- defJson 层 ----
export const shapes = def => def.childShapes;
export const edgesOf = def => def.childShapes.filter(s => s.stencil.id === 'SequenceFlow');
export const nodesOf = def => def.childShapes.filter(s => s.stencil.id !== 'SequenceFlow');
export const idOf = s => s.properties?.overrideid || s.resourceId;
export function nodeById(def, key) {
  return nodesOf(def).find(s => idOf(s) === key);
}
export function edgeBetween(def, srcKey, tgtKey) {
  const src = nodeById(def, srcKey), tgt = nodeById(def, tgtKey);
  if (!src || !tgt) return null;
  return edgesOf(def).find(e =>
    e.target?.resourceId === tgt.resourceId
    && (src.outgoing || []).some(o => o.resourceId === e.resourceId)) || null;
}
export function edgesAround(def, key) {
  const n = nodeById(def, key);
  const outs = edgesOf(def).filter(e => (n.outgoing || []).some(o => o.resourceId === e.resourceId));
  const ins = edgesOf(def).filter(e => e.target?.resourceId === n.resourceId);
  return { ins, outs };
}

// ---- bpmn 文本块定位（模式经原包实证） ----
export const findUserTask = (bpmn, id) =>
  bpmn.match(new RegExp(`<userTask id="${id}"[\\s\\S]*?<\\/userTask>`));
export const findGateway = (bpmn, id) =>
  bpmn.match(new RegExp(`<(?:exclusiveGateway|parallelGateway|inclusiveGateway) id="${id}"[^>]*\\/>`));
export const findNodeXml = (bpmn, id) => findUserTask(bpmn, id) || findGateway(bpmn, id)
  || bpmn.match(new RegExp(`<(?:startEvent|endEvent|serviceTask|task) id="${id}"[^>]*\\/>`));
export const findShape = (bpmn, id) =>
  bpmn.match(new RegExp(`<bpmndi:BPMNShape bpmnElement="${id}" id="BPMNShape_${id}">[\\s\\S]*?<\\/bpmndi:BPMNShape>`))
  || bpmn.match(new RegExp(`<bpmndi:BPMNShape bpmnElement="${id}" id="BPMNShape_${id}"\\s*\\/?>`));
export const findShapeBounds = (bpmn, id) => {
  const s = findShape(bpmn, id);
  if (!s) return null;
  const b = s[0].match(/<omgdc:Bounds height="([\d.]+)" width="([\d.]+)" x="([\d.]+)" y="([\d.]+)"\/>/);
  return b ? { h: +b[1], w: +b[2], x: +b[3], y: +b[4] } : null;
};
export const findEdgeXml = (bpmn, edgeId) =>
  bpmn.match(new RegExp(`<bpmndi:BPMNEdge bpmnElement="${edgeId}"[\\s\\S]*?<\\/bpmndi:BPMNEdge>`));
export const findSeqFlow = (bpmn, edgeId) =>
  // 自闭合（无条件边）优先——否则 [\s\S]*? 会从 "/>" 吞到下一条边的关闭标签（实证 bug）
  bpmn.match(new RegExp(`<sequenceFlow id="${edgeId}"[^>]*\\/>`))
  || bpmn.match(new RegExp(`<sequenceFlow id="${edgeId}"[\\s\\S]*?<\\/sequenceFlow>`));
export const findUserNode = (bpmn, nodeKey) =>
  bpmn.match(new RegExp(`<ext:userNode[^>]*bpmnElement="${nodeKey}"[\\s\\S]*?<\\/ext:userNode>`));
export const findSignNode = (bpmn, nodeKey) =>
  bpmn.match(new RegExp(`<ext:signNode[^>]*bpmnElement="${nodeKey}"[\\s\\S]*?<\\/ext:signNode>`));
export const findExtPlugins = (userNodeXml) =>
  userNodeXml.match(/<ext:extPlugins>[\s\S]*?<\/ext:extPlugins>/);
export function findVarDefs(bpmn) {
  return bpmn.match(/<ext:varDefs>([\s\S]*?)<\/ext:varDefs>/);
}
export function parseVars(bpmn) {
  const seg = findVarDefs(bpmn);
  if (!seg) return [];
  return [...seg[1].matchAll(/<ext:variableDef>([\s\S]*?)<\/ext:variableDef>/g)].map(v => ({
    name: (v[1].match(/<ext:name>([\s\S]*?)<\/ext:name>/) || [])[1] || '',
    key: (v[1].match(/<ext:key>([\s\S]*?)<\/ext:key>/) || [])[1] || '',
    type: (v[1].match(/<ext:type>([\s\S]*?)<\/ext:type>/) || [])[1] || 'string',
    raw: v[0],
  }));
}
export const varDefXml = (key, name, type = 'string') =>
  `<ext:variableDef><ext:name>${esc(name)}</ext:name><ext:key>${key}</ext:key><ext:type>${type}</ext:type><ext:description/><ext:defaultVal/><ext:isRequired>false</ext:isRequired></ext:variableDef>`;
