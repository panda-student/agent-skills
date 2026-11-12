// 语义手术核心：addNode / connect / setCondition / setAssignee / removeNode / varAdd / varRemove
// 操作对象 = readFlow 产物（flow.def + flow.bpmn）+ nodeDispose JSON（nd），全部原地修改后由 writeFlow 落盘
// 三份同步铁律：defJson(shape/边) ↔ bpmnXml(process/DI/extProcess/varDefs) ↔ nodeDispose(审批人)
import { sid, snowflake, orthPath, dockersFrom, boundsOf, cloneNodeShape } from './layout.mjs';
import {
  nodeById, idOf, edgesOf, edgeBetween, edgesAround,
  findNodeXml, findShapeBounds, findSeqFlow, findEdgeXml, findUserNode, findSignNode, findExtPlugins,
  findVarDefs, parseVars, varDefXml,
} from './flowxml.mjs';
import { buildRulesFromArgs, userAssignXml, disposeFields } from './userassign.mjs';
import { summarizeRules } from './assignee-summary.mjs';
import { buildPropers } from '../bpmn-gen/src/generate/build-extprocess.mjs';

const die = msg => { throw new Error(msg); };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ==================== 会签节点模板（与平台设计器产出的 SignTask 形态对齐） ====================

const SIGN_TASK_LISTENERS = {
  taskListeners: [
    { event: 'create', delegateExpression: '${taskSignCreateListener}' },
    { event: 'complete', delegateExpression: '${taskCompleteListener}' },
  ],
};

// defJson shape：在普通 UserTask shape 基础上覆盖为会签形态
// 默认串行：IBPM openapi complete4instid 多 task 会拒绝，串行可逐个完成并按 account 记真实审批人
function applySignShape(shape) {
  shape.stencil = { id: 'SignTask' };
  shape.properties.tasklisteners = JSON.parse(JSON.stringify(SIGN_TASK_LISTENERS));
  shape.properties.multiinstance_type = 'Sequential';
  shape.properties.multiinstance_collection = '${actUserService.getSignUser(execution)}';
  shape.properties.multiinstance_variable = 'assignee';
  shape.properties.multiinstance_condition = '${signComplete.isComplete(execution) }';
}

// bpmnXml userTask：multi-instance 串行会签（默认，保真实审批人记账）
function signTaskXml(key, name) {
  return `<userTask id="${key}" name="${esc(name)}" i18nKey="">\n`
    + `      <extensionElements>\n`
    + `        <activiti:taskListener event="create" delegateExpression="\${taskSignCreateListener}"/>\n`
    + `        <activiti:taskListener event="complete" delegateExpression="\${taskCompleteListener}"/>\n`
    + `      </extensionElements>\n`
    + `      <multiInstanceLoopCharacteristics isSequential="true" activiti:collection="\${actUserService.getSignUser(execution)}" activiti:elementVariable="assignee">\n`
    + `        <completionCondition>\${signComplete.isComplete(execution) }</completionCondition>\n`
    + `      </multiInstanceLoopCharacteristics>\n`
    + `    </userTask>`;
}

// extProcess signNode：审批人规则必须写在这里，平台导入时据此重建 nodeDispose cacl
function signNodeXml(key, name, plugins) {
  // 会签节点默认允许接口审批（自动化/E2E 依赖）；executorIsEmpty=jump 保留“执行人为空自动跳过”
  const propers = buildPropers({ allowInterfaceApproval: 'true', executorIsEmpty: 'jump' });
  return `<ext:signNode nodeType="common" name="${esc(name)}" bpmnElement="${key}">\n`
    + `        <ext:signSetting>\n`
    + `          <ext:signRule decideType="refuse" voteType="amount" voteAmount="1" followMode="complete"/>\n`
    + `        </ext:signSetting>\n`
    + `        ${plugins}\n`
    + `        ${propers}\n`
    + `      </ext:signNode>`;
}

