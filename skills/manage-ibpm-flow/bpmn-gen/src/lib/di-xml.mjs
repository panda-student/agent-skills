// DI 段构建/替换（lib 层）：节点矩形 + 边 waypoint 列表 → bpmnXml 的 BPMNDiagram 段
// 首末 waypoint 须由调用方保证落在形状边界上（postprocess 用 boundaryExit 投影中心点；vsdx 重排直接用粘附点）
// ht_flow 真实导出包实证：DI 与 defJson 是两套独立布局（查看页/设计页各自渲染），DI 节点尺寸为
// 标准映射（事件 36x36、网关 50x50、任务 100x80），与 defJson 尺寸约定（30x30/28x28/40x40/高46）不同

const fmt = (v) => (Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100));

/**
 * 构建 BPMNDiagram 段
 * @param {Array<{id: string, x: number, y: number, w: number, h: number}>} nodeRects
 * @param {Array<{id: string, diPts: Array<{x: number, y: number}>}>} edges - diPts 为绝对坐标 waypoint 列表
 * @param {string} procKey - 流程 key（BPMNPlane bpmnElement）
 * @returns {string} BPMNDiagram XML 段
 */
export function buildDiSection(nodeRects, edges, procKey) {
  const shapeLines = [];
  for (const n of nodeRects) {
    shapeLines.push(`      <bpmndi:BPMNShape bpmnElement="${n.id}" id="BPMNShape_${n.id}">`);
    shapeLines.push(`        <omgdc:Bounds height="${fmt(n.h)}" width="${fmt(n.w)}" x="${fmt(n.x)}" y="${fmt(n.y)}"/>`);
    shapeLines.push(`      </bpmndi:BPMNShape>`);
  }
  const edgeLines = [];
  for (const e of edges) {
    edgeLines.push(`      <bpmndi:BPMNEdge bpmnElement="${e.id}" id="BPMNEdge_${e.id}">`);
    for (const p of e.diPts) edgeLines.push(`        <omgdi:waypoint x="${fmt(p.x)}" y="${fmt(p.y)}"/>`);
    edgeLines.push(`      </bpmndi:BPMNEdge>`);
  }
  return ['  <bpmndi:BPMNDiagram id="BPMNDiagram_' + procKey + '">',
    '    <bpmndi:BPMNPlane bpmnElement="' + procKey + '" id="BPMNPlane_' + procKey + '">',
    ...shapeLines, ...edgeLines,
    '    </bpmndi:BPMNPlane>',
    '  </bpmndi:BPMNDiagram>'].join('\n');
}

/**
 * 用新 DI 段替换 bpmnXml 中的 BPMNDiagram（无则插到 </process> 后）
 */
export function spliceDi(bpmnXml, newDi) {
  if (/<bpmndi:BPMNDiagram[\s\S]*?<\/bpmndi:BPMNDiagram>/.test(bpmnXml)) {
    return bpmnXml.replace(/<bpmndi:BPMNDiagram[\s\S]*?<\/bpmndi:BPMNDiagram>/, newDi);
  }
  return bpmnXml.replace(/<\/process>/, '</process>\n' + newDi);
}
