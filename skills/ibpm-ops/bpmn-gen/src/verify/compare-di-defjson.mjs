// 对比真实导出包 bpmnXml DI 坐标与 defJson 坐标是否一致
// 用法（库）：const { same, diff } = compareDiDefjson(dir)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * @param {string} dir - zip 解压后的流程目录
 * @returns {{ok: boolean, same: number, diff: number}}
 */
export function compareDiDefjson(dir) {
  const raw = readFileSync(join(dir, 'bpmdefs.flow.xml'), 'utf8');
  const dec = raw.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

  const bpmnXml = dec.match(/<bpmnXml>([\s\S]*?)<\/bpmnXml>/)?.[1] || '';
  const defJsonRaw = dec.match(/<defJson>([\s\S]*?)<\/defJson>/)?.[1] || '';
  const defJson = JSON.parse(defJsonRaw);

  // bpmnXml DI shapes
  const diShapes = {};
  for (const m of bpmnXml.matchAll(/<bpmndi:BPMNShape bpmnElement="([^"]+)"[^>]*>\s*<omgdc:Bounds height="([\d.]+)" width="([\d.]+)" x="(-?[\d.]+)" y="(-?[\d.]+)"/g)) {
    diShapes[m[1]] = { w: +m[3], h: +m[2], x: +m[4], y: +m[5] };
  }
  // defJson shapes
  const djShapes = {};
  const walk = (sh) => {
    for (const c of sh || []) {
      if (c.stencil?.id !== 'SequenceFlow') {
        const b = c.bounds;
        djShapes[c.properties?.overrideid || c.resourceId] = { w: +b.lowerRight.x - +b.upperLeft.x, h: +b.lowerRight.y - +b.upperLeft.y, x: +b.upperLeft.x, y: +b.upperLeft.y, stencil: c.stencil?.id };
      }
      walk(c.childShapes);
    }
  };
  walk(defJson.childShapes);

  // bpmnXml DI edges waypoint 与 defJson dockers 对比（取样 3 条）
  const diEdges = {};
  for (const m of bpmnXml.matchAll(/<bpmndi:BPMNEdge bpmnElement="([^"]+)"[^>]*>([\s\S]*?)<\/bpmndi:BPMNEdge>/g)) {
    diEdges[m[1]] = [...m[2].matchAll(/<omgdi:waypoint x="(-?[\d.]+)" y="(-?[\d.]+)"\/>/g)].map(w => `(${w[1]},${w[2]})`);
  }
  const djEdges = {};
  const walk2 = (sh) => {
    for (const c of sh || []) {
      if (c.stencil?.id === 'SequenceFlow') {
        djEdges[c.resourceId] = c.dockers?.map(d => d.absolute ? `A(${d.x || d.absolute.x},${d.y || d.absolute.y})` : `R(${d.x},${d.y})`);
      }
      walk2(c.childShapes);
    }
  };
  walk2(defJson.childShapes);

  console.log('=== Shape 对比（bpmnXml DI vs defJson）===');
  let same = 0, diff = 0;
  for (const [id, di] of Object.entries(diShapes)) {
    const dj = djShapes[id];
    if (!dj) { console.log(`${id}: defJson 缺失`); diff++; continue; }
    const eq = Math.abs(di.x - dj.x) < 1 && Math.abs(di.y - dj.y) < 1 && Math.abs(di.w - dj.w) < 1 && Math.abs(di.h - dj.h) < 1;
    if (eq) same++; else { diff++; if (diff <= 5) console.log(`${id}: DI(${di.x},${di.y},${di.w}x${di.h}) defJson(${dj.x},${dj.y},${dj.w}x${dj.h}) ${dj.stencil}`); }
  }
  console.log(`一致 ${same} / 不一致 ${diff}`);

  console.log('\n=== Edge 对比（取样）===');
  const ids = Object.keys(diEdges).slice(0, 3);
  for (const id of ids) {
    console.log(`${id}:`);
    console.log('  DI :', diEdges[id].join(' '));
    console.log('  DJ :', (djEdges[id] || []).join(' '));
  }
  return { ok: diff === 0, same, diff };
}
