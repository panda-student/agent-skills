// vsdx 解析（转换链路输入端）：解包 vsdx → 提取节点坐标/文本、连线拓扑/标签/折点几何
// 坐标系：Visio 英寸、原点左下、y 向上；折点已转绝对坐标（abs = Pin-LocPin+local）
// VSDX 省略单元格语义（Shape 48/97/122 实测）：
//   Geometry 首行非 MoveTo → 隐式起点 (0,0)；行内省略 X/Y → 默认 0（非沿用上一行）
//   连接线省略 Width/Height → End-Begin 回算；省略 LocPin → 宽高之半
//   节点省略 Width/Height → Master 默认尺寸（masters.xml <Rel r:id> → rels → masterN.xml）
// 用法（库）：const parsed = parseVsdx('flow.vsdx')
import { readFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const stripTags = (s) => s.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim();
const num = (s) => (s == null ? null : Number(s));

// ---- 深度扫描切出每个 <Shape ...> ... </Shape> 块 ----
function shapeBlocks(xml) {
  const blocks = [];
  const re = /<Shape\s+([^>]*?)(\/?)>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const attrStr = m[1];
    let end;
    if (m[2] === '/') {
      end = re.lastIndex;
    } else {
      let depth = 1, pos = re.lastIndex;
      while (depth > 0 && pos < xml.length) {
        const nextOpen = xml.indexOf('<Shape ', pos);
        const nextClose = xml.indexOf('</Shape>', pos);
        if (nextClose === -1) break;
        if (nextOpen !== -1 && nextOpen < nextClose) { depth++; pos = nextOpen + 7; }
        else { depth--; pos = nextClose + 8; if (depth === 0) end = nextClose + 8; }
      }
      re.lastIndex = end;
    }
    const attrs = {};
    for (const a of attrStr.match(/(\w+)='([^']*)'/g) || []) {
      const [k, v] = a.split('=');
      attrs[k] = v.slice(1, -1);
    }
    blocks.push({ attrs, block: xml.slice(m.index, end) });
  }
  return blocks;
}

