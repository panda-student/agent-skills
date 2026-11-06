// build-activiti-xml.mjs
// 生成 Activiti 风格的 BPMN XML（用于嵌入 bpmdefs.flow.xml 的 <bpmnXml> 段）
//
// 系统的 XML→POJO 转换基于 Activiti 引擎，要求特定风格：
//   - 根标签 <ext:definitions>（宏天自定义前缀）+ 默认命名空间 + activiti 命名空间
//   - <process> 用默认命名空间（无前缀），id=defKey，isExecutable="true"
//   - process 带 executionListener（start/end）
//   - startEvent 带 activiti:initiator="startUser"
//   - userTask 带 taskListener（create/complete）
//   - 无 <?xml?> 声明
//   - BPMNDiagram 段用 omgdc/omgdi 前缀（不是 dc/di）
//
// 输入：带坐标的 BPMN XML（bpmn-auto-layout 输出）+ spec（流程描述）
// 输出：Activiti 风格的 BPMN XML 字符串（无 XML 声明）

import { BpmnModdle } from 'bpmn-moddle';
import { buildExtProcess } from './build-extprocess.mjs';

// 输入 type(camelCase) → BPMN 标签名（Activiti 风格，无前缀，因为用默认命名空间）
const TAG_MAP = {
  startEvent: 'startEvent',
  endEvent: 'endEvent',
  task: 'task',
  userTask: 'userTask',
  serviceTask: 'serviceTask',
  manualTask: 'manualTask',
  sendTask: 'sendTask',
  receiveTask: 'receiveTask',
  scriptTask: 'scriptTask',
  businessRuleTask: 'businessRuleTask',
  exclusiveGateway: 'exclusiveGateway',
  parallelGateway: 'parallelGateway',
  inclusiveGateway: 'inclusiveGateway',
  subProcess: 'subProcess',
};

