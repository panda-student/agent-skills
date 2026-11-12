// show 命令渲染：导出 zip → 解包 → defJson/nodeDispose 紧凑视图（省 token 的流程画像）
import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { flattenCalcs, summarizeRules } from './assignee-summary.mjs';
import { unesc } from './flowxml.mjs';

export function unzipToTemp(zipPath) {
  const dir = mkdtempSync(join(tmpdir(), 'ibpm-show-'));
  execSync(`tar -xf "${zipPath}" -C "${dir}"`, { stdio: 'pipe' });
  // 找流程目录（zip 顶层唯一目录）
  const [flowDir] = readdirSync(dir);
  return { dir: join(dir, flowDir), temp: dir };
}

/** defJson.childShapes → { nodes, edges }（show 的内存解析，不依赖导出包） */
function buildNodesEdges(def) {
  const shapes = def.childShapes || [];
  const P = s => s.properties || {};
  const idOf = s => P(s).overrideid || s.resourceId;

  const nodes = shapes.filter(s => s.stencil.id !== 'SequenceFlow').map(s => ({
    id: idOf(s),
    name: P(s).name || '',
    type: s.stencil.id,
    bounds: s.bounds,
  }));
  // 源节点索引：节点.outgoing[].resourceId = 边 id
  const edgeById = new Map(shapes.filter(s => s.stencil.id === 'SequenceFlow').map(e => [e.resourceId, e]));
  const edges = [...edgeById.values()].map(e => {
    const t = e.target && shapes.find(s => s.resourceId === e.target.resourceId);
    return {
      id: e.resourceId,
      name: P(e).name || '',
      cond: P(e).conditionsequenceflow || '',
      src: '?',
      tgt: t ? idOf(t) : '?',
    };
  });
  const edgeIdx = new Map(edges.map(e => [e.id, e]));
  for (const n of shapes.filter(s => s.stencil.id !== 'SequenceFlow')) {
    for (const o of (n.outgoing || [])) {
      const e = edgeIdx.get(o.resourceId);
      if (e) e.src = idOf(n);
    }
  }
  return { nodes, edges };
}

/** 在线 defJson 字符串 → show 渲染输入（不落盘、不下载） */
export function parseDefJsonModel(defJsonStr, meta) {
  const def = typeof defJsonStr === 'string' ? JSON.parse(defJsonStr) : defJsonStr;
  const { nodes, edges } = buildNodesEdges(def);
  return { def, meta, nodes, edges };
}

/** 解析 bpmdefs.flow.xml → { meta, nodes, edges, bpmn }（导出包路径保留给 import/迁移） */
export function parseFlowXml(xmlPath) {
  const xml = readFileSync(xmlPath, 'utf8');
  const def = JSON.parse(unesc(xml.match(/<defJson>([\s\S]*?)<\/defJson>/)[1]));
  const { nodes, edges } = buildNodesEdges(def);
  const bpmn = unesc(xml.match(/<bpmnXml>([\s\S]*?)<\/bpmnXml>/)[1]);
  const meta = {
    defKey: (xml.match(/defKey="([^"]*)"/) || [])[1] || '',
    name: (xml.match(/<bpmDefinition name="([^"]*)"/) || [])[1] || '',
    version: (xml.match(/version="([^"]*)"/) || [])[1] || '',
  };
  return { def, meta, nodes, edges, bpmn, xml };
}

/** getDefSetting.nodeUserMap → show 的审批人摘要 Map */
export function assignsFromUserMap(userMap, nodes) {
  const nameById = new Map((nodes || []).map(n => [n.nodeId || n.id, n.name]));
  const map = new Map();
  for (const [nodeId, rules] of Object.entries(userMap || {})) {
    const calcs = flattenCalcs(rules);
    if (!calcs.length) continue;
    const desc = summarizeRules(rules, 60);
    map.set(nodeId, {
      nodeName: nameById.get(nodeId) || nodeId,
      desc: desc || (rules[0] && rules[0].description) || '(空)',
      sources: String(calcs.length),
    });
  }
  return map;
}

