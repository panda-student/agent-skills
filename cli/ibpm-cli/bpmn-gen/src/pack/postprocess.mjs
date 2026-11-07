// 后处理流程 ZIP（pack 层）：
// 1. 用 defJson（relayout 后）的坐标重写 bpmnXml 的 BPMNDiagram 段（修复 DI 与 defJson 脱节）
// 2. 坐标下降优化边路由：修复 U 形回边共线/边穿节点/非端点交叉（layout/route-optimizer.mjs）
// 3. 重打包（archiver 正斜杠条目；.NET CreateFromDirectory 会产出反斜杠条目，IBPM 导入解析失败）
// 真实导出包实证：bpmnXml DI 与 defJson 坐标完全一致
// 用法（库）：const newZip = await postprocessZip('flow.zip', { rowsPath })

import { readFileSync, rmSync } from 'node:fs';
import { optimizeRoutes } from '../layout/route-optimizer.mjs';
import { boundaryExit } from '../lib/geometry.mjs';
import { buildDiSection, spliceDi } from '../lib/di-xml.mjs';
import { extractFlowZip, readBpmDefs, writeBpmDefs, repackFlowZip } from '../lib/zip-io.mjs';

/**
 * 后处理流程 ZIP：路由优化 + DI 重写 + 重打包
 * @param {string} zipPath - 输入 zip 路径
 * @param {object} [options]
 * @param {string} [options.rowsPath] - 可选行布局 JSON（{rowGap, gapX, rows:[[nodeId,...],...]}）
 * @param {string} [options.output] - 输出 zip 路径（默认 <input>.fixed.zip）
 * @returns {Promise<string>} 新 zip 路径
 */
