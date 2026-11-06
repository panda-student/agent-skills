// SVG 并排预览（preview 层）：vsdx 原图 vs 流程 ZIP 重排结果 → 单文件 SVG 供 1:1 目检
// 独立重新解析输出 zip（经 zip-io 回读），可暴露写回环节错误；并对匹配节点做中心偏差数值校验
// 用法（库）：renderCompareSvg('flow.vsdx', 'flow.relayout.zip', 'out.svg', { nodeMap, scale })
import { rmSync, writeFileSync } from 'node:fs';
import { parseVsdx } from '../parse/parse-vsdx.mjs';
import { extractFlowZip, readBpmDefs } from '../lib/zip-io.mjs';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// vsdx 形状类型：master 2=开始/结束椭圆、7=判定菱形；无 master 的按文本特征识别网关
function vsdxShapeKind(node) {
  if (node.master === '2') return 'ellipse';
  if (node.master === '7') return 'diamond';
  if (/是否|≥|≤|＞|＜|判断/.test(node.text || '')) return 'diamond';
  return 'rect';
}

function zipShapeKind(stencilId) {
  if (stencilId === 'StartEvent' || stencilId === 'EndEvent') return 'ellipse';
  if (/Gateway$/.test(stencilId || '')) return 'diamond';
  return 'rect';
}

function shapeSvg(kind, x, y, w, h, color) {
  if (kind === 'ellipse') return `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" fill="#fff" stroke="${color}" stroke-width="1.2"/>`;
  if (kind === 'diamond') return `<polygon points="${x + w / 2},${y} ${x + w},${y + h / 2} ${x + w / 2},${y + h} ${x},${y + h / 2}" fill="#fff" stroke="${color}" stroke-width="1.2"/>`;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff" stroke="${color}" stroke-width="1.2" rx="3"/>`;
}

function textSvg(cx, cy, text, maxChars) {
  const t = (text || '').replace(/\s+/g, ' ');
  const shown = t.length > maxChars ? t.slice(0, maxChars) + '…' : t;
  return shown ? `<text x="${cx}" y="${cy}" text-anchor="middle" font-size="10" fill="#333">${esc(shown)}</text>` : '';
}

function labelSvg(x, y, text) {
  const t = (text || '').replace(/\s+/g, ' ');
  if (!t) return '';
  const shown = t.length > 16 ? t.slice(0, 16) + '…' : t;
  return `<text x="${x}" y="${y - 3}" text-anchor="middle" font-size="9" fill="#888">${esc(shown)}</text>`;
}

// 折线 SVG（去连续重复点 + 箭头）
function polylineSvg(pts, color, marker) {
  const dedup = [];
  for (const p of pts) {
    const last = dedup[dedup.length - 1];
    if (!last || Math.abs(last.x - p.x) > 0.5 || Math.abs(last.y - p.y) > 0.5) dedup.push(p);
  }
  if (dedup.length < 2) return '';
  return `<polyline points="${dedup.map(p => `${p.x},${p.y}`).join(' ')}" fill="none" stroke="${color}" stroke-width="1.1" marker-end="url(#${marker})"/>`;
}

/**
 * 生成 vsdx vs zip 并排对比 SVG + 匹配节点中心偏差数值校验
 * @param {string} vsdxPath
 * @param {string} zipPath - 重排后的流程 zip
 * @param {string} outSvgPath
 * @param {object} [options] - { nodeMap: Map<bpmOverrideid, vsdxNodeId>, scale }
 * @returns {{maxSpread: number, checked: number}} 匹配节点中心偏差（px）极差
 */
