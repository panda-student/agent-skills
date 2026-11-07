// vsdx 1:1 重排（layout 层）：匹配流程 defJson 与 vsdx 图形 → 用 vsdx 坐标重写 defJson bounds/dockers 与 bpmnXml DI
// 匹配依据：名字 + 边标签 + 拓扑传播（flow-matcher.mjs）；未匹配节点/边保留原坐标并在报告列出
// 坐标变换：Visio 英寸（原点左下、y 向上）→ IBPM px（原点左上、y 向下）：X = x*S，Y = (pageH - y)*S
// 节点尺寸标准化（ht_flow 真实导出包实证，vsdx 文本框尺寸 98x59 会让设计器图形比例失调、docker 飘出导致连线断裂）：
//   defJson（设计器渲染）：StartEvent 30x30、EndEvent 28x28、网关 40x40、Task 高 46 宽 max(100, vsdx 宽)
//   DI（查看/配置页渲染）：StartEvent/EndEvent 36x36、网关 50x50、Task 100x80
// dockers 约定（真实导出包实证）：首点=源节点中心相对左上角偏移、末点=目标节点中心相对左上角偏移、中间点画布绝对坐标
// 用法（库）：const { zipPath, nodeMap, edgeMap } = await relayoutFromVsdx('flow.zip', 'flow.vsdx', { output, scale })
import { rmSync } from 'node:fs';
import { parseVsdx } from '../parse/parse-vsdx.mjs';
import { matchFlow } from './flow-matcher.mjs';
import { optimizeRoutes } from './route-optimizer.mjs';
import { buildDiSection, spliceDi } from '../lib/di-xml.mjs';
import { boundaryExit } from '../lib/geometry.mjs';
import { extractFlowZip, readBpmDefs, writeBpmDefs, repackFlowZip } from '../lib/zip-io.mjs';

const STENCIL_TO_TYPE = {
  StartEvent: 'startEvent',
  EndEvent: 'endEvent',
  UserTask: 'userTask',
  Task: 'task',
  ServiceTask: 'serviceTask',
  ManualTask: 'manualTask',
  SendTask: 'sendTask',
  ReceiveTask: 'receiveTask',
  ScriptTask: 'scriptTask',
  BusinessRuleTask: 'businessRuleTask',
  XORGateway: 'exclusiveGateway',
  ANDGateway: 'parallelGateway',
  ORGateway: 'inclusiveGateway',
  Subprocess: 'subProcess',
};

const GATEWAYS = ['XORGateway', 'ANDGateway', 'ORGateway'];
const isTaskStencil = (st) => /Task$/.test(st) || st === 'Subprocess';

const defSizeOf = (stencil, vsdxWidth) => {
  if (stencil === 'StartEvent') return { w: 30, h: 30 };
  if (stencil === 'EndEvent') return { w: 28, h: 28 };
  if (GATEWAYS.includes(stencil)) return { w: 40, h: 40 };
  if (isTaskStencil(stencil)) return { w: Math.max(100, Math.round(vsdxWidth)), h: 46 };
  return null;
};
// DI 尺寸必须与 defJson 一致（线上包实证：事件 30/28、网关 40、任务高 46、宽沿用 defJson）
const diSizeOf = (stencil, defWidth) => {
  if (stencil === 'StartEvent') return { w: 30, h: 30 };
  if (stencil === 'EndEvent') return { w: 28, h: 28 };
  if (GATEWAYS.includes(stencil)) return { w: 40, h: 40 };
  if (isTaskStencil(stencil)) return { w: Math.max(100, Math.round(defWidth || 100)), h: 46 };
  return null;
};

const rectOf = (c) => {
  const b = c.bounds;
  const x = +b.upperLeft.x, y = +b.upperLeft.y;
  return { x, y, w: +b.lowerRight.x - x, h: +b.lowerRight.y - y };
};