function diBox(shape) {
  // 由 defJson bounds 推 DI box（中心对齐、固定尺寸 100x80 / 网关 50x50 / 事件 36x36）
  const w0 = shape.bounds.lowerRight.x - shape.bounds.upperLeft.x;
  const h0 = shape.bounds.lowerRight.y - shape.bounds.upperLeft.y;
  const cx = (shape.bounds.upperLeft.x + shape.bounds.lowerRight.x) / 2;
  const cy = (shape.bounds.upperLeft.y + shape.bounds.lowerRight.y) / 2;
  const stencil = shape.stencil.id;
  const [w, h] = stencil.includes('Gateway') ? [50, 50]
    : stencil.includes('Event') ? [36, 36] : [100, 80];
  return { x: +(cx - w / 2).toFixed(1), y: +(cy - h / 2).toFixed(1), w, h };
}
const box = b => ({ x: b.upperLeft.x, y: b.upperLeft.y, w: b.lowerRight.x - b.upperLeft.x, h: b.lowerRight.y - b.upperLeft.y });

// ---------- 加节点 ----------
/**
 * @param args {key,name,after,mode:'insert'|'branch',sign,assigneeArgs}
 * insert：after 的唯一出边 after→Z 改为 after→X + X→Z（链中插入）
 * branch：仅新增 after→X 分支边
 * sign：直接创建会签节点（SignTask：multi-instance + taskSignCreateListener + ext:signNode），
 *       避免先用普通节点再回设计器改类型导致节点 ID 重建、取人规则丢失
 */