export async function postprocessZip(zipPath, options = {}) {
  const rowsPath = options.rowsPath;
  const { workDir, innerDir, innerName } = extractFlowZip(zipPath);
  try {
    const { bpmnXml, defJson } = readBpmDefs(innerDir);

    // ---- 解析 defJson ----
    const nodeByRid = new Map();
    const nodeByOid = new Map();
    const edgeShapes = [];
    const walk = (sh) => {
      for (const c of sh || []) {
        if (c.stencil?.id === 'SequenceFlow') edgeShapes.push(c);
        else {
          nodeByRid.set(c.resourceId, c);
          const oid = c.properties?.overrideid;
          if (oid) nodeByOid.set(oid, c);
        }
        walk(c.childShapes);
      }
    };
    walk(defJson.childShapes);

    const srcOfEdge = new Map();
    for (const [, n] of nodeByRid) {
      for (const out of n.outgoing || []) srcOfEdge.set(out.resourceId, n.resourceId);
    }

    // ---- 构造优化器输入：节点矩形 + 边绝对折线 ----
    const nodes = [];
    const rectOf = (c) => {
      const b = c.bounds;
      const x = +b.upperLeft.x, y = +b.upperLeft.y;
      return { x, y, w: +b.lowerRight.x - x, h: +b.lowerRight.y - y };
    };
    for (const [oid, c] of nodeByOid) {
      const r = rectOf(c);
      nodes.push({ id: oid, ...r });
    }
    const nodeRectById = new Map(nodes.map(n => [n.id, n]));

    const edges = [];
    const edgeDockerInfo = new Map(); // edgeId → {srcOid, tgtOid, firstOffset, lastOffset}
    for (const e of edgeShapes) {
      const dockers = e.dockers || [];
      if (dockers.length < 2) continue;
      const srcRid = srcOfEdge.get(e.resourceId);
      const tgtRid = e.outgoing?.[0]?.resourceId;
      const src = nodeByRid.get(srcRid), tgt = nodeByRid.get(tgtRid);
      if (!src || !tgt) continue;
      const srcRect = rectOf(src), tgtRect = rectOf(tgt);
      const pts = [{ x: srcRect.x + +dockers[0].x, y: srcRect.y + +dockers[0].y }];
      for (let i = 1; i < dockers.length - 1; i++) pts.push({ x: +dockers[i].x, y: +dockers[i].y });
      pts.push({ x: tgtRect.x + +dockers[dockers.length - 1].x, y: tgtRect.y + +dockers[dockers.length - 1].y });
      edges.push({ id: e.resourceId, srcId: src.properties.overrideid, tgtId: tgt.properties.overrideid, pts });
      edgeDockerInfo.set(e.resourceId, {
        shape: e,
        srcOid: src.properties.overrideid, tgtOid: tgt.properties.overrideid,
        firstOffset: { x: +dockers[0].x, y: +dockers[0].y },
        lastOffset: { x: +dockers[dockers.length - 1].x, y: +dockers[dockers.length - 1].y },
      });
    }

    console.log(`优化前: 节点 ${nodes.length}, 边 ${edges.length}`);

    // ---- 可选：按行布局 JSON 重排节点坐标（保持 defJson 的节点尺寸，只改 x/y） ----
    if (rowsPath) {
      const rowsConf = JSON.parse(readFileSync(rowsPath, 'utf8'));
      const rowGap = rowsConf.rowGap ?? 170;
      const gapX = rowsConf.gapX ?? 50;
      const assigned = new Set();
      rowsConf.rows.forEach((row, rowIdx) => {
        let x = 0;
        const rowRects = row.map(oid => nodeRectById.get(oid)).filter(Boolean);
        const maxH = Math.max(...rowRects.map(r => r.h));
        for (const oid of row) {
          const n = nodeRectById.get(oid);
          const c = nodeByOid.get(oid);
          if (!n || !c) { console.warn(`⚠️ 行布局跳过未知节点: ${oid}`); continue; }
          const y = rowIdx * rowGap + Math.round((maxH - n.h) / 2); // 行内中心对齐
          c.bounds = {
            upperLeft: { x, y },
            lowerRight: { x: x + n.w, y: y + n.h },
          };
          n.x = x; n.y = y;
          x += n.w + gapX;
          assigned.add(oid);
        }
      });
      const unassigned = [...nodeByOid.keys()].filter(id => !assigned.has(id));
      if (unassigned.length) { throw new Error(`行布局遗漏节点: ${unassigned.join(',')}`); }
      // 边折线首末点同步到新节点中心（网关 0.5 偏移保持）
      for (const e of edges) {
        const info = edgeDockerInfo.get(e.id);
        const srcRect = nodeRectById.get(info.srcOid), tgtRect = nodeRectById.get(info.tgtOid);
        e.pts[0] = { x: srcRect.x + info.firstOffset.x, y: srcRect.y + info.firstOffset.y };
        e.pts[e.pts.length - 1] = { x: tgtRect.x + info.lastOffset.x, y: tgtRect.y + info.lastOffset.y };
        e.pts.splice(1, e.pts.length - 2); // 旧中间点失效，交给优化器重路由
      }
      console.log(`✓ 行布局重排: ${rowsConf.rows.length} 行`);
    }
    const result = optimizeRoutes(nodes, edges);
    console.log(`✓ 路由优化: ${result.rounds} 轮, 残留 穿节点=${result.residualNode} 边冲突=${result.residualEdge}`);
    if (result.residual.length) {
      console.log('  残留明细(前20):');
      result.residual.forEach(r => console.log('   ', r));
    }

    // ---- 写回 defJson：边 dockers 中间点 + bounds ----
    for (const e of result.edges) {
      const info = edgeDockerInfo.get(e.id);
      if (!info) continue;
      const mids = e.pts.slice(1, -1);
      info.shape.dockers = [info.firstOffset, ...mids, info.lastOffset];
      const xs = e.pts.map(p => p.x), ys = e.pts.map(p => p.y);
      info.shape.bounds = {
        upperLeft: { x: Math.min(...xs), y: Math.min(...ys) },
        lowerRight: { x: Math.max(...xs), y: Math.max(...ys) },
      };
    }

    // ---- 画布适配：重算 defJson 顶层 bounds（内容 + 对称边距 60） ----
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [, c] of nodeByOid) {
      const r = rectOf(c);
      minX = Math.min(minX, r.x); minY = Math.min(minY, r.y);
      maxX = Math.max(maxX, r.x + r.w); maxY = Math.max(maxY, r.y + r.h);
    }
    for (const e of result.edges) for (const p of e.pts) {
      minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
    }
    const PAD = 60;
    const canvasW = Math.max(480, Math.ceil(maxX - minX) + 2 * PAD);
    const canvasH = Math.max(240, Math.ceil(maxY - minY) + 2 * PAD);
    const shiftX = Math.floor((canvasW - (maxX - minX)) / 2) - minX;
    const shiftY = Math.floor((canvasH - (maxY - minY)) / 2) - minY;
    // 平移全部节点与边（首末 docker 相对偏移不动）
    for (const [, c] of nodeByOid) {
      const r = rectOf(c);
      c.bounds = {
        upperLeft: { x: r.x + shiftX, y: r.y + shiftY },
        lowerRight: { x: r.x + r.w + shiftX, y: r.y + r.h + shiftY },
      };
    }
    for (const e of result.edges) {
      for (const p of e.pts) { p.x += shiftX; p.y += shiftY; }
      const info = edgeDockerInfo.get(e.id);
      if (!info) continue;
      const mids = e.pts.slice(1, -1);
      info.shape.dockers = [info.firstOffset, ...mids, info.lastOffset];
      const xs = e.pts.map(p => p.x), ys = e.pts.map(p => p.y);
      info.shape.bounds = {
        upperLeft: { x: Math.min(...xs), y: Math.min(...ys) },
        lowerRight: { x: Math.max(...xs), y: Math.max(...ys) },
      };
    }
    defJson.bounds = { upperLeft: { x: 0, y: 0 }, lowerRight: { x: canvasW, y: canvasH } };
    console.log(`✓ 画布适配: ${canvasW}x${canvasH}, 平移 (${shiftX},${shiftY})`);

    // ---- 重写 bpmnXml DI 段（与 defJson 同步）----
    // DI 首末 waypoint 用形状边框交点而非中心（折线端点即中心，直接写中心会让 IBPM 流程图箭头指进形状内部）
    // 注意：矩形必须取画布平移后的实时 bounds（nodes 数组副本不随平移更新，用它会错坐标系）
    const samePoint = (a, b) => Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01;
    const edgeDi = result.edges.map((e) => {
      const srcRect = nodeByOid.get(e.srcId) ? rectOf(nodeByOid.get(e.srcId)) : null;
      const tgtRect = nodeByOid.get(e.tgtId) ? rectOf(nodeByOid.get(e.tgtId)) : null;
      const last = e.pts.length - 1;
      const firstRef = samePoint(e.pts[0], e.pts[1] ?? e.pts[0]) ? e.pts[last] : e.pts[1];
      const lastRef = samePoint(e.pts[last], e.pts[last - 1] ?? e.pts[last]) ? e.pts[0] : e.pts[last - 1];
      const first = srcRect ? boundaryExit(e.pts[0], firstRef, srcRect) : e.pts[0];
      const tail = tgtRect ? boundaryExit(e.pts[last], lastRef, tgtRect) : e.pts[last];
      return { id: e.id, diPts: [first, ...e.pts.slice(1, -1), tail] };
    });
    const nodeRects = [...nodeByOid].map(([oid, c]) => ({ id: oid, ...rectOf(c) }));
    const procKey = defJson.properties?.process_id || 'flow';
    const newBpmnXml = spliceDi(bpmnXml, buildDiSection(nodeRects, edgeDi, procKey));

    // ---- 重组 bpmdefs.flow.xml + 重打包 ----
    writeBpmDefs(innerDir, newBpmnXml, defJson);
    console.log(`✓ DI 段已重写: ${nodeByOid.size} Shape / ${result.edges.length} Edge`);

    const newZip = options.output || zipPath.replace(/\.zip$/, '') + '.fixed.zip';
    await repackFlowZip(innerDir, innerName, newZip);
    console.log(`✅ 后处理完成: ${newZip}`);
    return newZip;
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}