/**
 * 用 vsdx 坐标 1:1 重排流程 ZIP
 * @param {string} zipPath - 流程 zip
 * @param {string} vsdxPath - 原始 vsdx
 * @param {object} [options]
 * @param {string} [options.output] - 输出 zip 路径（默认 <input>.relayout.zip）
 * @param {number} [options.scale] - px/英寸（默认 100）
 * @param {number} [options.pad] - 画布边距（默认 60）
 * @returns {Promise<{zipPath: string, nodeMap: Map, edgeMap: Map, unmatchedNodes: Array, unmatchedEdges: Array}>}
 */
export async function relayoutFromVsdx(zipPath, vsdxPath, options = {}) {
  const scale = options.scale ?? 100;
  const pad = options.pad ?? 60;
  const vsdx = parseVsdx(vsdxPath);
  const { workDir, innerDir, innerName } = extractFlowZip(zipPath);
  try {
    const { bpmnXml, defJson } = readBpmDefs(innerDir);

    // ---- defJson 结构化：节点（overrideid 索引）/ 边（resourceId 即 bpmnXml flow id）----
    const allShapes = [];
    (function walk(sh) { for (const c of sh || []) { allShapes.push(c); walk(c.childShapes); } })(defJson.childShapes);
    const nodeShapes = allShapes.filter(c => c.stencil?.id !== 'SequenceFlow');
    const edgeShapes = allShapes.filter(c => c.stencil?.id === 'SequenceFlow');
    const nodeByRid = new Map(nodeShapes.map(c => [c.resourceId, c]));
    const nodeByOid = new Map();
    for (const c of nodeShapes) if (c.properties?.overrideid) nodeByOid.set(c.properties.overrideid, c);
    const srcRidOfEdge = new Map();
    for (const n of nodeShapes) for (const out of n.outgoing || []) srcRidOfEdge.set(out.resourceId, n.resourceId);

    const bpmNodes = nodeShapes.map(c => ({
      id: c.properties?.overrideid || c.resourceId,
      name: c.properties?.name || '',
      type: STENCIL_TO_TYPE[c.stencil?.id] || 'task',
    }));
    const bpmEdges = [];
    for (const c of edgeShapes) {
      const src = nodeByRid.get(srcRidOfEdge.get(c.resourceId));
      const tgt = nodeByRid.get(c.outgoing?.[0]?.resourceId);
      if (!src || !tgt) continue;
      bpmEdges.push({ id: c.resourceId, name: c.properties?.name || '', srcId: src.properties?.overrideid, tgtId: tgt.properties?.overrideid });
    }

    // ---- 匹配 ----
    const { nodeMap, edgeMap, unmatchedNodes, unmatchedEdges, report } = matchFlow({ nodes: bpmNodes, edges: bpmEdges }, vsdx);
    for (const line of report) console.log(line);
    // 输入预检（生成前 fail-fast）：未匹配项多说明源 vsdx 版本过旧——先确认版本再重排，
    // 兜底重路由会让网关多出线共线拥挤
    if (unmatchedNodes.length || unmatchedEdges.length) {
      console.log(`⚠️ 输入预检: 未匹配节点 ${unmatchedNodes.length} 个 / 未匹配边 ${unmatchedEdges.length} 条 —— 源 vsdx 疑似版本过旧`);
      console.log('   建议先向用户确认 vsdx 是否最新版本；未匹配边将走兜底路由，网关多出线易共线拥挤');
    }

    // ---- 节点：vsdx 坐标 → defJson bounds（位置取 vsdx 中心，尺寸按 IBPM stencil 标准化）----
    const S = scale, PH = vsdx.pageHeight;
    const vsdxNodeById = new Map(vsdx.nodes.map(n => [n.id, n]));
    let movedNodes = 0;
    for (const [oid, vid] of nodeMap) {
      const shape = nodeByOid.get(oid);
      const v = vsdxNodeById.get(vid);
      if (!shape || !v || v.x == null || v.y == null || v.w == null || v.h == null) continue;
      const size = defSizeOf(shape.stencil?.id, v.w * S);
      if (!size) continue;
      const cx = (v.x + v.w / 2) * S;
      const cy = (PH - (v.y + v.h / 2)) * S;
      shape.bounds = {
        upperLeft: { x: Math.round(cx - size.w / 2), y: Math.round(cy - size.h / 2) },
        lowerRight: { x: Math.round(cx + size.w / 2), y: Math.round(cy + size.h / 2) },
      };
      movedNodes++;
    }

    // ---- 未匹配节点：旧布局坐标系已失效，按已匹配邻居质心重新定位（尺寸同步标准化）----
    let relocatedNodes = 0;
    for (const c of nodeShapes) {
      const oid = c.properties?.overrideid;
      if (!oid || nodeMap.has(oid)) continue;
      const size = defSizeOf(c.stencil?.id, rectOf(c).w);
      if (!size) continue;
      const nbs = [];
      for (const e of bpmEdges) {
        if (e.tgtId === oid && nodeMap.has(e.srcId)) { const s = nodeByOid.get(e.srcId); if (s) nbs.push(rectOf(s)); }
        if (e.srcId === oid && nodeMap.has(e.tgtId)) { const t = nodeByOid.get(e.tgtId); if (t) nbs.push(rectOf(t)); }
      }
      if (!nbs.length) continue;
      const cx = nbs.reduce((s, r) => s + r.x + r.w / 2, 0) / nbs.length;
      const cy = nbs.reduce((s, r) => s + r.y + r.h / 2, 0) / nbs.length;
      c.bounds = { upperLeft: { x: Math.round(cx - size.w / 2), y: Math.round(cy - size.h / 2) }, lowerRight: { x: Math.round(cx + size.w / 2), y: Math.round(cy + size.h / 2) } };
      relocatedNodes++;
    }

    // ---- 边：matched 用 vsdx 折线，未匹配从旧 dockers 重建（供画布归一与 DI）----
    const vsdxEdgeById = new Map(vsdx.edges.map(e => [e.lineId, e]));
    const edgeFinal = [];
    const fallbackEdgeIds = new Set();
    for (const eShape of edgeShapes) {
      const src = nodeByRid.get(srcRidOfEdge.get(eShape.resourceId));
      const tgt = nodeByRid.get(eShape.outgoing?.[0]?.resourceId);
      if (!src || !tgt) continue;
      const srcOid = src.properties?.overrideid, tgtOid = tgt.properties?.overrideid;
      const ve = edgeMap.has(eShape.resourceId) ? vsdxEdgeById.get(edgeMap.get(eShape.resourceId)) : null;
      let pts = null;
      if (ve) {
        const raw = ve.points.length >= 2 ? ve.points
          : (ve.beginX != null && ve.endX != null ? [{ x: ve.beginX, y: ve.beginY }, { x: ve.endX, y: ve.endY }] : null);
        if (raw) pts = raw.map(p => ({ x: Math.round(p.x * S), y: Math.round((PH - p.y) * S) }));
      }
      if (pts) {
        // 折线端点须贴近两端节点（网关未匹配时其边可能配上源不符的 vsdx 折线）
        const near = (p, r, tol) => p.x >= r.x - tol && p.x <= r.x + r.w + tol && p.y >= r.y - tol && p.y <= r.y + r.h + tol;
        const srNow = rectOf(src), trNow = rectOf(tgt);
        if (!near(pts[0], srNow, 50) || !near(pts[pts.length - 1], trNow, 50)) pts = null;
      }
      if (!pts) {
        // 未匹配边：旧折线坐标系已失效，先以源/目标中心正交 L 形兜底，随后交给优化器重路由
        const sr = rectOf(src), tr = rectOf(tgt);
        const sc = { x: sr.x + sr.w / 2, y: sr.y + sr.h / 2 };
        const tc = { x: tr.x + tr.w / 2, y: tr.y + tr.h / 2 };
        pts = Math.abs(tc.x - sc.x) >= Math.abs(tc.y - sc.y)
          ? [sc, { x: tc.x, y: sc.y }, tc]
          : [sc, { x: sc.x, y: tc.y }, tc];
        fallbackEdgeIds.add(eShape.resourceId);
      }
      if (pts) edgeFinal.push({ id: eShape.resourceId, shape: eShape, pts, srcOid, tgtOid });
    }
    const movedEdges = edgeFinal.filter(e => edgeMap.has(e.id)).length;

    // ---- 兜底边重路由：锁定全部 vsdx 已匹配折线（1:1 保真），仅对兜底边坐标下降消除穿节点 ----
    if (fallbackEdgeIds.size) {
      const optNodes = [...nodeByOid].map(([oid, c]) => ({ id: oid, ...rectOf(c) }));
      const optEdgeById = new Map();
      const optEdges = edgeFinal.map(e => {
        const oe = { id: e.id, srcId: e.srcOid, tgtId: e.tgtOid, pts: e.pts };
        optEdgeById.set(e.id, oe);
        return oe;
      });
      const lockedIds = edgeFinal.filter(e => !fallbackEdgeIds.has(e.id)).map(e => e.id);
      const result = optimizeRoutes(optNodes, optEdges, { locked: lockedIds });
      for (const e of edgeFinal) {
        if (fallbackEdgeIds.has(e.id)) e.pts = optEdgeById.get(e.id).pts;
      }
      for (const e of edgeFinal) if (fallbackEdgeIds.has(e.id)) {
        console.log(`  兜底边: ${e.id} "${e.shape.properties?.name || ''}" (${nodeByOid.get(e.srcOid)?.properties?.name} → ${nodeByOid.get(e.tgtOid)?.properties?.name})`);
      }
      console.log(`✓ 兜底边重路由: ${fallbackEdgeIds.size} 条（残留穿节点=${result.residualNode}, 边冲突=${result.residualEdge}）`);
    }

    // ---- 画布归一：内容 bbox 居中 + 边距，全部节点/边平移 ----
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const c of nodeShapes) {
      const r = rectOf(c);
      minX = Math.min(minX, r.x); minY = Math.min(minY, r.y);
      maxX = Math.max(maxX, r.x + r.w); maxY = Math.max(maxY, r.y + r.h);
    }
    for (const e of edgeFinal) for (const p of e.pts) {
      minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
    }
    const canvasW = Math.max(480, Math.ceil(maxX - minX) + 2 * pad);
    const canvasH = Math.max(240, Math.ceil(maxY - minY) + 2 * pad);
    const shiftX = Math.floor((canvasW - (maxX - minX)) / 2) - minX;
    const shiftY = Math.floor((canvasH - (maxY - minY)) / 2) - minY;
    for (const c of nodeShapes) {
      const r = rectOf(c);
      c.bounds = { upperLeft: { x: r.x + shiftX, y: r.y + shiftY }, lowerRight: { x: r.x + r.w + shiftX, y: r.y + r.h + shiftY } };
    }
    // ---- 边 dockers/bounds 写回（平移不改变首末相对偏移，中间点同步平移）----
    // defJson dockers（真实导出包实证）：首末=节点中心相对左上角偏移、中间点=画布绝对坐标
    // DI waypoints（ht_flow 实证 59/59）：网关端必须落在菱形顶点（主轴吸附）、事件端落在圆上、任务端在矩形边界
    const samePoint = (a, b) => Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01;
    const diRectOf = (c) => {
      const r = rectOf(c);
      const size = diSizeOf(c.stencil?.id, r.w);
      if (!size) return { id: c.properties?.overrideid, ...r };
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      return { id: c.properties?.overrideid, x: Math.round(cx - size.w / 2), y: Math.round(cy - size.h / 2), w: size.w, h: size.h };
    };
    const shapeExit = (from, to, rect, stencil) => {
      const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
      const dx = to.x - from.x, dy = to.y - from.y;
      if (GATEWAYS.includes(stencil)) {
        return Math.abs(dx) >= Math.abs(dy)
          ? { x: cx + Math.sign(dx) * rect.w / 2, y: cy }
          : { x: cx, y: cy + Math.sign(dy) * rect.h / 2 };
      }
      if (stencil === 'StartEvent' || stencil === 'EndEvent') {
        const len = Math.hypot(dx, dy) || 1;
        return { x: cx + dx / len * rect.w / 2, y: cy + dy / len * rect.h / 2 };
      }
      return boundaryExit(from, to, rect);
    };
    // 网关端首段正交引导：defJson 线从节点中心穿出，轴向出发才落在菱形顶点上（斜向会穿斜边"连到边上"）
    const gwGuide = (node, midPt) => {
      if (!node || !GATEWAYS.includes(node.stencil?.id)) return null;
      const r = rectOf(node);
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      const dx = midPt.x - cx, dy = midPt.y - cy;
      if (Math.abs(dx) < 0.6 || Math.abs(dy) < 0.6) return null;
      if (Math.abs(dx) > r.w / 2 + 2) return { x: midPt.x, y: cy };
      if (Math.abs(dy) > r.h / 2 + 2) return { x: cx, y: midPt.y };
      return null;
    };
    // vsdx 粘附点近菱形顶点：吸附为精确顶点（作为折线保留点，线从中心经顶点穿出，最贴合 vsdx 视觉）
    const vertexSnap = (node, anchorPt) => {
      if (!node || !GATEWAYS.includes(node.stencil?.id)) return null;
      const r = rectOf(node);
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      const dx = anchorPt.x - cx, dy = anchorPt.y - cy;
      if (Math.abs(dx) < 0.6 || Math.abs(dy) < 0.6) return null;
      const verts = [[cx + r.w / 2, cy], [cx - r.w / 2, cy], [cx, cy + r.h / 2], [cx, cy - r.h / 2]];
      for (const [vx, vy] of verts) {
        if (Math.abs(anchorPt.x - vx) < 3.5 && Math.abs(anchorPt.y - vy) < 3.5) return { x: vx, y: vy };
      }
      return null;
    };
    for (const e of edgeFinal) {
      for (const p of e.pts) { p.x += shiftX; p.y += shiftY; }
      const src = nodeByOid.get(e.srcOid), tgt = nodeByOid.get(e.tgtOid);
      const isGw = (n) => n && GATEWAYS.includes(n.stencil?.id);
      const headAnchor = vertexSnap(src, e.pts[0]);
      const tailAnchor = vertexSnap(tgt, e.pts[e.pts.length - 1]);
      // 2 点直连边且含网关端（未吸附顶点）：L 化拐点保证网关端轴向穿顶点（斜直线会穿菱形斜边）
      if (e.pts.length === 2 && !headAnchor && !tailAnchor && (isGw(src) || isGw(tgt))) {
        const sr2 = src ? rectOf(src) : null, tr2 = tgt ? rectOf(tgt) : null;
        const c = sr2 ? { x: sr2.x + sr2.w / 2, y: sr2.y + sr2.h / 2 } : e.pts[0];
        const o = tr2 ? { x: tr2.x + tr2.w / 2, y: tr2.y + tr2.h / 2 } : e.pts[1];
        if (Math.abs(o.x - c.x) > 0.6 && Math.abs(o.y - c.y) > 0.6) {
          e.pts.splice(1, 0, Math.abs(o.x - c.x) >= Math.abs(o.y - c.y) ? { x: o.x, y: c.y } : { x: c.x, y: o.y });
        }
      }
      // 插入正交引导拐点（仅对有中间折点的边，已吸附顶点的端跳过）
      const gEnd = !tailAnchor && e.pts.length >= 3 ? gwGuide(tgt, e.pts[e.pts.length - 2]) : null;
      const gStart = !headAnchor && e.pts.length >= 3 ? gwGuide(src, e.pts[1]) : null;
      if (gStart) e.pts.splice(1, 0, gStart);
      if (gEnd) e.pts.splice(e.pts.length - 1, 0, gEnd);
      const sr = src ? rectOf(src) : null, tr = tgt ? rectOf(tgt) : null;
      const dr = src ? diRectOf(src) : null, dt = tgt ? diRectOf(tgt) : null;
      const lastIdx = e.pts.length - 1;
      const rawMids = e.pts.slice(1, -1);
      const defMids = [...(headAnchor ? [headAnchor] : []), ...rawMids, ...(tailAnchor ? [tailAnchor] : [])];
      e.shape.dockers = [
        sr ? { x: sr.w / 2, y: sr.h / 2 } : e.pts[0],
        ...defMids,
        tr ? { x: tr.w / 2, y: tr.h / 2 } : e.pts[lastIdx],
      ];
      const sc = sr ? { x: sr.x + sr.w / 2, y: sr.y + sr.h / 2 } : e.pts[0];
      const tc = tr ? { x: tr.x + tr.w / 2, y: tr.y + tr.h / 2 } : e.pts[lastIdx];
      const poly = [sc, ...defMids, tc];
      e.shape.bounds = {
        upperLeft: { x: Math.min(...poly.map(p => p.x)), y: Math.min(...poly.map(p => p.y)) },
        lowerRight: { x: Math.max(...poly.map(p => p.x)), y: Math.max(...poly.map(p => p.y)) },
      };
      const dsc = dr ? { x: dr.x + dr.w / 2, y: dr.y + dr.h / 2 } : e.pts[0];
      const dtc = dt ? { x: dt.x + dt.w / 2, y: dt.y + dt.h / 2 } : e.pts[lastIdx];
      const firstRef = headAnchor ?? (rawMids.length ? (samePoint(dsc, rawMids[0]) ? dtc : rawMids[0]) : dtc);
      const lastRef = tailAnchor ?? (rawMids.length ? (samePoint(dtc, rawMids[rawMids.length - 1]) ? dsc : rawMids[rawMids.length - 1]) : dsc);
      e.diPts = [
        dr ? shapeExit(dsc, firstRef, dr, src.stencil?.id) : e.pts[0],
        ...rawMids,
        dt ? shapeExit(dtc, lastRef, dt, tgt.stencil?.id) : e.pts[lastIdx],
      ];
      // DI 折线正交归一：<1.5px 的微小斜差对齐为严格水平/垂直（vsdx 折点带小数导致）
      for (let i = 0; i + 1 < e.diPts.length; i++) {
        const p = e.diPts[i], q = e.diPts[i + 1];
        const dx = Math.abs(p.x - q.x), dy = Math.abs(p.y - q.y);
        if (dx > 0 && dx <= 1.5) { const mid = Math.round((p.x + q.x) / 2); p.x = mid; q.x = mid; }
        else if (dy > 0 && dy <= 1.5) { const mid = Math.round((p.y + q.y) / 2); p.y = mid; q.y = mid; }
      }
    }
    defJson.bounds = { upperLeft: { x: 0, y: 0 }, lowerRight: { x: canvasW, y: canvasH } };
    console.log(`✓ 重排: 节点 ${movedNodes}/${nodeShapes.length}${relocatedNodes ? `（另 ${relocatedNodes} 个未匹配按邻居质心重定位）` : ''}, 边 ${movedEdges}/${edgeShapes.length}; 画布 ${canvasW}x${canvasH}, 平移 (${shiftX},${shiftY}), scale=${S}px/in`);

    // ---- DI 重写（节点用 DI 标准尺寸矩形，边首末 waypoint 已做边界投影，中间点为 vsdx 折点）----
    const diNodeRects = [...nodeByOid].map(([, c]) => diRectOf(c));
    const procKey = defJson.properties?.process_id || 'flow';
    const newBpmnXml = spliceDi(bpmnXml, buildDiSection(diNodeRects, edgeFinal.map(e => ({ id: e.id, diPts: e.diPts })), procKey));

    // ---- 重组 + 重打包 ----
    writeBpmDefs(innerDir, newBpmnXml, defJson);
    const outZip = options.output || zipPath.replace(/\.zip$/i, '') + '.relayout.zip';
    await repackFlowZip(innerDir, innerName, outZip);
    console.log(`✅ vsdx 重排完成: ${outZip}`);
    return { zipPath: outZip, nodeMap, edgeMap, unmatchedNodes, unmatchedEdges };
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}