export function addNode(flow, nd, args) {
  const { key, name, after, mode = 'insert', sign = false } = args;
  const ref = nodeById(flow.def, after) || die(`参照节点 ${after} 不存在`);
  if (nodeById(flow.def, key)) die(`节点 ${key} 已存在`);
  if (!ref.properties.tasklisteners && idOf(ref).startsWith('G_')) die('网关不能作为 add-node 参照，请用 connect');
  if (mode === 'insert') {
    const { outs } = edgesAround(flow.def, after);
    if (outs.length > 1) die(`${after} 有 ${outs.length} 条出边（网关），插链请用 --branch 模式后自行 connect`);
  }
  const resId = sid();
  const refBoxDi = findShapeBounds(flow.bpmn, after) || die(`bpmnXml 缺少 ${after} 的 DI Shape`);
  const dx = (refBoxDi.w || 100) + 80;   // defJson 与 DI 同位移，保证中心对齐
  const shape = cloneNodeShape(ref, key, name, resId, 0, dx);
  if (sign) applySignShape(shape);
  flow.def.childShapes.push(shape);

  // bpmn userTask（普通节点 listener 模板 from 参照；会签节点用 SignTask 模板）
  const refTask = findNodeXml(flow.bpmn, after) || die(`bpmnXml 缺少参照节点 ${after}`);
  let taskXml;
  if (sign) {
    taskXml = signTaskXml(key, name);
  } else {
    const listeners = refTask[0].match(/<extensionElements>[\s\S]*?<\/extensionElements>/)?.[0]
      || '<extensionElements></extensionElements>';
    taskXml = `<userTask id="${key}" name="${esc(name)}" i18nKey="">\n      ${listeners}\n    </userTask>`;
  }
  flow.bpmn = flow.bpmn.replace(refTask[0], refTask[0] + '\n    ' + taskXml);

  // DI Shape（ref DI + 同位移 dx）
  const shapeXml = `<bpmndi:BPMNShape bpmnElement="${key}" id="BPMNShape_${key}">\n        <omgdc:Bounds height="${refBoxDi.h}" width="${refBoxDi.w}" x="${(refBoxDi.x + dx).toFixed(1)}" y="${refBoxDi.y.toFixed(1)}"/>\n      </bpmndi:BPMNShape>`;
  flow.bpmn = flow.bpmn.replace(
    new RegExp(`(<bpmndi:BPMNShape bpmnElement="${after}" id="BPMNShape_${after}">[\\s\\S]*?<\\/bpmndi:BPMNShape>)`),
    `$1\n      ${shapeXml}`);

  // extProcess：会签节点生成 ext:signNode（审批人规则落在这里，导入时平台据此重建 nodeDispose）；
  // 普通节点沿用 ext:userNode 克隆（ref 为模板，换 extPlugins）
  const plugins = `<ext:extPlugins>${newAssignPlugins(nd, { ...args, nodeName: name })}</ext:extPlugins>`;
  if (sign) {
    const sn = signNodeXml(key, name, plugins);
    const refNode = findUserNode(flow.bpmn, after) || findSignNode(flow.bpmn, after);
    if (refNode) flow.bpmn = flow.bpmn.replace(refNode[0], refNode[0] + '\n      ' + sn);
    else flow.bpmn = flow.bpmn.replace('</ext:extNodes>', '      ' + sn + '\n    </ext:extNodes>');
  } else {
    const refNode = findUserNode(flow.bpmn, after);
    if (refNode) {
      let un = refNode[0]
        .replace(`bpmnElement="${after}"`, `bpmnElement="${key}"`)
        .replace(new RegExp(`name="[^"]*"`), `name="${esc(name)}"`);
      const oldPlugins = findExtPlugins(un);
      if (oldPlugins) un = un.replace(oldPlugins[0], plugins);
      else un = un.replace('<ext:extPlugins/>', plugins);
      flow.bpmn = flow.bpmn.replace(refNode[0], refNode[0] + '\n      ' + un);
    }
  }

  // nodeDispose 条目
  if (nd) {
    const grp = Array.isArray(nd) ? nd.find(g => g.code === flow.meta.defKey) : null;
    if (grp) {
      const refRec = grp.data.find(d => d.nodeKey === after) || {};
      const rules = buildRulesFromArgs(args.assigneeArgs || {}, name);
      const descs = rules.map(r => r.displayDesc);
      const fields = disposeFields(rules.map(r => r.rule), descs);
      const id = snowflake();
      grp.data.push({
        ...JSON.parse(JSON.stringify(refRec)), ...fields,
        id, pkVal: id, nodeKey: key, nodeName: name,
        nodeType: sign ? 'signTask' : (refRec.nodeType || 'userTask'),
        description: fields.description, cacl: fields.cacl, pluginType: fields.pluginType,
        sources: String(rules.length), actionType: '审批', actionTypeId: '1', isDele: '0',
      });
    }
  }

  // 连线
  if (mode === 'insert') {
    const { outs } = edgesAround(flow.def, after);
    if (outs.length === 1) {
      const e = outs[0];
      const zKey = e.target ? idOf(flow.def.childShapes.find(s => s.resourceId === e.target.resourceId) || {}) : null;
      // after→Z 改为 after→X
      e.target = { resourceId: resId };
      const seq = findSeqFlow(flow.bpmn, e.resourceId);
      if (seq) flow.bpmn = flow.bpmn.replace(seq[0], seq[0].replace(`targetRef="${zKey}"`, `targetRef="${key}"`));
      relayoutEdge(flow, e);
      addEdge(flow, { from: key, to: zKey, name: '', cond: '' });
    }
  } else {
    addEdge(flow, { from: after, to: key, name: '', cond: '' });
  }
  return `节点 ${key}「${name}」已添加（${mode === 'insert' ? '插链' : '分支'}于 ${after} 之后${sign ? '，会签节点' : ''}）`;
}

// ---------- 边重排（source/target 变更后重算正交折线） ----------
function relayoutEdge(flow, e) {
  const srcNode = flow.def.childShapes.find(s => (s.outgoing || []).some(o => o.resourceId === e.resourceId));
  const tgtNode = flow.def.childShapes.find(s => s.resourceId === e.target?.resourceId);
  if (!srcNode || !tgtNode) return;
  const wps = orthPath(diBox(srcNode), diBox(tgtNode));
  e.dockers = dockersFrom(wps, box(srcNode.bounds), box(tgtNode.bounds));
  e.bounds = boundsOf(wps);
  const edge = findEdgeXml(flow.bpmn, e.resourceId);
  if (edge) {
    const next = `<bpmndi:BPMNEdge bpmnElement="${e.resourceId}" id="BPMNEdge_${e.resourceId}">\n`
      + wps.map(p => `        <omgdi:waypoint x="${p[0].toFixed(1)}" y="${p[1].toFixed(1)}"/>`).join('\n')
      + `\n      </bpmndi:BPMNEdge>`;
    flow.bpmn = flow.bpmn.replace(edge[0], next);
  }
}

