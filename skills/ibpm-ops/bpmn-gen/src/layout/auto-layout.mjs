// 自动布局：bpmn-auto-layout 封装 + 环流程降级 BFS 分层布局
// 用法（库）：const laidOutXml = await autoLayout(noDiXml, spec)
import { layoutProcess } from 'bpmn-auto-layout';

/**
 * 降级布局：bpmn-auto-layout 不支持含环流程，失败时用 BFS 分层手动排坐标
 * 给 noDiXml 追加 BPMNDiagram 段（含所有 Shape 和 Edge 的坐标）
 */
export function fallbackLayout(noDiXml, spec) {
  // 提取所有节点 id + type（noDiXml 用 bpmn: 前缀，兼容有无前缀）
  const nodeRegex = /<(?:bpmn:)?(startEvent|endEvent|userTask|exclusiveGateway|parallelGateway|inclusiveGateway|serviceTask|manualTask)\s+id="([^"]+)"/g;
  const nodes = [];
  let m;
  while ((m = nodeRegex.exec(noDiXml)) !== null) {
    nodes.push({ type: m[1], id: m[2] });
  }
  // 提取所有边（sourceRef/targetRef 在 moddle 序列化里是 ID 字符串）
  const edgeRegex = /<(?:bpmn:)?sequenceFlow\s+id="([^"]+)"[\s\S]*?sourceRef="([^"]+)"[\s\S]*?targetRef="([^"]+)"/g;
  const edges = [];
  while ((m = edgeRegex.exec(noDiXml)) !== null) {
    edges.push({ id: m[1], source: m[2], target: m[3] });
  }

  // BFS 分层（环边：若 target 已分层且层数 <= source，仍连边但不重排）
  const level = {};
  const nodeIds = nodes.map(n => n.id);
  // 找起点（startEvent 或无入边的节点）
  const startNodes = nodes.filter(n => n.type === 'startEvent').map(n => n.id);
  const hasInEdge = new Set(edges.map(e => e.target));
  const roots = startNodes.length ? startNodes : nodeIds.filter(id => !hasInEdge.has(id));
  roots.forEach(id => { level[id] = 0; });
  // 按入边推进分层（松弛迭代，处理环）
  let changed = true, iter = 0;
  while (changed && iter < nodeIds.length + 5) {
    changed = false; iter++;
    for (const e of edges) {
      if (level[e.source] !== undefined) {
        const want = level[e.source] + 1;
        if (level[e.target] === undefined || level[e.target] < want) {
          // 环边：若 target 是 source 的祖先则跳过（避免无限推进）
          level[e.target] = want;
          changed = true;
        }
      }
    }
  }
  // 未分层的孤立节点放第 0 层
  nodeIds.forEach(id => { if (level[id] === undefined) level[id] = 0; });

  // 按层组织节点
  const byLevel = {};
  nodeIds.forEach(id => {
    const lv = level[id];
    (byLevel[lv] = byLevel[lv] || []).push(id);
  });
  const maxLevel = Math.max(...Object.keys(byLevel).map(Number));

  // 尺寸常量
  const NODE_W = 100, NODE_H = 46;
  const GW_W = 40, GW_H = 40;
  const EVT_S = 30;
  const COL_GAP = 160, ROW_GAP = 100;
  const X0 = 50, Y0 = 50;

  const bounds = {}; // id -> {x,y,w,h}
  for (let lv = 0; lv <= maxLevel; lv++) {
    const ids = byLevel[lv] || [];
    const x = X0 + lv * COL_GAP;
    ids.forEach((id, i) => {
      const node = nodes.find(n => n.id === id);
      let w = NODE_W, h = NODE_H;
      if (node && node.type.endsWith('Gateway')) { w = GW_W; h = GW_H; }
      else if (node && (node.type === 'startEvent' || node.type === 'endEvent')) { w = EVT_S; h = EVT_S; }
      bounds[id] = { x, y: Y0 + i * ROW_GAP, w, h };
    });
  }

  // 生成 BPMNDiagram 段
  const shapes = nodes.map(n => {
    const b = bounds[n.id];
    return `<bpmndi:BPMNShape bpmnElement="${n.id}" id="BPMNShape_${n.id}"><omgdc:Bounds height="${b.h}.0" width="${b.w}.0" x="${b.x}.0" y="${b.y}.0"/></bpmndi:BPMNShape>`;
  }).join('\n    ');

  const edgeXml = edges.map(e => {
    const sb = bounds[e.source], tb = bounds[e.target];
    if (!sb || !tb) return '';
    const sx = sb.x + sb.w, sy = sb.y + sb.h / 2;
    const tx = tb.x, ty = tb.y + tb.h / 2;
    const mx = (sx + tx) / 2;
    return `<bpmndi:BPMNEdge bpmnElement="${e.id}" id="BPMNEdge_${e.id}"><omgdi:waypoint x="${sx}.0" y="${sy}.0"/><omgdi:waypoint x="${mx}.0" y="${sy}.0"/><omgdi:waypoint x="${mx}.0" y="${ty}.0"/><omgdi:waypoint x="${tx}.0" y="${ty}.0"/></bpmndi:BPMNEdge>`;
  }).filter(Boolean).join('\n    ');

  const diagram = `
  <bpmndi:BPMNDiagram id="BPMNDiagram_${spec.processKey}">
    <bpmndi:BPMNPlane bpmnElement="${spec.processKey}" id="BPMNPlane_${spec.processKey}">
    ${shapes}
    ${edgeXml}
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>`;

  // 插到 </bpmn:process> 之后、</bpmn:definitions> 之前
  // buildNoDiXml 输出 <bpmn:definitions ...>（带 bpmn 前缀），需补 bpmndi/omgdc/omgdi 命名空间声明
  if (noDiXml.includes('<bpmndi:BPMNDiagram')) return noDiXml;
  let xml = noDiXml;
  // 补命名空间到 definitions 根标签（兼容 <definitions 和 <bpmn:definitions）
  if (!xml.includes('xmlns:bpmndi')) {
    xml = xml.replace(/<(bpmn:)?definitions\b([^>]*)>/, (full, prefix, attrs) =>
      `<${prefix || ''}definitions${attrs} xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:omgdc="http://www.omg.org/spec/DD/20100524/DC" xmlns:omgdi="http://www.omg.org/spec/DD/20100524/DI">`
    );
  }
  const endProcess = xml.includes('</bpmn:process>') ? '</bpmn:process>' : '</process>';
  return xml.replace(endProcess, `${endProcess}${diagram}`);
}

/**
 * 自动布局（含降级）：正常走 bpmn-auto-layout，含环流程失败时降级到 fallbackLayout
 * @returns {Promise<string>} 带坐标的 BPMN XML
 */
export async function autoLayout(noDiXml, spec) {
  try {
    return await layoutProcess(noDiXml);
  } catch (layoutErr) {
    console.log('⚠️ 自动布局失败（流程可能含环/回退边），降级到手动分层布局');
    console.log('   原始错误: ' + (layoutErr.message || layoutErr).toString().split('\n')[0]);
    return fallbackLayout(noDiXml, spec);
  }
}
