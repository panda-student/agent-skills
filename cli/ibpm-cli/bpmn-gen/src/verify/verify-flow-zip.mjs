// ZIP 布局硬性校验（layout-rules.md §7）：从最终 zip 内重新解析 bpmnXml/defJson 校验
// 用法（库）：const { ok, problems, warn } = verifyFlowZip(zip解压目录)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 校验解压后的流程目录（bpmdefs.flow.xml + nodeDispose.json）
 * @param {string} dir - zip 解压后的流程目录
 * @returns {{ok: boolean, problems: string[], warn: string[]}}
 */
export function verifyFlowZip(dir) {
  const raw = readFileSync(join(dir, 'bpmdefs.flow.xml'), 'utf8');
  const dec = raw.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

  // ---- 提取 bpmnXml 与 defJson ----
  const bpmnXml = dec.match(/<bpmnXml>([\s\S]*?)<\/bpmnXml>/)?.[1] || '';
  const defJsonRaw = dec.match(/<defJson>([\s\S]*?)<\/defJson>/)?.[1] || '';
  let defJson;
  try { defJson = JSON.parse(defJsonRaw); } catch (err) { return { ok: false, problems: [`defJson 解析失败: ${err.message}`], warn: [] }; }

  // ---- BPMNDiagram: Shape Bounds / Edge waypoint ----
  const shapes = [];
  for (const m of bpmnXml.matchAll(/<bpmndi:BPMNShape bpmnElement="([^"]+)"[^>]*>\s*<omgdc:Bounds height="([\d.]+)" width="([\d.]+)" x="(-?[\d.]+)" y="(-?[\d.]+)"/g)) {
    shapes.push({ id: m[1], h: +m[2], w: +m[3], x: +m[4], y: +m[5] });
  }
  const edges = [];
  for (const m of bpmnXml.matchAll(/<bpmndi:BPMNEdge bpmnElement="([^"]+)"[^>]*>([\s\S]*?)<\/bpmndi:BPMNEdge>/g)) {
    const wps = [...m[2].matchAll(/<omgdi:waypoint x="(-?[\d.]+)" y="(-?[\d.]+)"\/>/g)].map(w => ({ x: +w[1], y: +w[2] }));
    edges.push({ id: m[1], wps });
  }
  const flows = [...bpmnXml.matchAll(/<sequenceFlow id="([^"]+)"[^>]*sourceRef="([^"]+)"[^>]*targetRef="([^"]+)"/g)].map(m => ({ id: m[1], source: m[2], target: m[3] }));
  const nodeType = {};
  for (const m of bpmnXml.matchAll(/<(startEvent|endEvent|userTask|exclusiveGateway|parallelGateway) id="([^"]+)"/g)) nodeType[m[2]] = m[1];

  const problems = [];
  const warn = [];
  const shapeById = Object.fromEntries(shapes.map(s => [s.id, s]));
  const flowById = Object.fromEntries(flows.map(f => [f.id, f]));

  // ---- A. 节点尺寸 ----
  for (const s of shapes) {
    const t = nodeType[s.id];
    if (t === 'startEvent' && (s.w !== 30 || s.h !== 30)) problems.push(`尺寸: ${s.id} startEvent ${s.w}x${s.h} ≠ 30x30`);
    if (t === 'endEvent' && (s.w !== 28 || s.h !== 28)) problems.push(`尺寸: ${s.id} endEvent ${s.w}x${s.h} ≠ 28x28`);
    if (t === 'exclusiveGateway' && (s.w !== 40 || s.h !== 40)) problems.push(`尺寸: ${s.id} gateway ${s.w}x${s.h} ≠ 40x40`);
    if (t === 'userTask' && (s.w < 100 || s.h !== 46)) problems.push(`尺寸: ${s.id} userTask ${s.w}x${s.h} 不符 (>=100 x 46)`);
  }

  // ---- B. 节点重叠 ----
  for (let i = 0; i < shapes.length; i++) {
    for (let j = i + 1; j < shapes.length; j++) {
      const a = shapes[i], b = shapes[j];
      if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) {
        problems.push(`节点重叠: ${a.id} 与 ${b.id}`);
      }
    }
  }

  // ---- C. 边线段水平/垂直 ----
  let segCount = 0;
  for (const e2 of edges) {
    for (let i = 0; i + 1 < e2.wps.length; i++) {
      segCount++;
      const p = e2.wps[i], q = e2.wps[i + 1];
      if (Math.abs(p.x - q.x) > 0.51 && Math.abs(p.y - q.y) > 0.51) {
        problems.push(`非正交线段: ${e2.id} 第${i + 1}段 (${p.x},${p.y})→(${q.x},${q.y})`);
      }
    }
  }

  // 线段列表（绝对路径，含端点）
  const segsOf = (e2) => {
    const list = [];
    for (let i = 0; i + 1 < e2.wps.length; i++) list.push([e2.wps[i], e2.wps[i + 1]]);
    return list;
  };

  // ---- D. 边穿非端点节点（净距 12 仅警告，穿越即失败） ----
  for (const e2 of edges) {
    const f = flowById[e2.id];
    if (!f) continue;
    const endpoints = new Set([f.source, f.target]);
    for (const s of shapes) {
      if (endpoints.has(s.id)) continue;
      for (const [p, q] of segsOf(e2)) {
        // 水平/垂直线段与矩形相交
        const minX = Math.min(p.x, q.x), maxX = Math.max(p.x, q.x);
        const minY = Math.min(p.y, q.y), maxY = Math.max(p.y, q.y);
        if (maxX > s.x + 0.6 && minX < s.x + s.w - 0.6 && maxY > s.y + 0.6 && minY < s.y + s.h - 0.6) {
          problems.push(`边穿节点: ${e2.id} 穿过 ${s.id}`);
          break;
        }
      }
    }
  }

  // ---- E. 边边共线重合 / F. 非共同端点交叉 ----
  const EPS = 1;
  const overlapLen = (a1, a2, b1, b2) => Math.min(a2, b2) - Math.max(a1, b1);
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      const eA = edges[i], eB = edges[j];
      const fA = flowById[eA.id], fB = flowById[eB.id];
      const shared = fA && fB && (fA.source === fB.source || fA.source === fB.target || fA.target === fB.source || fA.target === fB.target);
      for (const [p1, p2] of segsOf(eA)) {
        for (const [q1, q2] of segsOf(eB)) {
          const hA = Math.abs(p1.y - p2.y) < 0.51, hB = Math.abs(q1.y - q2.y) < 0.51;
          if (hA && hB) {
            if (Math.abs(p1.y - q1.y) < 0.51) {
              const len = overlapLen(Math.min(p1.x, p2.x), Math.max(p1.x, p2.x), Math.min(q1.x, q2.x), Math.max(q1.x, q2.x));
              if (len > EPS) problems.push(`边边共线重合: ${eA.id} 与 ${eB.id} 水平 y=${p1.y} 重叠${len.toFixed(1)}px`);
            }
          } else if (!hA && !hB) {
            if (Math.abs(p1.x - q1.x) < 0.51) {
              const len = overlapLen(Math.min(p1.y, p2.y), Math.max(p1.y, p2.y), Math.min(q1.y, q2.y), Math.max(q1.y, q2.y));
              if (len > EPS) problems.push(`边边共线重合: ${eA.id} 与 ${eB.id} 垂直 x=${p1.x} 重叠${len.toFixed(1)}px`);
            }
          } else {
            // 交叉：水平线与垂直线
            const hSeg = hA ? [p1, p2] : [q1, q2];
            const vSeg = hA ? [q1, q2] : [p1, p2];
            const y = hSeg[0].y, x = vSeg[0].x;
            if (x > Math.min(hSeg[0].x, hSeg[1].x) + 0.51 && x < Math.max(hSeg[0].x, hSeg[1].x) - 0.51
              && y > Math.min(vSeg[0].y, vSeg[1].y) + 0.51 && y < Math.max(vSeg[0].y, vSeg[1].y) - 0.51) {
              // 豁免：交点是共享节点的端口（两边的端点都贴近交点）
              const nearPt = (pt) => Math.hypot(pt.x - x, pt.y - y) < 26;
              const endA = [eA.wps[0], eA.wps[eA.wps.length - 1]];
              const endB = [eB.wps[0], eB.wps[eB.wps.length - 1]];
              const isPortA = endA.some(nearPt), isPortB = endB.some(nearPt);
              if (!(isPortA && isPortB)) {
                problems.push(`边交叉: ${eA.id} 与 ${eB.id} 于 (${x.toFixed(0)},${y.toFixed(0)})`);
              }
            }
          }
        }
      }
    }
  }

  // ---- G. defJson 边 resourceId = sequenceFlow.id 集合 ----
  const djEdges = new Set();
  const walk = (sh) => {
    for (const c of sh || []) {
      if (c.stencil?.id === 'SequenceFlow' && c.resourceId) djEdges.add(c.resourceId);
      walk(c.childShapes);
    }
  };
  walk(defJson.childShapes);
  const sfIds = new Set(flows.map(f => f.id));
  const missing = [...sfIds].filter(id => !djEdges.has(id));
  const extra = [...djEdges].filter(id => !sfIds.has(id));
  if (missing.length) problems.push(`defJson 缺边: ${missing.join(',')}`);
  if (extra.length) problems.push(`defJson 多边: ${extra.join(',')}`);

  // ---- H. extProcess / 网关不进 extNodes ----
  if (!bpmnXml.includes('<ext:extProcess>')) problems.push('ext:extProcess 缺失');
  for (const m of bpmnXml.matchAll(/<ext:(?:userNode|baseNode)[^>]*bpmnElement="([^"]+)"/g)) {
    if (nodeType[m[1]] === 'exclusiveGateway' || nodeType[m[1]] === 'parallelGateway') {
      problems.push(`网关进入 extNodes: ${m[1]}`);
    }
  }

  // ---- I. 画布 bounds 与边距对称 ----
  const b = defJson.bounds;
  const canvasW = +b.lowerRight.x, canvasH = +b.lowerRight.y;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of shapes) {
    minX = Math.min(minX, s.x); minY = Math.min(minY, s.y);
    maxX = Math.max(maxX, s.x + s.w); maxY = Math.max(maxY, s.y + s.h);
  }
  for (const e2 of edges) for (const p of e2.wps) {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  }
  if (canvasW < 480 || canvasH < 240) problems.push(`画布过小: ${canvasW}x${canvasH}`);
  if (minX < -0.6 || minY < -0.6 || maxX > canvasW + 0.6 || maxY > canvasH + 0.6) {
    problems.push(`内容超出画布: 内容(${minX},${minY})-(${maxX},${maxY}) 画布 ${canvasW}x${canvasH}`);
  }
  const padL = minX, padR = canvasW - maxX, padT = minY, padB = canvasH - maxY;
  if (Math.abs(padL - padR) > 1.6 || Math.abs(padT - padB) > 1.6) {
    warn.push(`边距不对称: L=${padL.toFixed(1)} R=${padR.toFixed(1)} T=${padT.toFixed(1)} B=${padB.toFixed(1)}`);
  }

  // ---- J. 网关 docker 20.5（waypoint 首末=网关中心的 0.5 偏移特性，从 defJson dockers 校验）----
  let gwDockerOk = 0, gwDockerBad = [];
  const walk2 = (sh) => {
    for (const c of sh || []) {
      if (c.stencil?.id === 'SequenceFlow' && Array.isArray(c.dockers) && c.dockers.length >= 2) {
        const f = flowById[c.resourceId];
        if (f && (nodeType[f.source] === 'exclusiveGateway' || nodeType[f.target] === 'exclusiveGateway')) {
          // Oryx docker: 首末为相对偏移。检查是否有 .5 的小数特征（首或末接网关）
          const first = c.dockers[0], last = c.dockers[c.dockers.length - 1];
          const srcGw = nodeType[f.source] === 'exclusiveGateway';
          const tgtGw = nodeType[f.target] === 'exclusiveGateway';
          const okFirst = !srcGw || (Math.abs((first.x % 1) - 0.5) < 0.01 || Math.abs((first.y % 1) - 0.5) < 0.01);
          const okLast = !tgtGw || (Math.abs((last.x % 1) - 0.5) < 0.01 || Math.abs((last.y % 1) - 0.5) < 0.01);
          if (okFirst && okLast) gwDockerOk++; else gwDockerBad.push(c.resourceId);
        }
      }
      walk2(c.childShapes);
    }
  };
  walk2(defJson.childShapes);
  if (gwDockerBad.length) problems.push(`网关 docker 非 0.5 对齐: ${gwDockerBad.slice(0, 5).join(',')}${gwDockerBad.length > 5 ? '...' : ''}`);

  // ---- 主行中心 Y 一致性（含 StartEvent 的行为主行）----
  const startShape = shapes.find(s => nodeType[s.id] === 'startEvent');
  if (startShape) {
    const mainCy = startShape.y + startShape.h / 2;
    const sameRow = shapes.filter(s => Math.abs(s.y + s.h / 2 - mainCy) < 40 && s.id !== startShape.id);
    const cySet = new Set(sameRow.map(s => Math.round(s.y + s.h / 2)));
    // 允许不同高度节点中心对齐后有小数差（46/2=23 整数；30/2=15 整数；40/2=20 → 0.5 偏移会差 0.5）
    const spread = Math.max(...[...cySet]) - Math.min(...[...cySet]);
    if (spread > 1) warn.push(`主行中心 Y 偏差 ${spread}px（网关 0.5 偏移特性可容忍 0.5）`);
  }

  // ---- 汇总 ----
  console.log(`节点: ${shapes.length}, 边: ${edges.length}, 线段: ${segCount}`);
  console.log(`画布: ${canvasW}x${canvasH}, 内容范围: (${minX.toFixed(1)},${minY.toFixed(1)})-(${maxX.toFixed(1)},${maxY.toFixed(1)})`);
  console.log(`网关 docker 0.5 对齐: ${gwDockerOk} 通过`);
  if (warn.length) { console.log('⚠️ 视觉警告:'); warn.forEach(w => console.log('  ' + w)); }
  if (problems.length) {
    console.log(`\n❌ 硬性校验失败 ${problems.length} 项:`);
    problems.slice(0, 40).forEach(p => console.log('  ' + p));
  } else {
    console.log('\n✅ 布局硬性校验全部通过');
  }
  return { ok: problems.length === 0, problems, warn };
}