export async function renderCompareSvg(vsdxPath, zipPath, outSvgPath, options = {}) {
  const scale = options.scale ?? 100;
  const vsdx = parseVsdx(vsdxPath);
  const S = scale, PH = vsdx.pageHeight;
  const toPx = (p) => ({ x: Math.round(p.x * S), y: Math.round((PH - p.y) * S) });

  const { workDir, innerDir } = extractFlowZip(zipPath);
  let paneBNodes, paneBEdges, maxSpread = 0, checked = 0;
  try {
    const { defJson } = readBpmDefs(innerDir);
    const allShapes = [];
    (function walk(sh) { for (const c of sh || []) { allShapes.push(c); walk(c.childShapes); } })(defJson.childShapes);
    const nodeShapes = allShapes.filter(c => c.stencil?.id !== 'SequenceFlow');
    const edgeShapes = allShapes.filter(c => c.stencil?.id === 'SequenceFlow');
    const nodeByRid = new Map(nodeShapes.map(c => [c.resourceId, c]));
    const srcRidOfEdge = new Map();
    for (const n of nodeShapes) for (const out of n.outgoing || []) srcRidOfEdge.set(out.resourceId, n.resourceId);
    const rectOf = (c) => { const b = c.bounds; const x = +b.upperLeft.x, y = +b.upperLeft.y; return { x, y, w: +b.lowerRight.x - x, h: +b.lowerRight.y - y }; };
    paneBNodes = nodeShapes.map(c => ({ ...rectOf(c), text: c.properties?.name || '', kind: zipShapeKind(c.stencil?.id) }));
    paneBEdges = [];
    for (const e of edgeShapes) {
      const src = nodeByRid.get(srcRidOfEdge.get(e.resourceId));
      const tgt = nodeByRid.get(e.outgoing?.[0]?.resourceId);
      const d = e.dockers || [];
      if (!src || !tgt || d.length < 2) continue;
      const sr = rectOf(src), tr = rectOf(tgt);
      const pts = [{ x: sr.x + +d[0].x, y: sr.y + +d[0].y }];
      for (let i = 1; i < d.length - 1; i++) pts.push({ x: +d[i].x, y: +d[i].y });
      pts.push({ x: tr.x + +d[d.length - 1].x, y: tr.y + +d[d.length - 1].y });
      paneBEdges.push({ pts, text: e.properties?.name || '' });
    }

    // ---- 数值校验：匹配节点中心偏差（应恒等于全局平移 ± 舍入）----
    if (options.nodeMap && options.nodeMap.size) {
      const nodeByOid = new Map(nodeShapes.filter(c => c.properties?.overrideid).map(c => [c.properties.overrideid, c]));
      const vsdxNodeById = new Map(vsdx.nodes.map(n => [n.id, n]));
      const deltas = [];
      for (const [oid, vid] of options.nodeMap) {
        const c = nodeByOid.get(oid);
        const v = vsdxNodeById.get(vid);
        if (!c || !v || v.w == null || v.h == null) continue;
        const r = rectOf(c);
        const dx = (r.x + r.w / 2) - (v.x + v.w / 2) * S;
        const dy = (r.y + r.h / 2) - (PH - (v.y + v.h / 2)) * S;
        deltas.push({ dx, dy });
      }
      if (deltas.length) {
        checked = deltas.length;
        const dxs = deltas.map(d => d.dx), dys = deltas.map(d => d.dy);
        maxSpread = Math.max(Math.max(...dxs) - Math.min(...dxs), Math.max(...dys) - Math.min(...dys));
        console.log(`✓ 1:1 数值校验: ${checked} 个匹配节点中心偏差极差 ${maxSpread.toFixed(2)}px（应 ≈0，仅舍入误差）`);
      }
    }
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }

  // ---- Pane A: vsdx ----
  const paneANodes = vsdx.nodes.filter(n => n.x != null && n.w != null).map(n => ({
    x: Math.round(n.x * S), y: Math.round((PH - (n.y + n.h)) * S), w: Math.round(n.w * S), h: Math.round(n.h * S),
    text: n.text, kind: vsdxShapeKind(n),
  }));
  const paneAEdges = vsdx.edges.filter(e => e.points.length >= 2).map(e => ({ pts: e.points.map(toPx), text: e.text }));

  // ---- 两栏布局 ----
  const bboxOf = (nodes, edges) => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) { minX = Math.min(minX, n.x); minY = Math.min(minY, n.y); maxX = Math.max(maxX, n.x + n.w); maxY = Math.max(maxY, n.y + n.h); }
    for (const e of edges) for (const p of e.pts) { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); }
    return { minX, minY, maxX, maxY };
  };
  const MARGIN = 20, TITLE = 26, GAP = 40;
  const boxA = bboxOf(paneANodes, paneAEdges);
  const boxB = bboxOf(paneBNodes, paneBEdges);
  const width = Math.max(boxA.maxX - boxA.minX, boxB.maxX - boxB.minX) + 2 * MARGIN;
  const heightA = boxA.maxY - boxA.minY, heightB = boxB.maxY - boxB.minY;
  const totalH = TITLE * 2 + heightA + heightB + MARGIN * 2 + GAP;

  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalH}" viewBox="0 0 ${width} ${totalH}" font-family="Microsoft YaHei, SimHei, sans-serif">`);
  parts.push(`<defs>
    <marker id="arrowA" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#1f77b4"/></marker>
    <marker id="arrowB" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#2e8b57"/></marker>
  </defs>`);
  parts.push(`<rect x="0" y="0" width="${width}" height="${totalH}" fill="#fafafa"/>`);

  const renderPane = (nodes, edges, box, offsetY, color, marker, title) => {
    const tx = MARGIN - box.minX, ty = offsetY + TITLE - box.minY;
    const g = [];
    g.push(`<g transform="translate(${tx},${ty})">`);
    for (const e of edges) {
      g.push(polylineSvg(e.pts, color, marker));
      const mid = e.pts[Math.floor(e.pts.length / 2)];
      g.push(labelSvg(mid.x, mid.y, e.text));
    }
    for (const n of nodes) {
      g.push(shapeSvg(n.kind, n.x, n.y, n.w, n.h, color));
      g.push(textSvg(n.x + n.w / 2, n.y + n.h / 2 + 3.5, n.text, Math.max(4, Math.floor(n.w / 10))));
    }
    g.push('</g>');
    parts.push(`<text x="${MARGIN}" y="${offsetY + 17}" font-size="14" font-weight="bold" fill="${color}">${esc(title)}</text>`);
    parts.push(g.join('\n'));
  };

  renderPane(paneANodes, paneAEdges, boxA, MARGIN, '#1f77b4', 'arrowA', `vsdx 原图（${paneANodes.length} 节点 / ${paneAEdges.length} 边）`);
  renderPane(paneBNodes, paneBEdges, boxB, MARGIN + TITLE + heightA + GAP, '#2e8b57', 'arrowB', `重排后 ZIP（${paneBNodes.length} 节点 / ${paneBEdges.length} 边）`);

  parts.push('</svg>');
  writeFileSync(outSvgPath, parts.join('\n'), 'utf8');
  console.log(`✅ 1:1 对比预览: ${outSvgPath}`);
  return { maxSpread, checked };
}
