// 边路由坐标下降优化器：修复 U 形回边共线/边穿节点/非端点交叉
// 阶段0 确定性分类初始化（对齐技能 bpmn-to-oryx §3.2/§4.3：直线 → U形绕行(槽池区间互斥) → 跨行 L）
// 阶段1 坐标下降微调：打分 = 节点穿越×1000 + 边冲突×50 + 长度×0.05，最差边优先，多轮清扫
// 候选：直线/L/U/Z + 槽位 ±14px 通道偏移抖动 + 竖线独立出线槽偏移
// opts.locked: 边 id 集合，锁定的边永不改动（vsdx 1:1 折线场景：只重路由兜底边，
// 但仍参与其余边的冲突计分与穿节点判定）

export function optimizeRoutes(nodes, edges, opts = {}) {
  const MAX_ROUNDS = opts.maxRounds ?? 300;
  const locked = new Set(opts.locked || []);
  const nodeById = new Map(nodes.map(n => [n.id, n]));
  const EPS = 1;
  const PORT_RADIUS = 26;

  // ---- 几何评估 ----
  const segs = (pts) => {
    const list = [];
    for (let i = 0; i + 1 < pts.length; i++) list.push([pts[i], pts[i + 1]]);
    return list;
  };
  const isH = ([p, q]) => Math.abs(p.y - q.y) < 0.51;
  const isV = ([p, q]) => Math.abs(p.x - q.x) < 0.51;

  const nodeCrossings = (e) => {
    let count = 0;
    const ids = new Set([e.srcId, e.tgtId]);
    for (const n of nodes) {
      if (ids.has(n.id)) continue;
      for (const s of segs(e.pts)) {
        const minX = Math.min(s[0].x, s[1].x), maxX = Math.max(s[0].x, s[1].x);
        const minY = Math.min(s[0].y, s[1].y), maxY = Math.max(s[0].y, s[1].y);
        if (maxX > n.x + 0.6 && minX < n.x + n.w - 0.6 && maxY > n.y + 0.6 && minY < n.y + n.h - 0.6) { count++; break; }
      }
    }
    return count;
  };

  const pairConflicts = (eA, eB) => {
    let count = 0;
    const shared = eA.srcId === eB.srcId || eA.srcId === eB.tgtId || eA.tgtId === eB.srcId || eA.tgtId === eB.tgtId;
    const overlapLen = (a1, a2, b1, b2) => Math.min(a2, b2) - Math.max(a1, b1);
    for (const sA of segs(eA.pts)) {
      for (const sB of segs(eB.pts)) {
        const hA = isH(sA), hB = isH(sB);
        if (hA && hB) {
          if (Math.abs(sA[0].y - sB[0].y) < 0.51) {
            const len = overlapLen(Math.min(sA[0].x, sA[1].x), Math.max(sA[0].x, sA[1].x), Math.min(sB[0].x, sB[1].x), Math.max(sB[0].x, sB[1].x));
            if (len > EPS) count++;
          }
        } else if (!hA && !hB) {
          if (Math.abs(sA[0].x - sB[0].x) < 0.51) {
            const len = overlapLen(Math.min(sA[0].y, sA[1].y), Math.max(sA[0].y, sA[1].y), Math.min(sB[0].y, sB[1].y), Math.max(sB[0].y, sB[1].y));
            if (len > EPS) count++;
          }
        } else {
          const hSeg = hA ? sA : sB, vSeg = hA ? sB : sA;
          const y = hSeg[0].y, x = vSeg[0].x;
          if (x > Math.min(hSeg[0].x, hSeg[1].x) + 0.51 && x < Math.max(hSeg[0].x, hSeg[1].x) - 0.51
            && y > Math.min(vSeg[0].y, vSeg[1].y) + 0.51 && y < Math.max(vSeg[0].y, vSeg[1].y) - 0.51) {
            if (!shared) { count++; continue; }
            const nearPt = (pt) => Math.hypot(pt.x - x, pt.y - y) < PORT_RADIUS;
            const e1 = hA ? eA : eB, e2 = hA ? eB : eA;
            const end1 = [e1.pts[0], e1.pts[e1.pts.length - 1]];
            const end2 = [e2.pts[0], e2.pts[e2.pts.length - 1]];
            if (!(end1.some(nearPt) && end2.some(nearPt))) count++;
          }
        }
      }
    }
    return count;
  };

  const pathLen = (pts) => {
    let length = 0;
    for (let i = 0; i + 1 < pts.length; i++) length += Math.abs(pts[i + 1].x - pts[i].x) + Math.abs(pts[i + 1].y - pts[i].y);
    return length;
  };

  const edgeConflictsOf = (e) => {
    let count = 0;
    for (const other of edges) {
      if (other === e) continue;
      count += pairConflicts(e, other);
    }
    return count;
  };
  const fullScore = (e) => nodeCrossings(e) * 1000 + edgeConflictsOf(e) * 50 + pathLen(e.pts) * 0.05;

  // ---- 槽位候选 ----
  const allTops = nodes.map(n => n.y);
  const allBottoms = nodes.map(n => n.y + n.h);
  const minTop = Math.min(...allTops), maxBottom = Math.max(...allBottoms);
  const minXOfNodes = Math.min(...nodes.map(n => n.x));
  const maxXOfNodes = Math.max(...nodes.map(n => n.x + n.w));
  const rows = [...new Set(nodes.map(n => Math.round(n.y + n.h / 2)))].sort((a, b) => a - b);
  const clustered = [];
  for (const y of rows) {
    if (!clustered.length || y - clustered[clustered.length - 1] > 60) clustered.push(y);
    else clustered[clustered.length - 1] = Math.round((clustered[clustered.length - 1] + y) / 2);
  }
  const gapSlots = [];
  for (let i = 0; i + 1 < clustered.length; i++) gapSlots.push(Math.round((clustered[i] + clustered[i + 1]) / 2));

  const JITTER = [0, 14, -14, 28, -28, 42, -42, 56, -56, 70, -70, 84];
  const topSlots = [], bottomSlots = [];
  for (const base of [60, 90, 120, 150]) {
    for (const j of JITTER) {
      topSlots.push(minTop - base + j);
      bottomSlots.push(maxBottom + base + j);
    }
  }

  // ---- 候选生成 ----
  const genCandidates = (e) => {
    const src = nodeById.get(e.srcId), tgt = nodeById.get(e.tgtId);
    const srcCx = src.x + src.w / 2, srcCy = src.y + src.h / 2;
    const tgtCx = tgt.x + tgt.w / 2, tgtCy = tgt.y + tgt.h / 2;
    const cands = [];
    const push = (mids) => {
      if (!mids.length) return;
      const pts = [{ x: srcCx, y: srcCy }, ...mids, { x: tgtCx, y: tgtCy }];
      for (let i = 0; i + 1 < pts.length; i++) {
        if (Math.abs(pts[i].x - pts[i + 1].x) > 0.51 && Math.abs(pts[i].y - pts[i + 1].y) > 0.51) return;
      }
      cands.push(mids);
    };
    const dy = tgtCy - srcCy;
    const sameRow = Math.abs(dy) < Math.min(src.h, tgt.h) * 0.6;

    if (sameRow) {
      push([]); // 直线
      const slotYs = [...gapSlots, ...topSlots.slice(0, 10), ...bottomSlots.slice(0, 10)];
      for (const y of slotYs) {
        push([{ x: srcCx, y }, { x: tgtCx, y }]);
        // 目标侧上入/下入（末段从目标上/下边缘进入，避免多入边同侧共线挤入）
        push([{ x: srcCx, y }, { x: tgtCx, y }, { x: tgtCx, y: tgt.y - 12 }]);
        push([{ x: srcCx, y }, { x: tgtCx, y }, { x: tgtCx, y: tgt.y + tgt.h + 12 }]);
        for (const off of [12, 28, 44, -12, -28]) {
          const x1 = srcCx + (off > 0 ? 1 : -1) * (src.w / 2 + Math.abs(off));
          const x2 = tgtCx + (off > 0 ? 1 : -1) * (tgt.w / 2 + Math.abs(off));
          push([{ x: x1, y: srcCy }, { x: x1, y }, { x: x2, y }, { x: x2, y: tgtCy }]);
          // 节点边缘出线（上/下）：竖线从节点边缘外出发，避开主行中心线的直线共线区
          if (y < srcCy) {
            push([{ x: srcCx, y: src.y - 12 }, { x: x1, y: src.y - 12 }, { x: x1, y }, { x: x2, y }, { x: x2, y: tgt.y - 12 }, { x: tgtCx, y: tgt.y - 12 }]);
          } else {
            push([{ x: srcCx, y: src.y + src.h + 12 }, { x: x1, y: src.y + src.h + 12 }, { x: x1, y }, { x: x2, y }, { x: x2, y: tgt.y + tgt.h + 12 }, { x: tgtCx, y: tgt.y + tgt.h + 12 }]);
          }
        }
      }
    } else {
      push([{ x: srcCx, y: tgtCy }]);
      push([{ x: tgtCx, y: srcCy }]);
      const midYs = [...gapSlots, ...topSlots.slice(0, 10), ...bottomSlots.slice(0, 10)];
      for (const y of midYs) {
        push([{ x: srcCx, y }, { x: tgtCx, y }]);
      }
      // 超长边（span>1500）外围通道：全局顶/底横槽 + 左/右外围竖通道，穿越整个布局而不进内部
      if (Math.abs(tgtCx - srcCx) > 1500) {
        const outerLeft = minXOfNodes - 60, outerRight = maxXOfNodes + 60;
        for (const y of [minTop - 90, minTop - 120, maxBottom + 90, maxBottom + 120]) {
          // 左外围（目标在左）：源→竖到槽→横到左外围→竖到目标行→横入
          if (tgtCx < srcCx) {
            push([{ x: srcCx, y }, { x: outerLeft, y }, { x: outerLeft, y: tgtCy }]);
            // 目标上边缘入线
            push([{ x: srcCx, y }, { x: outerLeft, y }, { x: outerLeft, y: tgt.y - 12 }, { x: tgtCx, y: tgt.y - 12 }]);
          } else {
            push([{ x: srcCx, y }, { x: outerRight, y }, { x: outerRight, y: tgtCy }]);
            push([{ x: srcCx, y }, { x: outerRight, y }, { x: outerRight, y: tgt.y - 12 }, { x: tgtCx, y: tgt.y - 12 }]);
          }
        }
      }
      for (const off of [14, -14, 28, -28, 42, -42]) {
        const x1 = srcCx + off > src.x + src.w + 12 || srcCx + off < src.x - 12 ? srcCx + off : srcCx + (off > 0 ? 1 : -1) * (src.w / 2 + 12 + (Math.abs(off) - 14));
        const x2 = tgtCx + off > tgt.x + tgt.w + 12 || tgtCx + off < tgt.x - 12 ? tgtCx + off : tgtCx + (off > 0 ? 1 : -1) * (tgt.w / 2 + 12 + (Math.abs(off) - 14));
        for (const y of [Math.round((srcCy + tgtCy) / 2), ...gapSlots.slice(0, 4)]) {
          push([{ x: x1, y: srcCy }, { x: x1, y }, { x: x2, y }, { x: x2, y: tgtCy }]);
        }
      }
      for (const off of [14, -14, 28, -28]) {
        const x1 = srcCx + (off > 0 ? 1 : -1) * (src.w / 2 + Math.abs(off));
        const x2 = tgtCx + (off > 0 ? 1 : -1) * (tgt.w / 2 + Math.abs(off));
        push([{ x: x1, y: srcCy }, { x: x1, y: tgtCy }]);
        push([{ x: x2, y: srcCy }, { x: x2, y: tgtCy }]);
      }
    }
    return cands;
  };

  const applyMids = (edge, mids) => {
    const backup = edge.pts;
    edge.pts = [{ x: backup[0].x, y: backup[0].y }, ...mids, { x: backup[backup.length - 1].x, y: backup[backup.length - 1].y }];
  };

  // ---- 阶段0：确定性分类初始化 ----
  const classify = (e) => {
    const src = nodeById.get(e.srcId), tgt = nodeById.get(e.tgtId);
    const srcCx = src.x + src.w / 2, srcCy = src.y + src.h / 2;
    const tgtCx = tgt.x + tgt.w / 2, tgtCy = tgt.y + tgt.h / 2;
    const dy = tgtCy - srcCy;
    const sameRow = Math.abs(dy) < Math.min(src.h, tgt.h) * 0.6;
    let blocked = false;
    for (const n of nodes) {
      if (n.id === e.srcId || n.id === e.tgtId) continue;
      if (Math.abs(srcCy - (n.y + n.h / 2)) < 0.51
        && srcCx < n.x && tgtCx > n.x + n.w) { blocked = true; break; }
    }
    const needsDetour = sameRow && (tgtCx <= srcCx || Math.abs(tgtCx - srcCx) >= 300 || blocked);
    return { sameRow, needsDetour, span: Math.abs(tgtCx - srcCx), dyAbs: Math.abs(dy), dy };
  };
  const edgeClass = new Map(edges.map(e => [e.id, classify(e)]));
  // 绕行槽池（§4.3 区间互斥）
  const topPool = [], bottomPool = [];
  const takeSlot = (pool, minX, maxX, nextY) => {
    for (const slot of pool) {
      if (minX >= slot.maxX - 1 || maxX <= slot.minX + 1) {
        slot.minX = Math.min(slot.minX, minX); slot.maxX = Math.max(slot.maxX, maxX);
        return slot.y;
      }
    }
    const slot = { y: nextY(), minX, maxX };
    pool.push(slot);
    return slot.y;
  };
  let topCursor = minTop - 60, bottomCursor = maxBottom + 60;
  const nextTop = () => { const y = topCursor; topCursor -= 30; return y; };
  const nextBottom = () => { const y = bottomCursor; bottomCursor += 30; return y; };

  const detourEdges = edges.filter(e => !locked.has(e.id) && edgeClass.get(e.id).needsDetour)
    .sort((a, b) => edgeClass.get(a.id).span - edgeClass.get(b.id).span);
  const crossEdges = edges.filter(e => !locked.has(e.id) && !edgeClass.get(e.id).sameRow)
    .sort((a, b) => edgeClass.get(a.id).dyAbs - edgeClass.get(b.id).dyAbs);

  for (const e of detourEdges) {
    if (e.pts.length > 2) continue;
    const src = nodeById.get(e.srcId), tgt = nodeById.get(e.tgtId);
    const srcCx = src.x + src.w / 2, tgtCx = tgt.x + tgt.w / 2;
    const minX = Math.min(srcCx, tgtCx), maxX = Math.max(srcCx, tgtCx);
    const y = takeSlot(topPool, minX, maxX, nextTop);
    applyMids(e, [{ x: srcCx, y }, { x: tgtCx, y }]);
  }
  for (const e of crossEdges) {
    if (e.pts.length > 2) continue;
    const src = nodeById.get(e.srcId), tgt = nodeById.get(e.tgtId);
    const srcCx = src.x + src.w / 2, srcCy = src.y + src.h / 2;
    const tgtCx = tgt.x + tgt.w / 2, tgtCy = tgt.y + tgt.h / 2;
    const cls = edgeClass.get(e.id);
    const mid = cls.dy > 0 ? { x: srcCx, y: tgtCy } : { x: tgtCx, y: srcCy };
    applyMids(e, [mid]);
  }

  // ---- 阶段1：坐标下降（最差边优先，多轮清扫） ----
  const failedSet = new Set();
  let sweeps = 0;
  let totalRounds = 0;
  const MAX_SWEEPS = 3;

  while (totalRounds < MAX_ROUNDS && sweeps < MAX_SWEEPS) {
    totalRounds++;
    let worst = null, worstScore = -1;
    for (const e of edges) {
      if (failedSet.has(e.id) || locked.has(e.id)) continue;
      const bad = nodeCrossings(e) * 1000 + edgeConflictsOf(e) * 50;
      if (bad > 0 && bad > worstScore) { worst = e; worstScore = bad; }
    }
    if (!worst) {
      const anyBad = edges.some(e => !locked.has(e.id) && (nodeCrossings(e) > 0 || edgeConflictsOf(e) > 0));
      if (!anyBad) break;
      if (failedSet.size) { failedSet.clear(); sweeps++; continue; }
      break;
    }

    const candidates = genCandidates(worst);
    let best = null, bestScore = Infinity;
    for (const mids of candidates) {
      const backup = worst.pts;
      applyMids(worst, mids);
      const score = fullScore(worst);
      worst.pts = backup;
      if (score < bestScore) { bestScore = score; best = mids; }
    }
    if (best && bestScore < worstScore) {
      applyMids(worst, best);
    } else {
      failedSet.add(worst.id);
      if (failedSet.size >= edges.length) { failedSet.clear(); sweeps++; }
    }
  }

  // ---- 汇总残留 ----
  let residualNode = 0, residualEdge = 0;
  const residual = [];
  for (const e of edges) residualNode += nodeCrossings(e);
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      const c = pairConflicts(edges[i], edges[j]);
      residualEdge += c;
      if (c) residual.push(`${edges[i].id} × ${edges[j].id}: ${c}`);
    }
  }
  return { rounds: totalRounds, residualNode, residualEdge, residual: residual.slice(0, 20), edges };
}