/** getDefSetting.nodeUserMap → nodes 命令所需的 nodeDispose 结构（内存构造） */
export function nodeDisposeFromUserMap(userMap, nodes, defKey) {
  const nameById = new Map((nodes || []).map(n => [n.nodeId || n.id, n.name]));
  const order = (nodes || []).map(n => n.nodeId || n.id);
  const keys = order.length ? order : Object.keys(userMap || {});
  const data = [];
  for (const nodeId of keys) {
    const calcs = flattenCalcs(userMap?.[nodeId]);
    if (!calcs.length) continue;
    data.push({
      nodeKey: nodeId,
      nodeName: nameById.get(nodeId) || nodeId,
      cacl: calcs.map(c => JSON.stringify(c)).join(';'),
      sources: String(calcs.length),
    });
  }
  return [{ code: defKey, data }];
}

/** 解析 nodeDispose.json → Map<nodeKey, 摘要> */
export function parseNodeDispose(path) {
  const nd = JSON.parse(readFileSync(path, 'utf8'));
  const grp = Array.isArray(nd) ? nd[0] : nd;
  const map = new Map();
  for (const r of (grp.data || [])) {
    let cacl = r.cacl;
    // 多规则会签形态：多个 JSON 用 ";{" 拼接，逐段解析
    const rules = [];
    if (typeof cacl === 'string' && cacl.includes(';')) {
      for (const part of cacl.split(/;\s*(?=\{)/)) {
        try { rules.push(JSON.parse(part)); } catch { /* 忽略坏段 */ }
      }
    } else {
      try { const c = JSON.parse(cacl); rules.push(...(Array.isArray(c) ? c : [c])); } catch { /* 忽略 */ }
    }
    const desc = summarizeRules(rules, 60);
    map.set(r.nodeKey, { nodeName: r.nodeName, desc: desc || r.description || '(空)', sources: r.sources });
  }
  return map;
}

/** 渲染紧凑视图 */
export function renderShow(meta, nodes, edges, assigns) {
  const lines = [];
  lines.push(`流程: ${meta.name}（${meta.defKey}）`);
  const byId = new Map(nodes.map(n => [n.id, n]));
  // 主干链渲染：从 StartEvent 顺序走（遇网关展开分支）
  const start = nodes.find(n => n.type === 'StartNoneEvent' || n.type === 'StartEvent');
  const outEdges = id => edges.filter(e => e.src === id);
  const seen = new Set();

  function walk(id, depth, prefix) {
    if (seen.has(id)) { lines.push(`${prefix}[回到 ${byId.get(id)?.name || id}]`); return; }
    seen.add(id);
    const n = byId.get(id);
    if (!n) return;
    const icon = { StartNoneEvent: '○', StartEvent: '○', EndNoneEvent: '◎', EndEvent: '◎', XORGateway: '◇', ANDGateway: '◈', UserTask: '□', ServiceTask: '▥', CallActivity: '⬒' }[n.type] || '□';
    const a = assigns.get(id);
    const aDesc = (n.type === 'UserTask') ? (a ? ` ⟨${a.desc}⟩` : ' ⟨审批人未配置⟩') : '';
    lines.push(`${prefix}${icon} ${n.name || n.id}${aDesc}`);
    for (const e of outEdges(id)) {
      const label = e.name || e.cond ? ` --(${e.name || e.cond.slice(0, 50)})-->` : '-->';
      lines.push(`${' '.repeat(prefix.length)}   │${label}`);
      walk(e.tgt, depth + 1, prefix + '  ');
    }
  }
  if (start) walk(start.id, 0, '');
  lines.push(`\n节点: ${nodes.length}  边: ${edges.length}`);
  return lines.join('\n');
}