// ---------- 加连线 ----------
export function addEdge(flow, { from, to, name, cond }) {
  const src = nodeById(flow.def, from) || die(`节点 ${from} 不存在`);
  const tgt = nodeById(flow.def, to) || die(`节点 ${to} 不存在`);
  if (edgeBetween(flow.def, from, to)) die(`连线 ${from}→${to} 已存在`);
  const rid = sid();
  const srcB = diBox(src), tgtB = diBox(tgt);
  const wps = orthPath(srcB, tgtB);
  const edge = {
    resourceId: rid,
    properties: { overrideid: '', name: name || '', documentation: '', conditionsequenceflow: cond || '', defaultflow: 'false' },
    stencil: { id: 'SequenceFlow' },
    childShapes: [],
    outgoing: [{ resourceId: tgt.resourceId }],
    bounds: boundsOf(wps),
    dockers: dockersFrom(wps, box(src.bounds), box(tgt.bounds)),
    target: { resourceId: tgt.resourceId },
  };
  flow.def.childShapes.push(edge);
  src.outgoing = [...(src.outgoing || []), { resourceId: rid }];

  const seqXml = `    <sequenceFlow id="${rid}"${name ? ` name="${esc(name)}"` : ''} sourceRef="${from}" targetRef="${to}">`
    + (cond ? `\n      <conditionExpression xsi:type="tFormalExpression"><![CDATA[${cond}]]></conditionExpression>\n    ` : '')
    + `</sequenceFlow>`;
  // sequenceFlow 归 process 段（</process> 前），DI Edge 归 BPMNPlane 段尾——两段不可混
  flow.bpmn = flow.bpmn.replace('</process>', seqXml + '\n  </process>');
  flow.bpmn = flow.bpmn.replace('</bpmndi:BPMNPlane>',
    `<bpmndi:BPMNEdge bpmnElement="${rid}" id="BPMNEdge_${rid}">\n`
    + wps.map(p => `        <omgdi:waypoint x="${p[0].toFixed(1)}" y="${p[1].toFixed(1)}"/>`).join('\n')
    + `\n      </bpmndi:BPMNEdge>\n    </bpmndi:BPMNPlane>`);
  return `连线 ${from}→${to} 已添加`;
}

// ---------- 改边条件/名称（按 from→to 定位） ----------
export function setCondition(flow, { from, to, expr, name }) {
  const e = edgeBetween(flow.def, from, to) || die(`连线 ${from}→${to} 不存在`);
  if (expr !== undefined) e.properties.conditionsequenceflow = expr;
  if (name !== undefined) e.properties.name = name;
  const seq = findSeqFlow(flow.bpmn, e.resourceId) || die(`bpmnXml 缺少 sequenceFlow ${e.resourceId}`);
  let s = seq[0];
  if (expr !== undefined) {
    if (/<conditionExpression/.test(s)) s = s.replace(/<conditionExpression[^>]*>[\s\S]*?<\/conditionExpression>/,
      `<conditionExpression xsi:type="tFormalExpression"><![CDATA[${expr}]]></conditionExpression>`);
    else s = s.replace(/\/>$/, `>\n      <conditionExpression xsi:type="tFormalExpression"><![CDATA[${expr}]]></conditionExpression>\n    </sequenceFlow>`);
  }
  if (name !== undefined) s = s.replace(/ name="[^"]*"/, ` name="${esc(name)}"`);
  flow.bpmn = flow.bpmn.replace(seq[0], s);
  return `连线 ${from}→${to} 已更新（cond=${expr ?? '不变'} name=${name ?? '不变'}）`;
}