function escapeAttr(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/**
 * 生成 Activiti 风格的 BPMN XML
 * @param {string} laidOutXml - 带坐标的 BPMN XML（bpmn-auto-layout 输出，用来读坐标）
 * @param {object} spec - 流程描述 {name, processKey, nodes, edges, variables?, globalFormUrl?}
 * @param {Array} nodeDispose - nodeDispose.json 内容（用于生成 extProcess 的审批人配置）
 * @returns {Promise<string>} Activiti 风格 BPMN XML（无 <?xml?> 声明）
 */
export async function buildActivitiXml(laidOutXml, spec, nodeDispose) {
  // 1. 用 moddle 解析 laidOutXml，读出坐标
  const moddle = new BpmnModdle();
  const { rootElement } = await moddle.fromXML(laidOutXml);
  const plane = rootElement.diagrams[0].plane;
  const planeElements = plane.get('planeElement') || [];

  // 建 bpmnId → 坐标
  const shapeMap = new Map();
  for (const pe of planeElements) {
    if (pe.$type === 'bpmndi:BPMNShape') {
      const b = pe.bounds;
      shapeMap.set(pe.bpmnElement?.id, { x: b.x, y: b.y, w: b.width, h: b.height });
    }
  }
  // 建 bpmnId → 边的 waypoints
  const edgeMap = new Map();
  for (const pe of planeElements) {
    if (pe.$type === 'bpmndi:BPMNEdge') {
      const wps = (pe.waypoint || []).map(w => ({ x: w.x, y: w.y }));
      edgeMap.set(pe.bpmnElement?.id, wps);
    }
  }

  const { processKey, name, nodes, edges } = spec;

  // 2. 拼字符串
  const lines = [];

  // 根标签：ext:definitions + 所有命名空间（照抄平台导出，含 userAssign 插件的 xmlns:user）
  lines.push('<ext:definitions xmlns:ext="http://www.jee-soft.cn/bpm" xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:activiti="http://activiti.org/bpmn" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:omgdc="http://www.omg.org/spec/DD/20100524/DC" xmlns:omgdi="http://www.omg.org/spec/DD/20100524/DI" xmlns:fn="http://www.w3.org/2005/02/xpath-functions" xmlns:ht="http://www.jee-soft.cn/BPMN20EXT" xmlns:user="http://www.jee-soft.cn/bpm/plugins/task/userAssign" typeLanguage="http://www.w3.org/2001/XMLSchema" expressionLanguage="http://www.w3.org/1999/XPath" targetNamespace="http://activiti.org/bpmn20">');

  // process（默认命名空间，id=defKey，isExecutable=true）
  lines.push(`  <process id="${escapeAttr(processKey)}" name="${escapeAttr(name)}" isExecutable="true">`);

  // process 级 executionListener
  lines.push('    <extensionElements>');
  lines.push('      <activiti:executionListener event="start" delegateExpression="${startEventListener}"/>');
  lines.push('      <activiti:executionListener event="end" delegateExpression="${endEventListener}"/>');
  lines.push('    </extensionElements>');

  // 节点
  for (const n of nodes) {
    const tag = TAG_MAP[n.type];
    if (!tag) continue;
    const nameAttr = n.name ? ` name="${escapeAttr(n.name)}"` : '';

    if (n.type === 'startEvent') {
      lines.push(`    <${tag} id="${escapeAttr(n.id)}"${nameAttr} activiti:initiator="startUser" i18nKey=""/>`);
    } else if (n.type === 'userTask') {
      lines.push(`    <${tag} id="${escapeAttr(n.id)}"${nameAttr} i18nKey="">`);
      lines.push('      <extensionElements>');
      lines.push('        <activiti:taskListener event="create" delegateExpression="${taskCreateListener}"/>');
      lines.push('        <activiti:taskListener event="complete" delegateExpression="${taskCompleteListener}"/>');
      lines.push('      </extensionElements>');
      lines.push(`    </${tag}>`);
    } else if (n.type === 'endEvent' || n.type.includes('Gateway')) {
      lines.push(`    <${tag} id="${escapeAttr(n.id)}"${nameAttr}/>`);
    } else {
      lines.push(`    <${tag} id="${escapeAttr(n.id)}"${nameAttr}/>`);
    }
  }

  // 边（sequenceFlow）
  for (const e of edges) {
    const cond = e.condition;
    const nameAttr = e.name ? ` name="${escapeAttr(e.name)}"` : '';
    if (cond) {
      lines.push(`    <sequenceFlow id="${escapeAttr(e.id)}"${nameAttr} sourceRef="${escapeAttr(e.source)}" targetRef="${escapeAttr(e.target)}">`);
      lines.push(`      <conditionExpression xsi:type="tFormalExpression"><![CDATA[${cond}]]></conditionExpression>`);
      lines.push(`    </sequenceFlow>`);
    } else {
      lines.push(`    <sequenceFlow id="${escapeAttr(e.id)}"${nameAttr} sourceRef="${escapeAttr(e.source)}" targetRef="${escapeAttr(e.target)}"/>`);
    }
  }

  lines.push('  </process>');

  // BPMNDiagram 段（用 omgdc/omgdi 前缀）
  lines.push(`  <bpmndi:BPMNDiagram id="BPMNDiagram_${escapeAttr(processKey)}">`);
  lines.push(`    <bpmndi:BPMNPlane bpmnElement="${escapeAttr(processKey)}" id="BPMNPlane_${escapeAttr(processKey)}">`);

  // Shapes
  for (const n of nodes) {
    const s = shapeMap.get(n.id);
    if (!s) continue;
    lines.push(`      <bpmndi:BPMNShape bpmnElement="${escapeAttr(n.id)}" id="BPMNShape_${escapeAttr(n.id)}">`);
    lines.push(`        <omgdc:Bounds height="${s.h}" width="${s.w}" x="${s.x}" y="${s.y}"/>`);
    lines.push(`      </bpmndi:BPMNShape>`);
  }

  // Edges
  for (const e of edges) {
    const wps = edgeMap.get(e.id);
    if (!wps || wps.length === 0) continue;
    lines.push(`      <bpmndi:BPMNEdge bpmnElement="${escapeAttr(e.id)}" id="BPMNEdge_${escapeAttr(e.id)}">`);
    for (const wp of wps) {
      lines.push(`        <omgdi:waypoint x="${wp.x}" y="${wp.y}"/>`);
    }
    lines.push(`      </bpmndi:BPMNEdge>`);
  }

  lines.push('    </bpmndi:BPMNPlane>');
  lines.push('  </bpmndi:BPMNDiagram>');

  // ext:extProcess 段（宏天扩展：节点按钮、审批人、表单、变量）
  // 这是系统 POJO 转换必须的部分
  const extProcessXml = buildExtProcess(spec, nodeDispose);
  lines.push(extProcessXml);
  // buildExtProcess 内部已输出 </ext:definitions>，这里不再重复

  return lines.join('\n');
}
