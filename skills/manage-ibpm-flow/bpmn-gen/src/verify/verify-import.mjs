// 校验流程 ZIP 解包目录是否满足 IBPM 导入要求（导入失败修复后的回归校验）：
// system/sysName/tenantId/bounds 数字类型 + 结构完整性（可参数化期望数量） + DI 坐标一致性
// + waypoint 边界粘附 + 网关菱形顶点粘附 + 网关出线分散（作用于解包后的最终 bpmdefs.flow.xml，非生成前中间产物）
// DI 约定双轨（QT04001 平台导出实证）：生成器产物走全量微布局断言；
// 平台原生导出（DI 与 defJson 同尺寸，任务宽度随名称自适应）仅校验中心对齐，DI 保持平台原样零回归
// 用法（库）：const { ok, pass, fail } = verifyImport(dir, { expect: { nodes: 85, edges: 110, ... } })
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
let ENV = {};
try {
  ENV = JSON.parse(readFileSync(join(__dirname, '..', '..', 'config.json'), 'utf8'));
} catch { /* config 缺失时跳过环境相关断言 */ }
const SYSTEM = ENV.category?.system || '';

function unesc(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

/**
 * @param {string} dir - zip 解压后的流程目录
 * @param {object} [options]
 * @param {object} [options.expect] - 数量断言（不传则跳过数量检查）：
 *   { nodes, edges, userTasks, vars, extUser, extBase }
 * @param {string} [options.nodeDisposeTenantId='-1'] - nodeDispose 平台约定
 * @returns {{ok: boolean, pass: number, fail: number}}
 */
export function verifyImport(dir, options = {}) {
  const expect = options.expect || {};
  const ndTenantId = options.nodeDisposeTenantId ?? '-1';
  const xml = readFileSync(resolve(dir, 'bpmdefs.flow.xml'), 'utf8');

  const bpmnXml = unesc(xml.match(/<bpmnXml>([\s\S]*?)<\/bpmnXml>/)[1]);
  const defJson = JSON.parse(unesc(xml.match(/<defJson>([\s\S]*?)<\/defJson>/)[1]));
  const nd = JSON.parse(readFileSync(resolve(dir, 'nodeDispose.json'), 'utf8'));

  let pass = 0, fail = 0;
  const check = (name, cond, detail) => {
    if (cond) { pass++; console.log(`✅ ${name}`); }
    else { fail++; console.log(`❌ ${name}${detail ? ': ' + detail : ''}`); }
  };

  console.log('===== 修复验证 =====');
  if (SYSTEM) {
    check('bpmDefinition system', xml.includes(`system="${SYSTEM}"`));
    check('nodeDispose sysName', nd[0].data.every(r => r.sysName === SYSTEM));
  }
  check('nodeDispose tenantId 约定', nd[0].data.every(r => r.tenantId === ndTenantId));

  let strB = 0, total = 0;
  const walk = (s) => {
    total++;
    if (s.bounds) {
      const vals = [s.bounds.upperLeft?.x, s.bounds.upperLeft?.y, s.bounds.lowerRight?.x, s.bounds.lowerRight?.y];
      if (vals.some(v => typeof v === 'string')) strB++;
    }
    (s.childShapes || []).forEach(walk);
  };
  (defJson.childShapes || []).forEach(walk);
  check(`defJson bounds 全数字 (${total} shapes, ${strB} 字符串)`, strB === 0);
  check('defJson 顶层 bounds 数字', typeof defJson.bounds.upperLeft.x === 'number' && typeof defJson.bounds.lowerRight.y === 'number');

  // 结构完整性回归
  const seqFlows = [...bpmnXml.matchAll(/<sequenceFlow id="([^"]+)"[^>]*sourceRef="([^"]+)"[^>]*targetRef="([^"]+)"/g)].map(m => ({ id: m[1], source: m[2], target: m[3] }));
  const bpmnNodes = [...bpmnXml.matchAll(/<(userTask|startEvent|endEvent|exclusiveGateway)\b[^>]*\bid="([^"]+)"/g)].map(m => ({ type: m[1], id: m[2] }));
  if (expect.nodes != null || expect.edges != null) {
    check(`bpmnXml 节点${expect.nodes ?? '-'}/边${expect.edges ?? '-'} (实际 ${bpmnNodes.length}/${seqFlows.length})`,
      (expect.nodes == null || bpmnNodes.length === expect.nodes) && (expect.edges == null || seqFlows.length === expect.edges));
  }

  const allRes = new Set();
  const defEdges = [], defNodes = [];
  const walk2 = (s) => {
    allRes.add(s.resourceId);
    if (s.stencil?.id === 'SequenceFlow') defEdges.push(s); else defNodes.push(s);
    (s.childShapes || []).forEach(walk2);
  };
  (defJson.childShapes || []).forEach(walk2);
  if (expect.nodes != null && expect.edges != null) {
    check(`defJson shapes ${expect.nodes + expect.edges} (${expect.nodes} 节点 + ${expect.edges} 边)`,
      defNodes.length === expect.nodes && defEdges.length === expect.edges);
  }
  check('边 resourceId = sequenceFlow id', seqFlows.every(f => allRes.has(f.id)) && defEdges.every(e => seqFlows.some(f => f.id === e.resourceId)));
  const nodeOids = new Set(defNodes.map(n => n.properties?.overrideid).filter(Boolean));
  check('节点 overrideid = bpmnXml 节点 id', bpmnNodes.every(n => nodeOids.has(n.id)) && nodeOids.size === bpmnNodes.length);

  const diShapes = [...bpmnXml.matchAll(/<bpmndi:BPMNShape\s+bpmnElement="([^"]+)"/g)].map(m => m[1]);
  const diEdges = [...bpmnXml.matchAll(/<bpmndi:BPMNEdge\s+bpmnElement="([^"]+)"/g)].map(m => m[1]);
  check(`DI 段完整 (Shape ${diShapes.length}, Edge ${diEdges.length})`,
    diShapes.length === bpmnNodes.length && diEdges.length === seqFlows.length);

  const ep = bpmnXml.match(/<ext:extProcess>[\s\S]*?<\/ext:extProcess>/)?.[0] || '';
  const extUser = [...ep.matchAll(/<ext:userNode\s+[^>]*bpmnElement="([^"]+)"/g)].map(m => m[1]);
  const extBase = [...ep.matchAll(/<ext:baseNode\s+[^>]*bpmnElement="([^"]+)"/g)].map(m => m[1]);
  if (expect.extUser != null || expect.extBase != null) {
    check(`extProcess (userNode ${extUser.length}${expect.extUser != null ? '/' + expect.extUser : ''}, baseNode ${extBase.length}${expect.extBase != null ? '/' + expect.extBase : ''})`,
      (expect.extUser == null || extUser.length === expect.extUser) && (expect.extBase == null || extBase.length === expect.extBase));
  }

  const userTaskCount = nd[0].data.length;
  if (expect.userTasks != null) {
    check(`nodeDispose 覆盖 ${expect.userTasks} userTask (实际 ${userTaskCount})`, userTaskCount === expect.userTasks);
  }
  if (expect.vars != null) {
    check(`变量声明 ${expect.vars} 个 (实际 ${(bpmnXml.match(/<ext:variableDef>/g) || []).length})`, (bpmnXml.match(/<ext:variableDef>/g) || []).length === expect.vars);
  }

  // outgoing/incoming 引用完整性
  let bad = 0;
  for (const s of [...defNodes, ...defEdges]) {
    for (const r of [...(s.outgoing || []), ...(s.incoming || [])]) if (!allRes.has(r.resourceId)) bad++;
  }
  check('defJson 引用完整', bad === 0);

  // defJson 与 bpmnXml DI 布局校验（两种约定自动识别，QT04001 平台导出实证）：
  // ① 生成器产物：DI 独立尺寸体系（事件36x36/网关50x50/任务100x80）与 defJson 中心对齐，
  //    且 waypoint 首末粘附形状边界、网关端点落菱形顶点
  // ② 平台原生导出：DI 与 defJson 同尺寸同中心（任务宽度随名称自适应），DI 由平台设计器自行管理，
  //    仅校验中心对齐，不套用生成器微布局断言（该 DI 本就经平台导入渲染，保持原样零回归）
  const nodeByOid = new Map(defNodes.map(n => [n.properties.overrideid, n]));
  const diShapesAll = [...bpmnXml.matchAll(/<bpmndi:BPMNShape\s+bpmnElement="([^"]+)"[^>]*>\s*<omgdc:Bounds height="([\d.]+)" width="([\d.]+)" x="([\d.-]+)" y="([\d.-]+)"/g)]
    .map(m => ({ oid: m[1], h: +m[2], w: +m[3], x: +m[4], y: +m[5] }));
  const platformNativeDi = diShapesAll.every(d => {
    const shape = nodeByOid.get(d.oid);
    const b = shape?.bounds;
    return !b || (Math.abs(d.w - (b.lowerRight.x - b.upperLeft.x)) < 0.01 && Math.abs(d.h - (b.lowerRight.y - b.upperLeft.y)) < 0.01);
  });
  let diOffCenter = 0;
  for (const d of diShapesAll) {
    const shape = nodeByOid.get(d.oid);
    if (!shape) { diOffCenter++; continue; }
    const b = shape.bounds;
    const dx = d.x + d.w / 2 - (b.upperLeft.x + (b.lowerRight.x - b.upperLeft.x) / 2);
    const dy = d.y + d.h / 2 - (b.upperLeft.y + (b.lowerRight.y - b.upperLeft.y) / 2);
    if (Math.abs(dx) > 1.01 || Math.abs(dy) > 1.01) diOffCenter++;
  }
  check(`DI 与 defJson 中心对齐 (${diOffCenter} 异常, ${platformNativeDi ? '平台原生DI' : '生成器DI'}约定)`, diOffCenter === 0);

  if (!platformNativeDi) {
    const diSizeOf = (stencil) => {
      if (stencil === 'StartEvent' || stencil === 'EndEvent') return { w: 36, h: 36 };
      if (['XORGateway', 'ANDGateway', 'ORGateway'].includes(stencil)) return { w: 50, h: 50 };
      if (/Task$/.test(stencil) || stencil === 'Subprocess') return { w: 100, h: 80 };
      return null;
    };
    let diMismatch = 0;
    for (const d of diShapesAll) {
      const shape = nodeByOid.get(d.oid);
      if (!shape) continue; // 无对应 defJson 的已在中心对齐计数
      const expect = diSizeOf(shape.stencil?.id);
      if (!expect) continue;
      if (d.w !== expect.w || d.h !== expect.h) diMismatch++;
    }
    check(`DI 尺寸标准映射 (${diMismatch} 异常)`, diMismatch === 0);
  }

  const flowRefs = new Map([...bpmnXml.matchAll(/<sequenceFlow id="([^"]+)"[^>]*sourceRef="([^"]+)"[^>]*targetRef="([^"]+)"/g)].map(m => [m[1], { src: m[2], tgt: m[3] }]));
  const diRects = new Map([...bpmnXml.matchAll(/<bpmndi:BPMNShape\s+bpmnElement="([^"]+)"[^>]*>\s*<omgdc:Bounds height="([\d.]+)" width="([\d.]+)" x="([\d.-]+)" y="([\d.-]+)"/g)].map(m => [m[1], { x: +m[4], y: +m[5], w: +m[3], h: +m[2] }]));
  const GW_ST = ['XORGateway', 'ANDGateway', 'ORGateway'];

  if (!platformNativeDi) {
    // DI 首末 waypoint 粘附形状边界（真实导出实证落在边框上；落在中心会让 IBPM 流程图箭头指进形状内部）
    const onBoundary = (p, r) => p.x >= r.x - 0.5 && p.x <= r.x + r.w + 0.5 && p.y >= r.y - 0.5 && p.y <= r.y + r.h + 0.5
      && (Math.abs(p.x - r.x) < 0.5 || Math.abs(p.x - r.x - r.w) < 0.5 || Math.abs(p.y - r.y) < 0.5 || Math.abs(p.y - r.y - r.h) < 0.5);
    let wpOk = 0, wpBad = 0;
    for (const m of bpmnXml.matchAll(/<bpmndi:BPMNEdge\s+bpmnElement="([^"]+)"[^>]*>([\s\S]*?)<\/bpmndi:BPMNEdge>/g)) {
      const refs = flowRefs.get(m[1]);
      const wps = [...m[2].matchAll(/<omgdi:waypoint x="([\d.-]+)" y="([\d.-]+)"\/>/g)].map(w => ({ x: +w[1], y: +w[2] }));
      const sr = refs && diRects.get(refs.src), tr = refs && diRects.get(refs.tgt);
      if (!sr || !tr || wps.length < 2) { wpBad++; continue; }
      if (onBoundary(wps[0], sr) && onBoundary(wps[wps.length - 1], tr)) wpOk++; else wpBad++;
    }
    check(`DI 首末 waypoint 粘附形状边界 (${wpOk}/${wpOk + wpBad})`, wpBad === 0);

    // DI 网关端点菱形顶点粘附：配置/查看页按菱形渲染，端点须落在菱形顶点（= DI 矩形四边中点）。
    // 落在矩形角/边框其它位置会「连到边上」甚至配置页直接断线
    let gwOk = 0, gwBad = 0;
    const gwBadEdges = [];
    for (const m of bpmnXml.matchAll(/<bpmndi:BPMNEdge\s+bpmnElement="([^"]+)"[^>]*>([\s\S]*?)<\/bpmndi:BPMNEdge>/g)) {
      const refs = flowRefs.get(m[1]);
      const wps = [...m[2].matchAll(/<omgdi:waypoint x="([\d.-]+)" y="([\d.-]+)"\/>/g)].map(w => ({ x: +w[1], y: +w[2] }));
      if (!refs || wps.length < 2) continue;
      for (const [ref, p] of [[refs.src, wps[0]], [refs.tgt, wps[wps.length - 1]]]) {
        const shape = nodeByOid.get(ref);
        if (!shape || !GW_ST.includes(shape.stencil?.id)) continue;
        const r = diRects.get(ref);
        if (!r) { gwBad++; gwBadEdges.push(m[1]); continue; }
        const dx = p.x - (r.x + r.w / 2), dy = p.y - (r.y + r.h / 2);
        const onVertex = (Math.abs(Math.abs(dx) - r.w / 2) < 0.6 && Math.abs(dy) < 0.6)
          || (Math.abs(Math.abs(dy) - r.h / 2) < 0.6 && Math.abs(dx) < 0.6);
        if (onVertex) gwOk++; else { gwBad++; gwBadEdges.push(m[1]); }
      }
    }
    check(`DI 网关端点菱形顶点粘附 (${gwOk}/${gwOk + gwBad})${gwBadEdges.length ? ' 异常: ' + [...new Set(gwBadEdges)].slice(0, 3).join(', ') : ''}`, gwBad === 0);
  }

  // 网关出线分散：同网关多条出线同顶点同方向出发，共线重叠段 >60px 判拥挤。
  // 短共享干道后垂直分叉是标准 Y 形分支，不判拥挤
  const gwOut = new Map();
  for (const m of bpmnXml.matchAll(/<bpmndi:BPMNEdge\s+bpmnElement="([^"]+)"[^>]*>([\s\S]*?)<\/bpmndi:BPMNEdge>/g)) {
    const refs = flowRefs.get(m[1]);
    const wps = [...m[2].matchAll(/<omgdi:waypoint x="([\d.-]+)" y="([\d.-]+)"\/>/g)].map(w => ({ x: +w[1], y: +w[2] }));
    if (!refs || wps.length < 2) continue;
    const shape = nodeByOid.get(refs.src);
    if (!shape || !GW_ST.includes(shape.stencil?.id)) continue;
    const r = diRects.get(refs.src);
    if (!r) continue;
    const dx = wps[0].x - (r.x + r.w / 2), dy = wps[0].y - (r.y + r.h / 2);
    const exit = Math.abs(Math.abs(dx) - r.w / 2) < 0.6 && Math.abs(dy) < 0.6 ? (dx > 0 ? 'R' : 'L')
      : Math.abs(Math.abs(dy) - r.h / 2) < 0.6 && Math.abs(dx) < 0.6 ? (dy > 0 ? 'B' : 'T') : 'X';
    const dir = Math.abs(wps[1].x - wps[0].x) >= Math.abs(wps[1].y - wps[0].y)
      ? (wps[1].x >= wps[0].x ? 'h+' : 'h-') : (wps[1].y >= wps[0].y ? 'v+' : 'v-');
    if (!gwOut.has(refs.src)) gwOut.set(refs.src, []);
    gwOut.get(refs.src).push({ id: m[1], key: exit + dir, segLen: Math.hypot(wps[1].x - wps[0].x, wps[1].y - wps[0].y) });
  }
  let outTotal = 0;
  const crowdedPairs = [];
  for (const list of gwOut.values()) {
    outTotal += list.length;
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      if (list[i].key === list[j].key && Math.min(list[i].segLen, list[j].segLen) > 60) crowdedPairs.push(list[i].id);
    }
  }
  check(`网关出线分散无共线拥挤 (${outTotal} 条出线)${crowdedPairs.length ? ' 拥挤: ' + [...new Set(crowdedPairs)].slice(0, 3).join(', ') : ''}`, crowdedPairs.length === 0);

  console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
  return { ok: fail === 0, pass, fail };
}