// ---- Master 默认尺寸表：masters.xml 每个 <Master> 的 <Rel r:id> 经 rels 解析到 masterN.xml ----
function readMasterSizes(workDir) {
  const table = new Map();
  const mastersDir = join(workDir, 'visio', 'masters');
  const mastersPath = join(mastersDir, 'masters.xml');
  if (!existsSync(mastersPath)) return table;
  const relsPath = join(mastersDir, '_rels', 'masters.xml.rels');
  const relMap = new Map();
  if (existsSync(relsPath)) {
    for (const r of readFileSync(relsPath, 'utf8').matchAll(/<Relationship\s+Id=["'](rId\d+)["'][^>]*Target=["']([^"']+)["']\/>/g)) relMap.set(r[1], r[2]);
  }
  for (const block of readFileSync(mastersPath, 'utf8').match(/<Master\s[\s\S]*?<\/Master>/g) || []) {
    const id = block.match(/\bID='(\d+)'/)?.[1];
    const rel = block.match(/<Rel r:id='(rId\d+)'\/>/)?.[1];
    const file = rel ? relMap.get(rel) : null;
    if (!id || !file) continue;
    try {
      const mx = readFileSync(join(mastersDir, file), 'utf8');
      const width = num(mx.match(/<Cell N='Width'[^>]*?V='([^']+)'[^>]*\/>/)?.[1]);
      const height = num(mx.match(/<Cell N='Height'[^>]*?V='([^']+)'[^>]*\/>/)?.[1]);
      if (width != null && height != null) table.set(id, { width, height });
    } catch { /* master 文件缺失（连接线 master 无需尺寸） */ }
  }
  return table;
}

// ---- Geometry 折点：局部坐标 → 页面绝对坐标 ----
const shapePoints = (block, originX, originY) => {
  const pts = [];
  const geo = block.match(/<Section N='Geometry'[^>]*>([\s\S]*?)<\/Section>/);
  if (!geo) return pts;
  const rows = [...geo[1].matchAll(/<Row T='(MoveTo|LineTo)'[^>]*>([\s\S]*?)<\/Row>|<Row T='(MoveTo|LineTo)'[^>]*\/>/g)]
    .filter((row) => !/\bDel='1'/.test(row[0]));
  if (!rows.length) return pts;
  if ((rows[0][1] || rows[0][3]) !== 'MoveTo') pts.push({ x: originX, y: originY }); // 省略了默认全零的起点行
  for (const row of rows) {
    const body = row[2] || '';
    const x = num(body.match(/<Cell N='X'[^>]*?V='([^']+)'[^>]*\/>/)?.[1]) ?? 0; // 省略 → 默认 0
    const y = num(body.match(/<Cell N='Y'[^>]*?V='([^']+)'[^>]*\/>/)?.[1]) ?? 0;
    pts.push({ x: originX + x, y: originY + y });
  }
  return pts;
};

// ---- 粘附解析：F 公式里的 Sheet.N；无公式则按端点坐标就近匹配（静态贴附） ----
const glue = (f) => (f ? f.match(/Sheet\.(\d+)/)?.[1] : null);

/**
 * 解析 vsdx 文件，提取节点/连线/几何信息
 * @param {string} vsdxPath - vsdx 文件路径
 * @returns {{ vsdxPath, pageWidth, pageHeight, nodes: object[], edges: object[] }}
 *   节点 x/y 为左下角原点（英寸，y 向上），w/h 为英寸尺寸
 */
export function parseVsdx(vsdxPath) {
  const workDir = join(tmpdir(), 'vsdx-parse-' + Date.now());
  mkdirSync(workDir, { recursive: true });
  try {
    execSync(`powershell -NoProfile -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('${vsdxPath.replace(/\\/g, '\\\\')}', '${workDir.replace(/\\/g, '\\\\')}')"`, { stdio: 'pipe' });

    const xml = readFileSync(join(workDir, 'visio', 'pages', 'page1.xml'), 'utf8');
    const pagesXml = readFileSync(join(workDir, 'visio', 'pages', 'pages.xml'), 'utf8');
    const pageWidth = Number(pagesXml.match(/<Cell N='PageWidth' V='([^']+)'[^>]*\/>/)?.[1] || 0);
    const pageHeight = Number(pagesXml.match(/<Cell N='PageHeight' V='([^']+)'[^>]*\/>/)?.[1] || 0);
    const masterSizes = readMasterSizes(workDir);
    const isLine = (attrs) => attrs.Master === '6' || attrs.Master === '11' || /connector|连接线/i.test(attrs.NameU || '');

    const shapes = shapeBlocks(xml).map(({ attrs, block }) => {
      const cell = (n) => block.match(new RegExp(`<Cell N='${n}'[^>]*?V='([^']+)'`))?.[1];
      const cellF = (n) => block.match(new RegExp(`<Cell N='${n}'[^>]*?F='([^']+)'`))?.[1];
      const textMatch = block.match(/<Text>([\s\S]*?)<\/Text>/);
      const beginX = num(cell('BeginX')), beginY = num(cell('BeginY'));
      const endX = num(cell('EndX')), endY = num(cell('EndY'));
      let w = num(cell('Width'));
      let h = num(cell('Height'));
      if (isLine(attrs)) {
        if (w == null && beginX != null && endX != null) w = endX - beginX;
        if (h == null && beginY != null && endY != null) h = endY - beginY;
      } else if (attrs.Master && masterSizes.has(attrs.Master)) {
        const def = masterSizes.get(attrs.Master);
        if (w == null) w = def.width;
        if (h == null) h = def.height;
      }
      const locPinX = num(cell('LocPinX')) ?? (w != null ? w / 2 : null);
      const locPinY = num(cell('LocPinY')) ?? (h != null ? h / 2 : null);
      let pinX = num(cell('PinX')), pinY = num(cell('PinY'));
      if (pinX == null && beginX != null && locPinX != null) pinX = beginX + locPinX; // 省略 Pin 时按粘附点回算（Shape 199 实测）
      if (pinY == null && beginY != null && locPinY != null) pinY = beginY + locPinY;
      return {
        id: attrs.ID,
        nameU: attrs.NameU,
        type: attrs.Type,
        master: attrs.Master,
        pinX, pinY, w, h,
        x: pinX != null && locPinX != null ? pinX - locPinX : null,
        y: pinY != null && locPinY != null ? pinY - locPinY : null,
        beginX, beginY, endX, endY,
        begTriggerF: cellF('BegTrigger'),
        endTriggerF: cellF('EndTrigger'),
        text: textMatch ? stripTags(textMatch[1]).replace(/\s+/g, ' ') : '',
        points: shapePoints(block, pinX - (locPinX ?? 0), pinY - (locPinY ?? 0)),
      };
    });

    const lines = shapes.filter((s) => isLine({ Master: s.master, NameU: s.nameU }));
    const nodes = shapes.filter((s) => !isLine({ Master: s.master, NameU: s.nameU }));

    const edges = [];
    for (const ln of lines) {
      let srcId = glue(ln.begTriggerF);
      let tgtId = glue(ln.endTriggerF);
      if (!srcId || !tgtId) {
        const ptDist = (px, py, n) => {
          const dx = Math.max(Math.abs(px - n.pinX) - (n.w || 0) / 2, 0);
          const dy = Math.max(Math.abs(py - n.pinY) - (n.h || 0) / 2, 0);
          return Math.hypot(dx, dy);
        };
        const nearest = (px, py) => nodes.reduce((best, n) => {
          const d = ptDist(px, py, n);
          return (!best || d < best.d) ? { id: n.id, d } : best;
        }, null);
        if (!srcId) {
          const near = nearest(ln.beginX, ln.beginY);
          if (near && near.d < 0.15) srcId = near.id;
        }
        if (!tgtId) {
          const near = nearest(ln.endX, ln.endY);
          if (near && near.d < 0.15) tgtId = near.id;
        }
      }
      edges.push({
        lineId: ln.id, text: ln.text, srcId, tgtId,
        beginX: ln.beginX, beginY: ln.beginY, endX: ln.endX, endY: ln.endY,
        points: ln.points,
        static: !glue(ln.begTriggerF) || !glue(ln.endTriggerF),
      });
    }

    return { vsdxPath, pageWidth, pageHeight, nodes, edges };
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

/**
 * 打印解析统计（诊断用）
 */
export function reportVsdx(parsed) {
  console.log(`page: ${parsed.pageWidth}x${parsed.pageHeight}`);
  console.log(`nodes: ${parsed.nodes.length}, edges: ${parsed.edges.length}`);
  console.log(`edges full glue: ${parsed.edges.filter(e => e.srcId && e.tgtId).length}, static/inferred: ${parsed.edges.filter(e => e.static).length}`);
  const noGeo = parsed.edges.filter(e => !e.points.length).map(e => e.lineId);
  if (noGeo.length) console.log(`edges 无折点: ${noGeo.join(',')}`);
  const missing = parsed.edges.filter(e => !e.srcId || !e.tgtId).map(e => `${e.lineId}(${e.srcId}->${e.tgtId})`);
  if (missing.length) console.log(`edges missing src/tgt: ${missing.join(', ')}`);
  const noSize = parsed.nodes.filter(n => n.w == null || n.h == null).map(n => `${n.id}(${n.text.slice(0, 10)})`);
  if (noSize.length) console.log(`nodes 缺尺寸(master 回退后仍缺): ${noSize.join(', ')}`);
  let dev = 0;
  const devList = [];
  for (const e of parsed.edges) {
    if (e.points.length < 2 || e.beginX == null || e.endX == null) continue;
    const first = e.points[0], last = e.points[e.points.length - 1];
    if (Math.abs(first.x - e.beginX) > 0.01 || Math.abs(first.y - e.beginY) > 0.01) { dev++; devList.push(`#${e.lineId} 首`); }
    else if (Math.abs(last.x - e.endX) > 0.01 || Math.abs(last.y - e.endY) > 0.01) { dev++; devList.push(`#${e.lineId} 末`); }
  }
  console.log(`edges 折点端点 vs Begin/End 偏差: ${dev}/${parsed.edges.length}${dev ? ' -> ' + devList.join(',') : ''}`);
}