// ---------- 删连线（按 from→to 定位） ----------
export function removeEdge(flow, { from, to }) {
  const e = edgeBetween(flow.def, from, to) || die(`连线 ${from}→${to} 不存在`);
  flow.def.childShapes = flow.def.childShapes.filter(s => s.resourceId !== e.resourceId);
  for (const s of flow.def.childShapes) {
    if (s.outgoing) s.outgoing = s.outgoing.filter(o => o.resourceId !== e.resourceId);
  }
  const seq = findSeqFlow(flow.bpmn, e.resourceId);
  if (seq) flow.bpmn = flow.bpmn.replace(seq[0] + '\n    ', '').replace(seq[0], '');
  const edge = findEdgeXml(flow.bpmn, e.resourceId);
  if (edge) flow.bpmn = flow.bpmn.replace(edge[0] + '\n      ', '').replace(edge[0], '');
  return `连线 ${from}→${to} 已删除`;
}

// ---------- 改审批人 ----------
export function setAssignee(flow, nd, { key, assigneeArgs, logicCal }) {
  const node = nodeById(flow.def, key) || die(`节点 ${key} 不存在`);
  const nodeName = node.properties?.name || key;
  const grp = Array.isArray(nd) ? nd.find(g => g.code === flow.meta.defKey) : null;
  if (!grp) die('nodeDispose 无该流程分组');

  const rules = buildRulesFromArgs(assigneeArgs, nodeName);
  if (logicCal) for (const r of rules) r.rule.logicCal = logicCal;
  const descs = rules.map(r => r.displayDesc);
  const fields = disposeFields(rules.map(r => r.rule), descs);
  // 会签节点（ext:signNode）：取人规则必须落 extPlugins，平台导入时据此重建 nodeDispose cacl；
  // 只写 nodeDispose 会被导入重建清空（2026-11-04 QT04001 实证）
  const isSign = !!findSignNode(flow.bpmn, key);
  const nodeType = isSign ? 'signTask' : 'userTask';

  const rec = grp.data.find(d => d.nodeKey === key);
  if (rec) Object.assign(rec, fields, { sources: String(rules.length), nodeType });
  else grp.data.push({ id: snowflake(), pkVal: snowflake(), processName: flow.meta.name, processKey: flow.meta.defKey, nodeKey: key, nodeName, nodeType, ...fields, sources: String(rules.length), isDele: '0', actionType: '审批', actionTypeId: '1', tenantId: '-1' });

  // extProcess userNode/signNode extPlugins 同步
  const extNode = findUserNode(flow.bpmn, key) || findSignNode(flow.bpmn, key);
  if (extNode) {
    const plugins = `<ext:extPlugins>${userAssignXml(rules.map(r => r.rule))}</ext:extPlugins>`;
    const old = findExtPlugins(extNode[0]);
    const next = old ? extNode[0].replace(old[0], plugins) : extNode[0].replace('<ext:extPlugins/>', plugins);
    flow.bpmn = flow.bpmn.replace(extNode[0], next);
  } else {
    console.warn(`  ⚠ ${key} 无 extProcess userNode/signNode（非任务节点？），仅更新 nodeDispose`);
  }
  return `节点 ${key}「${nodeName}」审批人已更新：${descs.join(' + ')}${isSign ? '（会签节点，ext:signNode 已同步）' : ''}`;
}

