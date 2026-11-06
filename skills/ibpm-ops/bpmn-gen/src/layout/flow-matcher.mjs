// 流程匹配器：defJson（bpmnXml 侧）节点/边 ↔ vsdx 解析结果的节点/边 自动映射
// 三重信号：名字（含包含/分词相似度）、边标签（条件文本）、拓扑（已匹配邻点传播）
// 网关在 vsdx 里常是「判断N」泛称，靠邻边标签与拓扑锚定
// 用法（库）：const { nodeMap, edgeMap, unmatched } = matchFlow(bpm, vsdx)
//
// 输入:
//   bpm:  { nodes: [{id, name, type}], edges: [{id, srcId, tgtId, name}] }  type=startEvent|userTask|endEvent|exclusiveGateway|...
//   vsdx: { nodes: [{id, text}], edges: [{lineId, srcId, tgtId, text}] }

const GATEWAY_STENCILS = new Set(['XORGateway', 'ANDGateway', 'ORGateway']);
const EVENT_STENCILS = new Set(['StartEvent', 'EndEvent']);

const norm = (s) => (s || '').replace(/\s+/g, '').replace(/[（）()]/g, '');

function tokenize(s) {
  return new Set(s.split(/[，,、／/；;：:≥≤＝=<>!？?"'“”‘’\[\]〔〕{}（）()]+/).filter(t => t.length >= 2));
}

function nameSim(a, b) {
  a = norm(a); b = norm(b);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.85;
  const at = tokenize(a), bt = tokenize(b);
  if (!at.size || !bt.size) return 0;
  let inter = 0;
  for (const t of at) if (bt.has(t)) inter++;
  return inter / Math.max(at.size, bt.size) * 0.5;
}

// vsdx 节点是否疑似网关（菱形 master 7 / 判断N 泛称 / 是否…问句 / 含比较符）
function vsdxLooksGateway(node) {
  if (node.master === '7') return true;
  const t = norm(node.text);
  if (!t) return false;
  if (/^判断[\d.]*$/.test(t)) return true;
  return /是否|≥|≤|＞|＜/.test(t);
}

function typeCompatible(bpmNode, vsdxNode) {
  const bpmGateway = bpmNode.type === 'exclusiveGateway' || bpmNode.type === 'parallelGateway' || bpmNode.type === 'inclusiveGateway';
  const vsdxGateway = vsdxLooksGateway(vsdxNode);
  if (bpmGateway && /^判断[\d.]*$/.test(norm(vsdxNode.text))) return true; // 判断N 只允许配网关
  if (bpmGateway !== vsdxGateway) return false;
  if ((bpmNode.type === 'startEvent' || bpmNode.type === 'endEvent') && !/^(开始|结束)/.test(norm(vsdxNode.text))) return false;
  if (bpmNode.type !== 'startEvent' && bpmNode.type !== 'endEvent' && /^(开始|结束)/.test(norm(vsdxNode.text))) return false;
  return true;
}

/**
 * @param {{nodes: Array, edges: Array}} bpm
 * @param {{nodes: Array, edges: Array}} vsdx
 * @returns {{nodeMap: Map, edgeMap: Map, unmatchedNodes: Array, unmatchedEdges: Array}}
 */
export function matchFlow(bpm, vsdx) {
  const nodeMap = new Map();   // bpm 节点 id → vsdx 节点 id
  const revNodeMap = new Map(); // vsdx 节点 id → bpm 节点 id
  const edgeMap = new Map();   // bpm 边 id → vsdx lineId
  const report = [];

  const bpmById = new Map(bpm.nodes.map(n => [n.id, n]));
  const vsdxById = new Map(vsdx.nodes.map(n => [n.id, n]));
  const bpmOut = new Map(), bpmIn = new Map();
  for (const e of bpm.edges) {
    if (!bpmOut.has(e.srcId)) bpmOut.set(e.srcId, []);
    bpmOut.get(e.srcId).push(e);
    if (!bpmIn.has(e.tgtId)) bpmIn.set(e.tgtId, []);
    bpmIn.get(e.tgtId).push(e);
  }
  const vsdxOut = new Map(), vsdxIn = new Map();
  for (const e of vsdx.edges) {
    if (e.srcId == null || e.tgtId == null) continue;
    if (!vsdxOut.has(e.srcId)) vsdxOut.set(e.srcId, []);
    vsdxOut.get(e.srcId).push(e);
    if (!vsdxIn.has(e.tgtId)) vsdxIn.set(e.tgtId, []);
    vsdxIn.get(e.tgtId).push(e);
  }

  const match = (bpmId, vsdxId) => {
    if (nodeMap.has(bpmId) || revNodeMap.has(vsdxId)) return false;
    nodeMap.set(bpmId, vsdxId);
    revNodeMap.set(vsdxId, bpmId);
    return true;
  };

  // ---- 1. 种子：双向唯一名字精确匹配 ----
  for (const bn of bpm.nodes) {
    const cands = vsdx.nodes.filter(vn => typeCompatible(bn, vn) && norm(vn.text) === norm(bn.name));
    if (cands.length === 1) {
      const rivals = bpm.nodes.filter(o => o !== bn && typeCompatible(o, cands[0]) && norm(o.name) === norm(cands[0].text));
      if (rivals.length === 0) match(bn.id, cands[0].id);
    }
  }

  // ---- 2. 传播：从已匹配节点对出发，按 出边标签相似度+目标名字相似度 配对邻边，推出新节点匹配 ----
  // 网关在 vsdx 是「判断N」泛称、边标签是条件表达式，名字/标签信号常为 0：
  // 靠拓扑锚定——1:1 唯一邻边 +0.5；已匹配目标锚定经 nameScore 兑现；边配对需 ≥0.3 防错配
  const propagate = (bpmEdgesOf, vsdxEdgesOf) => {
    let progress = false;
    for (const [bpmId, vsdxId] of nodeMap) {
      const bEdges = (bpmEdgesOf.get(bpmId) || []).filter(e => !edgeMap.has(e.id));
      const vEdges = (vsdxEdgesOf.get(vsdxId) || []).filter(e => ![...edgeMap.values()].includes(e.lineId));
      if (!bEdges.length || !vEdges.length) continue;
      const uniquePair = bEdges.length === 1 && vEdges.length === 1 ? 0.5 : 0;
      const pairs = [];
      for (const be of bEdges) {
        for (const ve of vEdges) {
          const labelScore = Math.max(nameSim(be.name, ve.text), be.name && ve.text && (norm(ve.text).includes(norm(be.name)) || norm(be.name).includes(norm(ve.text))) ? 0.8 : 0);
          const bOther = be === undefined ? null : (bpmEdgesOf === bpmOut ? bpmById.get(be.tgtId) : bpmById.get(be.srcId));
          const vOther = vsdxEdgesOf === vsdxOut ? vsdxById.get(ve.tgtId) : vsdxById.get(ve.srcId);
          let nameScore = 0;
          if (bOther && vOther) {
            const already = vOther && revNodeMap.has(vOther.id) ? (revNodeMap.get(vOther.id) === bOther.id ? 1 : 0) : nameSim(bOther.name, vOther.text);
            nameScore = already;
          }
          const typeScore = bOther && vOther && typeCompatible(bOther, vOther) ? 0.15 : 0;
          pairs.push({ be, ve, score: labelScore * 0.55 + nameScore * 0.45 + typeScore + uniquePair });
        }
      }
      pairs.sort((a, b) => b.score - a.score);
      const usedB = new Set(), usedV = new Set();
      for (const p of pairs) {
        if (usedB.has(p.be.id) || usedV.has(p.ve.lineId)) continue;
        usedB.add(p.be.id); usedV.add(p.ve.lineId);
        if (p.score < 0.3) continue; // 低置信边不进 edgeMap（坐标来源不可靠）
        edgeMap.set(p.be.id, p.ve.lineId);
        const bOther = bpmEdgesOf === bpmOut ? bpmById.get(p.be.tgtId) : bpmById.get(p.be.srcId);
        const vOther = vsdxEdgesOf === vsdxOut ? vsdxById.get(p.ve.tgtId) : vsdxById.get(p.ve.srcId);
        if (bOther && vOther && p.score >= 0.35 && typeCompatible(bOther, vOther)) match(bOther.id, vOther.id);
      }
      if (usedB.size) progress = true;
    }
    return progress;
  };

  for (let round = 0; round < 10; round++) {
    const a = propagate(bpmOut, vsdxOut);
    const b = propagate(bpmIn, vsdxIn);
    if (!a && !b) break;
  }

  // ---- 3. 全局兜底：未匹配 bpm 节点按 名字相似度+已匹配邻居重合度 贪心配对（一对一）----
  // 重名节点（业务财务/项目专员/PMO 等）名字分相同，靠邻居重合度区分错位
  const neighborOverlap = (bn, vn) => {
    let hit = 0, total = 0;
    for (const e of (bpmOut.get(bn.id) || [])) {
      const tv = nodeMap.get(e.tgtId);
      if (tv == null) continue;
      total++;
      if ((vsdxOut.get(vn.id) || []).some(ve => ve.tgtId === tv)) hit++;
    }
    for (const e of (bpmIn.get(bn.id) || [])) {
      const sv = nodeMap.get(e.srcId);
      if (sv == null) continue;
      total++;
      if ((vsdxIn.get(vn.id) || []).some(ve => ve.srcId === sv)) hit++;
    }
    return total ? hit / total : 0;
  };
  const unmatchedBpmNodes = bpm.nodes.filter(n => !nodeMap.has(n.id));
  unmatchedBpmNodes.sort((a, b) => ((bpmOut.get(b.id) || []).length + (bpmIn.get(b.id) || []).length) - ((bpmOut.get(a.id) || []).length + (bpmIn.get(a.id) || []).length));
  for (const bn of unmatchedBpmNodes) {
    if (nodeMap.has(bn.id)) continue;
    let best = null;
    for (const vn of vsdx.nodes) {
      if (revNodeMap.has(vn.id)) continue;
      if (!typeCompatible(bn, vn)) continue;
      const score = nameSim(bn.name, vn.text) * 0.7 + neighborOverlap(bn, vn) * 0.3;
      if (score > 0 && (!best || score > best.score)) best = { vn, score };
    }
    if (best && best.score >= 0.5) match(bn.id, best.vn.id);
  }

  // ---- 4. 边匹配：端点对齐优先，标签相似度兜底 ----
  const vsdxEdgeByEndpoints = new Map(); // "src|tgt" → [edges]
  for (const e of vsdx.edges) {
    if (e.srcId == null || e.tgtId == null) continue;
    const key = `${e.srcId}|${e.tgtId}`;
    if (!vsdxEdgeByEndpoints.has(key)) vsdxEdgeByEndpoints.set(key, []);
    vsdxEdgeByEndpoints.get(key).push(e);
  }
  const usedVsdxEdge = new Set(edgeMap.values());
  for (const be of bpm.edges) {
    if (edgeMap.has(be.id)) continue;
    const srcV = nodeMap.get(be.srcId), tgtV = nodeMap.get(be.tgtId);
    let picked = null;
    if (srcV != null && tgtV != null) {
      const cands = (vsdxEdgeByEndpoints.get(`${srcV}|${tgtV}`) || []).filter(e => !usedVsdxEdge.has(e.lineId));
      if (cands.length === 1) picked = cands[0];
      else if (cands.length > 1) {
        picked = cands.reduce((best, e) => nameSim(be.name, e.text) > nameSim(be.name, best.text) ? e : best, cands[0]);
      }
    }
    if (!picked) {
      let best = null;
      for (const ve of vsdx.edges) {
        if (ve.srcId == null || ve.tgtId == null || usedVsdxEdge.has(ve.lineId)) continue;
        const s = nameSim(be.name, ve.text);
        if (s >= 0.6 && (!best || s > best.score)) best = { ve, score: s };
      }
      if (best) picked = best.ve;
    }
    if (picked) { edgeMap.set(be.id, picked.lineId); usedVsdxEdge.add(picked.lineId); }
  }

  const unmatchedNodes = bpm.nodes.filter(n => !nodeMap.has(n.id)).map(n => n.id);
  const unmatchedEdges = bpm.edges.filter(e => !edgeMap.has(e.id)).map(e => e.id);

  report.push(`节点匹配: ${nodeMap.size}/${bpm.nodes.length}（vsdx 侧未用: ${vsdx.nodes.length - revNodeMap.size}）`);
  report.push(`边匹配: ${edgeMap.size}/${bpm.edges.length}（vsdx 侧未用: ${vsdx.edges.filter(e => e.srcId != null && e.tgtId != null).length - usedVsdxEdge.size}）`);
  for (const id of unmatchedNodes) {
    const n = bpmById.get(id);
    const outs = (bpmOut.get(id) || []).map(e => `${bpmById.get(e.tgtId)?.name}<-${e.name || '∅'}`);
    report.push(`  ⚠️ 未匹配节点 ${id}(${n?.name}) 出边: ${outs.join('; ') || '无'}`);
  }
  for (const id of unmatchedEdges) {
    const e = bpm.edges.find(x => x.id === id);
    report.push(`  ⚠️ 未匹配边 ${id}: ${bpmById.get(e.srcId)?.name} -> ${bpmById.get(e.tgtId)?.name} | ${e.name || '∅'}`);
  }
  return { nodeMap, edgeMap, revNodeMap, unmatchedNodes, unmatchedEdges, report };
}
