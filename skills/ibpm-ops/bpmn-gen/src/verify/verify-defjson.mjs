// 布局校验（defJson 为准）：从解压目录读 defJson，校验节点重叠/穿节点/共线/交叉/网关 docker/画布
// 用法（库）：const { ok, problems, warn } = verifyDefjson(dir)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 校验解压后流程目录的 defJson 几何
 * @param {string} dir - zip 解压后的流程目录
 * @returns {{ok: boolean, problems: string[], warn: string[]}}
 */
export function verifyDefjson(dir) {
  const raw = readFileSync(join(dir, 'bpmdefs.flow.xml'), 'utf8');
  const dec = raw.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  const defJson = JSON.parse(dec.match(/<defJson>([\s\S]*?)<\/defJson>/)?.[1]);

  const nodeByRid = new Map();
  const nodeByOid = new Map();
  const edgeShapes = [];
  const walk = (sh) => {
    for (const c of sh || []) {
      if (c.stencil?.id === 'SequenceFlow') edgeShapes.push(c);
      else {
        nodeByRid.set(c.resourceId, c);
        if (c.properties?.overrideid) nodeByOid.set(c.properties.overrideid, c);
      }
      walk(c.childShapes);
    }
  };
  walk(defJson.childShapes);
  const srcOfEdge = new Map();
  for (const [, n] of nodeByRid) for (const o of n.outgoing || []) srcOfEdge.set(o.resourceId, n.resourceId);

  const rectOf = (c) => {
    const b = c.bounds;
    const x = +b.upperLeft.x, y = +b.upperLeft.y;
    return { x, y, w: +b.lowerRight.x - x, h: +b.lowerRight.y - y };
  };
  const nodes = [];
  for (const [oid, c] of nodeByOid) nodes.push({ id: oid, ...rectOf(c) });
  const edges = [];
  for (const e of edgeShapes) {
    const d = e.dockers || [];
    if (d.length < 2) continue;
    const src = nodeByRid.get(srcOfEdge.get(e.resourceId));
    const tgt = nodeByRid.get(e.outgoing?.[0]?.resourceId);
    if (!src || !tgt) continue;
    const sr = rectOf(src), tr = rectOf(tgt);
    const pts = [{ x: sr.x + +d[0].x, y: sr.y + +d[0].y }];
    for (let i = 1; i < d.length - 1; i++) pts.push({ x: +d[i].x, y: +d[i].y });
    pts.push({ x: tr.x + +d[d.length - 1].x, y: tr.y + +d[d.length - 1].y });
    edges.push({ id: e.resourceId, srcId: src.properties.overrideid, tgtId: tgt.properties.overrideid, pts });
  }

  const problems = [];
  const warn = [];
  const EPS = 1, PORT_RADIUS = 26;
  const segs = (pts) => { const l = []; for (let i = 0; i + 1 < pts.length; i++) l.push([pts[i], pts[i + 1]]); return l; };
  const isH = ([p, q]) => Math.abs(p.y - q.y) < 0.51;

  // 节点重叠
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    const a = nodes[i], b = nodes[j];
    if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) problems.push(`节点重叠: ${a.id} × ${b.id}`);
  }
  // 线段正交
  let segCount = 0;
  for (const e of edges) for (const [p, q] of segs(e.pts)) {
    segCount++;
    if (Math.abs(p.x - q.x) > 0.51 && Math.abs(p.y - q.y) > 0.51) problems.push(`非正交: ${e.id}`);
  }
  // 穿节点
  for (const e of edges) {
    const ids = new Set([e.srcId, e.tgtId]);
    for (const n of nodes) {
      if (ids.has(n.id)) continue;
      for (const [p, q] of segs(e.pts)) {
        if (Math.max(p.x, q.x) > n.x + 0.6 && Math.min(p.x, q.x) < n.x + n.w - 0.6
          && Math.max(p.y, q.y) > n.y + 0.6 && Math.min(p.y, q.y) < n.y + n.h - 0.6) {
          problems.push(`边穿节点: ${e.id} 穿 ${n.id}`); break;
        }
      }
    }
  }
  // 边边冲突
  let conflictPairs = 0;
  const overlapLen = (a1, a2, b1, b2) => Math.min(a2, b2) - Math.max(a1, b1);
  for (let i = 0; i < edges.length; i++) for (let j = i + 1; j < edges.length; j++) {
    const eA = edges[i], eB = edges[j];
    const shared = eA.srcId === eB.srcId || eA.srcId === eB.tgtId || eA.tgtId === eB.srcId || eA.tgtId === eB.tgtId;
    let c = 0;
    for (const sA of segs(eA.pts)) for (const sB of segs(eB.pts)) {
      const hA = isH(sA), hB = isH(sB);
      if (hA && hB) {
        if (Math.abs(sA[0].y - sB[0].y) < 0.51) {
          const len = overlapLen(Math.min(sA[0].x, sA[1].x), Math.max(sA[0].x, sA[1].x), Math.min(sB[0].x, sB[1].x), Math.max(sB[0].x, sB[1].x));
          if (len > EPS) c++;
        }
      } else if (!hA && !hB) {
        if (Math.abs(sA[0].x - sB[0].x) < 0.51) {
          const len = overlapLen(Math.min(sA[0].y, sA[1].y), Math.max(sA[0].y, sA[1].y), Math.min(sB[0].y, sB[1].y), Math.max(sB[0].y, sB[1].y));
          if (len > EPS) c++;
        }
      } else {
        const hSeg = hA ? sA : sB, vSeg = hA ? sB : sA;
        const y = hSeg[0].y, x = vSeg[0].x;
        if (x > Math.min(hSeg[0].x, hSeg[1].x) + 0.51 && x < Math.max(hSeg[0].x, hSeg[1].x) - 0.51
          && y > Math.min(vSeg[0].y, vSeg[1].y) + 0.51 && y < Math.max(vSeg[0].y, vSeg[1].y) - 0.51) {
          if (!shared) { c++; continue; }
          const nearPt = (pt) => Math.hypot(pt.x - x, pt.y - y) < PORT_RADIUS;
          const e1 = hA ? eA : eB, e2 = hA ? eB : eA;
          if (!([e1.pts[0], e1.pts[e1.pts.length - 1]].some(nearPt) && [e2.pts[0], e2.pts[e2.pts.length - 1]].some(nearPt))) c++;
        }
      }
    }
    if (c) conflictPairs++;
  }
  // 网关 docker 0.5（网关形状的边首末 docker）
  const gwRids = new Set();
  for (const [oid, c] of nodeByOid) {
    if (/Gateway/.test(c.stencil?.id || '')) gwRids.add(c.resourceId);
  }
  let gwDockerOk = 0, gwDockerBad = 0;
  for (const e of edgeShapes) {
    const src = nodeByRid.get(srcOfEdge.get(e.resourceId));
    const tgt = nodeByRid.get(e.outgoing?.[0]?.resourceId);
    const d = e.dockers || [];
    if (!d.length) continue;
    const isSrcGw = gwRids.has(src?.resourceId), isTgtGw = gwRids.has(tgt?.resourceId);
    if (!isSrcGw && !isTgtGw) continue;
    const okF = !isSrcGw || (Math.abs((+d[0].x % 1) - 0.5) < 0.01 || Math.abs((+d[0].y % 1) - 0.5) < 0.01);
    const okL = !isTgtGw || (Math.abs((+d[d.length - 1].x % 1) - 0.5) < 0.01 || Math.abs((+d[d.length - 1].y % 1) - 0.5) < 0.01);
    if (okF && okL) gwDockerOk++; else gwDockerBad++;
  }
  // 画布
  const b = defJson.bounds;
  const canvasW = +b.lowerRight.x, canvasH = +b.lowerRight.y;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) { minX = Math.min(minX, n.x); minY = Math.min(minY, n.y); maxX = Math.max(maxX, n.x + n.w); maxY = Math.max(maxY, n.y + n.h); }
  for (const e of edges) for (const p of e.pts) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); }
  const padL = minX, padR = canvasW - maxX, padT = minY, padB = canvasH - maxY;
  if (Math.abs(padL - padR) > 1.6 || Math.abs(padT - padB) > 1.6) warn.push(`边距不对称: L=${padL.toFixed(1)} R=${padR.toFixed(1)} T=${padT.toFixed(1)} B=${padB.toFixed(1)}`);
  if (minX < -0.6 || minY < -0.6 || maxX > canvasW + 0.6 || maxY > canvasH + 0.6) problems.push(`内容超出画布`);

  console.log(`节点: ${nodes.length}, 边: ${edges.length}, 线段: ${segCount}`);
  console.log(`画布: ${canvasW}x${canvasH}, 内容: (${minX.toFixed(0)},${minY.toFixed(0)})-(${maxX.toFixed(0)},${maxY.toFixed(0)})`);
  console.log(`网关 docker 0.5: ${gwDockerOk} 通过 / ${gwDockerBad} 未过`);
  console.log(`节点重叠: ${problems.filter(p => p.startsWith('节点重叠')).length}`);
  console.log(`边穿节点: ${problems.filter(p => p.startsWith('边穿节点')).length}`);
  console.log(`非正交: ${problems.filter(p => p.startsWith('非正交')).length}`);
  console.log(`边边冲突对: ${conflictPairs}`);
  if (warn.length) console.log('⚠️ ' + warn.join(' | '));
  const hard = problems.filter(p => !p.startsWith('尺寸'));
  if (hard.length) console.log(`❌ 硬性问题 ${hard.length}:`, hard.slice(0, 15));
  else console.log('✅ defJson 几何校验通过');
  return { ok: hard.length === 0, problems, warn };
}