// ---------- 删节点 ----------
export function removeNode(flow, nd, { key, reconnect }) {
  const node = nodeById(flow.def, key) || die(`节点 ${key} 不存在`);
  if (!reconnect) die('删除节点必须 --reconnect（自动接驳前后继）');
  const { ins, outs } = edgesAround(flow.def, key);
  // 前驱/后继 key
  const srcKeys = ins.map(e => {
    const srcNode = flow.def.childShapes.find(s => (s.outgoing || []).some(o => o.resourceId === e.resourceId));
    return srcNode ? idOf(srcNode) : null;
  }).filter(Boolean);
  const tgtKeys = outs.map(e => e.target ? idOf(flow.def.childShapes.find(s => s.resourceId === e.target.resourceId) || {}) : null).filter(Boolean);

  // 删边（defJson + bpmn）
  for (const e of [...ins, ...outs]) {
    flow.def.childShapes = flow.def.childShapes.filter(s => s.resourceId !== e.resourceId);
    const seq = findSeqFlow(flow.bpmn, e.resourceId);
    if (seq) flow.bpmn = flow.bpmn.replace(seq[0] + '\n    ', '').replace(seq[0], '');
    const edge = findEdgeXml(flow.bpmn, e.resourceId);
    if (edge) flow.bpmn = flow.bpmn.replace(edge[0] + '\n      ', '').replace(edge[0], '');
  }
  // 前驱 outgoing 清理
  for (const s of flow.def.childShapes) {
    if (s.outgoing) s.outgoing = s.outgoing.filter(o => !ins.some(e => e.resourceId === o.resourceId));
  }
  // 删节点（defJson + bpmn userTask/DI/extProcess/nodeDispose）
  flow.def.childShapes = flow.def.childShapes.filter(s => s.resourceId !== node.resourceId);
  const task = findNodeXml(flow.bpmn, key);
  if (task) flow.bpmn = flow.bpmn.replace(task[0] + '\n    ', '').replace(task[0], '');
  const shape = flow.bpmn.match(new RegExp(`\\s*<bpmndi:BPMNShape bpmnElement="${key}" id="BPMNShape_${key}">[\\s\\S]*?<\\/bpmndi:BPMNShape>`));
  if (shape) flow.bpmn = flow.bpmn.replace(shape[0], '');
  const un = findUserNode(flow.bpmn, key);
  if (un) flow.bpmn = flow.bpmn.replace(un[0] + '\n      ', '').replace(un[0], '');
  const sn = findSignNode(flow.bpmn, key);
  if (sn) flow.bpmn = flow.bpmn.replace(sn[0] + '\n      ', '').replace(sn[0], '');
  const grp = Array.isArray(nd) ? nd.find(g => g.code === flow.meta.defKey) : null;
  if (grp) grp.data = grp.data.filter(d => d.nodeKey !== key);

  // 补接驳线
  const made = [];
  for (const s of srcKeys) for (const t of tgtKeys) {
    if (!nodeById(flow.def, s) || !nodeById(flow.def, t)) continue;
    made.push(addEdge(flow, { from: s, to: t, name: '', cond: '' }));
  }
  return `节点 ${key} 已删除；接驳：${made.join('；') || '（无前后继）'}`;
}

// ---------- 变量管理 ----------
export function varAdd(flow, { key, name, type = 'string' }) {
  const vars = parseVars(flow.bpmn);
  if (vars.some(v => v.key === key)) die(`变量 ${key} 已存在`);
  flow.bpmn = flow.bpmn.replace('</ext:varDefs>', varDefXml(key, name || key, type) + '</ext:varDefs>');
  return `变量 ${key}（${name || key}, ${type}）已添加`;
}
export function varRemove(flow, { key }) {
  const vars = parseVars(flow.bpmn);
  const v = vars.find(x => x.key === key) || die(`变量 ${key} 不存在`);
  flow.bpmn = flow.bpmn.replace(v.raw, '');
  return `变量 ${key} 已删除`;
}

// ---------- 属性标签视图（nodeDispose 审批人表格） ----------
export function renderNodes(flow, nd) {
  const grp = Array.isArray(nd) ? nd.find(g => g.code === flow.meta.defKey) : null;
  const lines = ['序号  节点名称            节点ID                 审批人设置'];
  let i = 1;
  for (const r of (grp?.data || [])) {
    let c = r.cacl;
    const rules = [];
    if (typeof c === 'string' && c.includes(';')) {
      for (const part of c.split(/;\s*(?=\{)/)) { try { rules.push(JSON.parse(part)); } catch { } }
    } else { try { rules.push(JSON.parse(c)); } catch { } }
    const desc = summarizeRules(rules, 40) || r.description;
    lines.push(`${String(i++).padEnd(5)} ${(r.nodeName || '').padEnd(18)} ${(r.nodeKey || '').padEnd(22)} ${desc}`);
  }
  return lines.join('\n');
}

// addNode 里 extPlugins 的内联生成（含报错上下文）
function newAssignPlugins(nd, { assigneeArgs, nodeName }) {
  const rules = buildRulesFromArgs(assigneeArgs || {}, nodeName);
  return userAssignXml(rules.map(r => r.rule));
}
