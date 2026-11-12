// 统一热发布：checkout/编辑后，把「非拓扑」差异通过 defId 级热接口推送，不新增版本。
// 安全边界：
//   1. 节点集合 / 连线集合（sourceRef→targetRef）变化 → 拒绝，必须走 import；
//   2. 已知热改段（propers / userAssign / varDefs / conditionExpression / 布局）之外的差异 → 拒绝，
//      避免未支持配置被静默丢弃；
//   3. 所有写操作前先算完差异，任何拒绝都发生在写入之前。
import { join } from 'node:path';
import { readFlow } from './flowxml.mjs';
import { discard, flowDirOf } from './workspace.mjs';
import { defGet } from './api.mjs';
import { getBranches, getDefSetting, getOtherParam, getSignConfig, getVarsList, writeJson } from './domain-api.mjs';
import { sleep, stable } from './util.mjs';
import { attrOf as xmlAttrOf, innerText, normXml, textOf } from './xml-util.mjs';
import { FLOW_PROP_META, parseFlowProps } from './flowprops.mjs';
import { mergeButtons, parseAllButtons, projectButtons } from './buttons.mjs';
import { parseAllSignSettings } from './signconfig.mjs';
import { projectUserRules } from './assignee-summary.mjs';
import {
  buildSettingFromXml, coerceNodeProps, parseNodePropers, saveDefConf,
} from './defconf.mjs';

// ---------- 通用 ----------

// hot 内属性缺失按空串处理（xml-util.attrOf 默认 undefined）
const attrOf = (attrs, name) => xmlAttrOf(attrs, name, '');

// ---------- API ----------


const assertState = (resp, what) => {
  if (resp && resp.state === false) throw new Error(`${what}失败: ${resp.message || JSON.stringify(resp).slice(0, 200)}`);
};

// ---------- bpmnXml 解析 ----------

/** 节点块：ext:userNode / ext:signNode → { id, attrs, body, full } */
export function nodeBlocks(bpmn) {
  const map = {};
  for (const m of bpmn.matchAll(/<ext:(userNode|signNode)\b([^>]*)>([\s\S]*?)<\/ext:\1>/g)) {
    const id = attrOf(m[2], 'bpmnElement');
    if (id) map[id] = { id, attrs: m[2], body: m[3], full: m[0] };
  }
  return map;
}

const propersXmlOf = block => {
  const m = block && block.match(/<ext:propers>[\s\S]*?<\/ext:propers>/);
  return m ? normXml(m[0]) : '';
};
const userAssignXmlOf = block => {
  const m = block && block.match(/<userAssign\b[^>]*>[\s\S]*?<\/userAssign>/);
  return m ? normXml(m[0]) : '';
};
const buttonsXmlOf = block => {
  const m = block && block.match(/<ext:buttons>[\s\S]*?<\/ext:buttons>/);
  return m ? normXml(m[0]) : '';
};
const signSettingXmlOf = block => {
  const m = block && block.match(/<ext:signSetting>[\s\S]*?<\/ext:signSetting>/);
  return m ? normXml(m[0]) : '';
};

/** 拓扑指纹：所有 BPMNShape 节点 + 所有 sequenceFlow 的 source→target */
export function topology(xml) {
  const nodes = new Set();
  for (const m of xml.matchAll(/<bpmndi:BPMNShape\b[^>]*bpmnElement="([^"]+)"/g)) nodes.add(m[1]);
  const edges = new Set();
  for (const m of xml.matchAll(/<sequenceFlow\b([^>]*)>/g)) {
    const s = attrOf(m[1], 'sourceRef');
    const t = attrOf(m[1], 'targetRef');
    if (s && t) edges.add(`${s}->${t}`);
  }
  return { nodes, edges };
}

export function diffTopology(liveXml, wsXml) {
  const a = topology(liveXml), b = topology(wsXml);
  return {
    addedNodes: [...b.nodes].filter(n => !a.nodes.has(n)),
    removedNodes: [...a.nodes].filter(n => !b.nodes.has(n)),
    addedEdges: [...b.edges].filter(e => !a.edges.has(e)),
    removedEdges: [...a.edges].filter(e => !b.edges.has(e)),
    get changed() {
      return this.addedNodes.length || this.removedNodes.length || this.addedEdges.length || this.removedEdges.length;
    },
  };
}

/** 连线条件：按源节点聚合 { targetNodeId: expr } */
export function conditionsBySource(xml) {
  const out = {};
  for (const m of xml.matchAll(/<sequenceFlow\b([^>]*?)(?:\/>|>([\s\S]*?)<\/sequenceFlow>)/g)) {
    const s = attrOf(m[1], 'sourceRef');
    const t = attrOf(m[1], 'targetRef');
    if (!s || !t) continue;
    const body = m[2] || '';
    const cm = body.match(/<conditionExpression\b[^>]*>([\s\S]*?)<\/conditionExpression>/);
    // 与平台 branchConditionEdit 对齐：无 conditionExpression 的分支（默认/无条件）不出现在 conditions 里
    if (!cm) continue;
    (out[s] = out[s] || {})[t] = textOf(cm[1]).trim();
  }
  return out;
}

/** 审批人 XML → nodeUserMap JSON（与设计器「属性标签」保存结构一致） */
export function parseUserAssignMap(bpmn, onlyIds = null) {
  const map = {};
  for (const block of Object.values(nodeBlocks(bpmn))) {
    if (onlyIds && !onlyIds.has(block.id)) continue;
    const ua = block.full.match(/<userAssign\b[^>]*>([\s\S]*?)<\/userAssign>/);
    if (!ua) continue;
    const rules = [];
    for (const r of ua[1].matchAll(/<userRule\b([^>]*)>([\s\S]*?)<\/userRule>/g)) {
      rules.push(parseUserRule(r[1], r[2]));
    }
    map[block.id] = rules;
  }
  return map;
}

function parseUserRule(attrs, body) {
  const rule = {
    name: '',
    description: innerText(body, 'description'),
    condition: innerText(body, 'condition') || '{"junction":"and","condition":[]}',
    conditionMode: innerText(body, 'conditionMode'),
    parentFlowKey: innerText(body, 'parentFlowkey') || 'local_',
    groupNo: Number(attrOf(attrs, 'groupNo') || 1),
    type: 'user',
    keyId: innerText(body, 'keyId'),
    calcs: [],
  };
  const calcs = body.match(/<calcs>([\s\S]*?)<\/calcs>/);
  if (calcs) {
    let rest = calcs[1];
    for (const c of calcs[1].matchAll(/<(cusers|hrScript|orgReport)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/g)) {
      rule.calcs.push(parseCalc(c[1], c[2], c[3] || ''));
      rest = rest.replace(c[0], '');
    }
    if (/<[A-Za-z]/.test(rest)) {
      throw new Error(`审批人插件暂不支持热改，请改用 import：${rest.trim().slice(0, 160)}`);
    }
  }
  return rule;
}

function parseCalc(tag, attrs, body) {
  const base = {
    pluginName: null,
    extract: attrOf(attrs, 'extract') || 'extract',
    logicCal: attrOf(attrs, 'logicCal') || 'or',
    pluginType: tag,
  };
  if (tag === 'cusers') {
    const source = attrOf(attrs, 'source') || 'start';
    if (source === 'spec') {
      const members = [...body.matchAll(/<members\b([^>]*?)\/?>/g)];
      if (members.length > 1) {
        throw new Error('多成员「指定用户」审批人暂不支持热改，请改用 import');
      }
      const a = members.length ? members[0][1] : '';
      return {
        ...base, source: 'spec',
        account: attrOf(a, 'account'), userId: attrOf(a, 'userId'), userName: attrOf(a, 'userName'),
        dem: null, var: null, description: attrOf(a, 'userName'),
      };
    }
    if (source === 'var') {
      const m = body.match(/<var\b([^>]*?)\/?>/);
      const a = m ? m[1] : '';
      const executorType = attrOf(a, 'executorType') || 'user';
      const name = attrOf(a, 'name');
      return {
        ...base, source: 'var', account: '', userName: '', userId: '', dem: null,
        var: {
          source: attrOf(a, 'source') || 'flowVar', name, executorType,
          userValType: attrOf(a, 'userValType') || 'account', groupValType: '', dimension: '', value: null,
        },
        description: `flowVar[${executorType}:${name}]`,
      };
    }
    return { ...base, source: 'start', account: '', userName: '', userId: '', dem: null, var: null, description: '发起人' };
  }
  if (tag === 'hrScript') {
    return {
      ...base,
      script: innerText(body, 'content'),
      description: innerText(body, 'description'),
      scriptId: innerText(body, 'scriptId'),
      params: innerText(body, 'params'),
    };
  }
  return {
    ...base,
    orgCode: attrOf(attrs, 'orgCode'),
    orgName: attrOf(attrs, 'orgName'),
    reportLevel: attrOf(attrs, 'reportLevel') || 'L1',
    description: innerText(body, 'description') || '组织汇报关系查询插件',
  };
}

/** 去掉已支持热改的段，剩余差异即「未支持的非拓扑配置变更」 */
function stripKnown(xml) {
  // saveDefConf 回写 userAssign 时服务端会补 xmlns:user 声明；命名空间声明不参与配置差异比较
  const normalized = xml.replace(/<(?:ext:)?definitions\b[^>]*>/,
    tag => tag.replace(/\s+xmlns(?::[A-Za-z0-9_]+)?="[^"]*"/g, ''));
  return normalized
    .replace(/<ext:propers>[\s\S]*?<\/ext:propers>/g, '')
    .replace(/<userAssign\b[^>]*>[\s\S]*?<\/userAssign>/g, '')
    .replace(/<ext:buttons>[\s\S]*?<\/ext:buttons>/g, '')
    .replace(/<ext:signSetting>[\s\S]*?<\/ext:signSetting>/g, '')
    .replace(/<ext:varDefs>[\s\S]*?<\/ext:varDefs>/g, '')
    .replace(/<ext:extProperties\b[^>]*>[\s\S]*?<\/ext:extProperties>/g, '')
    .replace(/<ext:inst(?:Mobile)?Form\s*\/>/g, '')
    .replace(/<conditionExpression\b[^>]*>[\s\S]*?<\/conditionExpression>/g, '')
    .replace(/<bpmndi:BPMNDiagram>[\s\S]*?<\/bpmndi:BPMNDiagram>/g, '')
    .replace(/>\s+</g, '><')
    .trim();
}

function residualDiff(liveXml, wsXml) {
  const a = stripKnown(liveXml), b = stripKnown(wsXml);
  if (a === b) return null;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return {
    at: i,
    live: a.slice(Math.max(0, i - 120), i + 240),
    ws: b.slice(Math.max(0, i - 120), i + 240),
  };
}

// ---------- 差异计算 ----------

export function computeDiffs(liveXml, wsXml) {
  const liveBlocks = nodeBlocks(liveXml), wsBlocks = nodeBlocks(wsXml);
  const ids = new Set([...Object.keys(liveBlocks), ...Object.keys(wsBlocks)]);
  const propChanges = [], assigneeChanges = [], buttonChanges = [], signChanges = [];
  for (const id of ids) {
    if (!wsBlocks[id]) continue; // 删节点已由拓扑守卫拦截
    if (propersXmlOf(liveBlocks[id].full) !== propersXmlOf(wsBlocks[id].full)) propChanges.push(id);
    if (userAssignXmlOf(liveBlocks[id].full) !== userAssignXmlOf(wsBlocks[id].full)) assigneeChanges.push(id);
    if (buttonsXmlOf(liveBlocks[id].full) !== buttonsXmlOf(wsBlocks[id].full)) buttonChanges.push(id);
    if (signSettingXmlOf(liveBlocks[id].full) !== signSettingXmlOf(wsBlocks[id].full)) signChanges.push(id);
  }

  const liveConds = conditionsBySource(liveXml), wsConds = conditionsBySource(wsXml);
  const condChanges = [];
  for (const src of new Set([...Object.keys(liveConds), ...Object.keys(wsConds)])) {
    if (stable(liveConds[src] || {}) !== stable(wsConds[src] || {})) {
      condChanges.push({ nodeId: src, conditions: wsConds[src] || {} });
    }
  }

  const wsVars = parseVarsOf(wsXml);
  return { propChanges, assigneeChanges, buttonChanges, signChanges, condChanges, wsVars };
}

function parseVarsOf(bpmn) {
  const m = bpmn.match(/<ext:varDefs>([\s\S]*?)<\/ext:varDefs>/);
  if (!m) return [];
  return [...m[1].matchAll(/<ext:variableDef>([\s\S]*?)<\/ext:variableDef>/g)].map(v => ({
    key: innerText(v[1], 'ext:key'),
    name: innerText(v[1], 'ext:name'),
    type: innerText(v[1], 'ext:type') || 'string',
  })).filter(v => v.key);
}

function diffVars(wsVars, liveVars) {
  const liveMap = new Map(liveVars.map(v => [v.varKey, v]));
  const wsMap = new Map(wsVars.map(v => [v.key, v]));
  const added = [], removed = [], changed = [];
  for (const [key, v] of wsMap) {
    const l = liveMap.get(key);
    if (!l) added.push(v);
    else if (l.name !== v.name || l.dataType !== v.type) changed.push({ ws: v, live: l });
  }
  for (const key of liveMap.keys()) if (!wsMap.has(key)) removed.push(liveMap.get(key));
  return { added, removed, changed };
}

// ---------- 主流程 ----------

export async function hotApply(env, def, ws, { keepWorkspace = false } = {}) {
  const flowPath = join(flowDirOf(ws), 'bpmdefs.flow.xml');
  const flow = readFlow(flowPath);
  const wsXml = flow.bpmn;

  const live = await defGet(env, def.defId);
  const liveXml = live.bpmDefData.bpmnXml;
  const beforeVersion = live.version ?? def.version;

  // 流程级「其它设置」：以线上 prop 为底，仅覆盖工作区 XML 中真实存在的字段
  const liveOther = await getOtherParam(env, def.defId);
  const liveFlowProp = liveOther.prop || {};
  // extProperties 以「工作区 XML vs 线上 XML」比对：生成器写入的空占位不应被误判为变更
  const wsXmlProps = parseFlowProps(wsXml, flow.xml);
  const liveXmlProps = parseFlowProps(liveXml, '');
  const changedFlowKeys = [];
  for (const [k, meta] of Object.entries(FLOW_PROP_META)) {
    if (meta.kind === 'defAttr') {
      // bpmDefinition 属性不在 bpmnXml 里，拿线上 prop 做基线
      if (wsXmlProps[k] !== undefined && stable(wsXmlProps[k]) !== stable(liveFlowProp[k])) changedFlowKeys.push(k);
    } else {
      const wsVal = wsXmlProps[k] ?? '';
      const liveVal = liveXmlProps[k] ?? '';
      if (stable(wsVal) !== stable(liveVal)) changedFlowKeys.push(k);
    }
  }
  const wsFlowProp = { ...liveFlowProp };
  for (const k of changedFlowKeys) wsFlowProp[k] = wsXmlProps[k] ?? '';
  const flowPropChanged = changedFlowKeys.length > 0;

  console.log(`流程: ${live.name || def.name} defKey=${live.defKey || def.defKey} 当前版本=${beforeVersion}`);
  console.log(`工作区: ${flowPath}`);

  // 1) 拓扑守卫
  const topo = diffTopology(liveXml, wsXml);
  if (topo.changed) {
    console.error('\n✗ 检测到拓扑变化，禁止热发布（必须走 import 升版本）：');
    for (const n of topo.addedNodes) console.error(`  + 节点 ${n}`);
    for (const n of topo.removedNodes) console.error(`  - 节点 ${n}`);
    for (const e of topo.addedEdges) console.error(`  + 连线 ${e}`);
    for (const e of topo.removedEdges) console.error(`  - 连线 ${e}`);
    throw new Error('拓扑已变化：请执行 ibpm verify + ibpm import（或 ibpm discard 放弃）');
  }

  // 2) 未支持差异守卫（写入前）
  const residual = residualDiff(liveXml, wsXml);
  if (residual) {
    console.error('\n✗ 检测到已支持范围之外的配置差异，禁止热发布（避免静默丢弃）：');
    console.error(`  线上: ...${residual.live}...`);
    console.error(`  工作区: ...${residual.ws}...`);
    throw new Error('该差异暂不支持热改：请改用 ibpm import 升版本，或先还原该部分再 hot');
  }

  // 3) 差异计算
  const diffs = computeDiffs(liveXml, wsXml);
  const liveVars = await getVarsList(env, def.defId);
  const varDiff = diffVars(diffs.wsVars, liveVars);

  const total = diffs.propChanges.length + diffs.assigneeChanges.length
    + diffs.buttonChanges.length + diffs.signChanges.length
    + diffs.condChanges.length + varDiff.added.length + varDiff.removed.length + varDiff.changed.length
    + (flowPropChanged ? 1 : 0);
  if (!total) {
    console.log('\n✓ 无差异：工作区与线上一致，无需热发布');
    return;
  }

  // 4) 预演
  console.log('\n将热发布（不升版本）：');
  if (flowPropChanged) {
    console.log(`  流程设置: ${changedFlowKeys.map(k => `${k} ${JSON.stringify(liveFlowProp[k])}→${JSON.stringify(wsFlowProp[k])}`).join(', ')}`);
  }
  if (diffs.propChanges.length) console.log(`  节点属性: ${diffs.propChanges.join(', ')}`);
  if (diffs.buttonChanges.length) console.log(`  节点按钮: ${diffs.buttonChanges.join(', ')}`);
  if (diffs.signChanges.length) console.log(`  会签配置: ${diffs.signChanges.join(', ')}`);
  if (diffs.assigneeChanges.length) console.log(`  审批人:   ${diffs.assigneeChanges.join(', ')}`);
  for (const c of diffs.condChanges) console.log(`  连线条件: ${c.nodeId} → ${JSON.stringify(c.conditions)}`);
  for (const v of varDiff.added) console.log(`  变量新增: ${v.key} (${v.name})`);
  for (const v of varDiff.changed) console.log(`  变量修改: ${v.ws.key} (${v.live.name}→${v.ws.name}, ${v.live.dataType}→${v.ws.type})`);
  for (const v of varDiff.removed) console.log(`  变量删除: ${v.varKey} (${v.name})`);

  // 5) 流程级「其它设置」（saveProp 可能重写 bpmnXml，放在条件/变量/节点配置之前）
  if (flowPropChanged) {
    const resp = await writeJson(env, '/flow/def/v1/saveProp', {
      bpmProp: wsFlowProp,
      description: wsFlowProp.description ?? '',
      defId: def.defId,
      rev: live.rev ?? 0,
    });
    assertState(resp, 'saveProp ');
    console.log(`  ✓ 流程设置已写入: ${changedFlowKeys.join(', ')}`);
    await sleep(600);
  }

  // 6) 节点按钮（与 live nodeBtnMap 合并，保留脚本等 XML 未表示字段）
  if (diffs.buttonChanges.length) {
    const liveSetting = await getDefSetting(env, def.defId);
    const liveBtnMap = liveSetting.nodeSetData?.nodeBtnMap || {};
    const wsBtnMap = parseAllButtons(wsXml);
    for (const nodeId of diffs.buttonChanges) {
      const btns = mergeButtons(liveBtnMap[nodeId] || [], wsBtnMap[nodeId] || []);
      const resp = await writeJson(env, '/flow/def/v1/saveNodeBtns', { nodeId, defId: def.defId, btns });
      assertState(resp, `saveNodeBtns(${nodeId}) `);
      console.log(`  ✓ 节点按钮已写入: ${nodeId}（${btns.length} 个）`);
    }
    await sleep(400);
  }

  // 7) 会签配置（privilegeList 不在 bpmnXml 中，取线上值原样保留）
  if (diffs.signChanges.length) {
    const wsSign = parseAllSignSettings(wsXml);
    for (const nodeId of diffs.signChanges) {
      const signRule = wsSign[nodeId];
      if (!signRule) throw new Error(`会签节点 ${nodeId} 工作区缺少 ext:signRule`);
      const liveSign = await getSignConfig(env, def.defId, nodeId);
      const resp = await writeJson(env, '/flow/node/v1/signConfigSave', {
        defId: def.defId,
        nodeId,
        privilegeList: JSON.stringify(liveSign.privilegeList || {}),
        signRule: JSON.stringify(signRule),
      });
      assertState(resp, `signConfigSave(${nodeId}) `);
      console.log(`  ✓ 会签配置已写入: ${nodeId}`);
    }
    await sleep(400);
  }

  // 8) 连线条件（先写：saveDefConf 会重写 bpmnXml，放最后避免其异步回写覆盖条件）
  for (const c of diffs.condChanges) {
    const resp = await writeJson(env, '/flow/node/v1/branchConditionSave', {
      defId: def.defId, nodeId: c.nodeId, condition: JSON.stringify(c.conditions),
    });
    assertState(resp, `branchConditionSave(${c.nodeId}) `);
    console.log(`  ✓ 连线条件已写入: ${c.nodeId}`);
  }

  // 6) 变量
  for (const v of varDiff.added) {
    const resp = await writeJson(env, '/flow/var/v1/save', {
      variableDef: {
        nodeId: '', name: v.name, varKey: v.key, dataType: v.type,
        required: 'false', isRequired: false, defaultVal: '', description: '',
      },
      isAdd: true, defId: def.defId,
    });
    assertState(resp, `变量新增(${v.key}) `);
    console.log(`  ✓ 变量已新增: ${v.key}`);
  }
  for (const v of varDiff.changed) {
    const liveVar = v.live;
    const resp = await writeJson(env, '/flow/var/v1/save', {
      variableDef: {
        nodeId: liveVar.nodeId || '', name: v.ws.name, varKey: v.ws.key, dataType: v.ws.type,
        required: liveVar.required ? 'true' : 'false', isRequired: !!liveVar.isRequired,
        defaultVal: liveVar.defaultVal || '', description: liveVar.description || '',
      },
      isAdd: false, defId: def.defId,
    });
    assertState(resp, `变量修改(${v.ws.key}) `);
    console.log(`  ✓ 变量已修改: ${v.ws.key}`);
  }
  for (const v of varDiff.removed) {
    const resp = await writeJson(env, `/flow/var/v1/remove?defId=${def.defId}&varKey=${encodeURIComponent(v.varKey)}`, undefined, 'DELETE');
    assertState(resp, `变量删除(${v.varKey}) `);
    console.log(`  ✓ 变量已删除: ${v.varKey}`);
  }

  // 7) 节点属性 + 审批人共用 saveDefConf（最后写；写完等服务端回写 bpmnXml 落定）
  if (diffs.propChanges.length || diffs.assigneeChanges.length) {
    const wsProps = parseNodePropers(wsXml);
    const nodePropertieMap = {};
    for (const id of diffs.propChanges) {
      if (!wsProps[id]) throw new Error(`节点 ${id} 在工作区中删除了 propers，saveDefConf 无法删除该配置`);
      nodePropertieMap[id] = coerceNodeProps(wsProps[id], id);
      nodePropertieMap[id].nodeId = id;
    }
    const wsAssignees = parseUserAssignMap(wsXml, new Set(diffs.assigneeChanges));
    const userMap = {};
    for (const id of diffs.assigneeChanges) userMap[id] = wsAssignees[id] || [];
    const setting = buildSettingFromXml(liveXml, nodePropertieMap);
    const resp = await saveDefConf(env, def.defId, setting, {
      userJson: JSON.stringify(userMap),
      rev: live.rev ?? 0,
    });
    assertState(resp, 'saveDefConf ');
    console.log(`  ✓ 节点属性/审批人已写入（${diffs.propChanges.length} 个属性节点，${diffs.assigneeChanges.length} 个审批人节点）`);
    // saveDefConf 的 bpmnXml 回写由服务端异步完成，留出落定时间再复核
    await sleep(600);
  }

  // 8) 回读复核
  const after = await defGet(env, def.defId);
  const afterVersion = after.version ?? beforeVersion;
  console.log(`\n版本: ${beforeVersion} → ${afterVersion}${String(beforeVersion) === String(afterVersion) ? '（未变更）' : '  ⚠️ 发生了变化'}`);

  let ok = String(beforeVersion) === String(afterVersion);
  if (!ok) console.error('❌ 热发布后版本发生变化，请立即检查');

  if (flowPropChanged) {
    const afterOther = await getOtherParam(env, def.defId);
    const afterProp = afterOther.prop || {};
    for (const k of changedFlowKeys) {
      if (stable(afterProp[k]) !== stable(wsFlowProp[k])) {
        ok = false;
        console.error(`❌ 流程设置复核失败: ${k}（线上 ${JSON.stringify(afterProp[k])}，期望 ${JSON.stringify(wsFlowProp[k])}）`);
      }
    }
  }

  const afterProps = parseNodePropers(after.bpmDefData.bpmnXml);
  for (const id of diffs.propChanges) {
    const same = stable(afterProps[id] || {}) === stable(parseNodePropers(wsXml)[id] || {});
    if (!same) { ok = false; console.error(`❌ 属性复核失败: ${id}`); }
  }

  if (diffs.assigneeChanges.length) {
    const setting = await getDefSetting(env, def.defId);
    const serverMap = setting.nodeSetData?.nodeUserMap || {};
    const wsMap = parseUserAssignMap(wsXml, new Set(diffs.assigneeChanges));
    for (const id of diffs.assigneeChanges) {
      const same = stable(projectUserRules(serverMap[id] || [])) === stable(projectUserRules(wsMap[id] || []));
      if (!same) { ok = false; console.error(`❌ 审批人复核失败: ${id}`); }
    }
  }

  if (diffs.buttonChanges.length) {
    const setting = await getDefSetting(env, def.defId);
    const serverBtnMap = setting.nodeSetData?.nodeBtnMap || {};
    const wsBtnMap = parseAllButtons(wsXml);
    for (const id of diffs.buttonChanges) {
      const same = stable(projectButtons(serverBtnMap[id] || [])) === stable(projectButtons(wsBtnMap[id] || []));
      if (!same) { ok = false; console.error(`❌ 节点按钮复核失败: ${id}`); }
    }
  }

  if (diffs.signChanges.length) {
    const wsSign = parseAllSignSettings(wsXml);
    for (const id of diffs.signChanges) {
      const server = await getSignConfig(env, def.defId, id);
      if (stable(server.signRule) !== stable(wsSign[id])) {
        ok = false;
        console.error(`❌ 会签配置复核失败: ${id}（线上 ${stable(server.signRule)}，期望 ${stable(wsSign[id])}）`);
      }
    }
  }

  for (const c of diffs.condChanges) {
    let server = await getBranches(env, def.defId, c.nodeId);
    let serverConds = server.conditions || server.data?.conditions || {};
    if (stable(serverConds) !== stable(c.conditions)) {
      // saveDefConf 的 bpmnXml 异步回写可能覆盖了条件，落定后重试一次
      await sleep(400);
      const resp = await writeJson(env, '/flow/node/v1/branchConditionSave', {
        defId: def.defId, nodeId: c.nodeId, condition: JSON.stringify(c.conditions),
      });
      assertState(resp, `branchConditionSave(${c.nodeId}) 重试 `);
      await sleep(300);
      server = await getBranches(env, def.defId, c.nodeId);
      serverConds = server.conditions || server.data?.conditions || {};
    }
    if (stable(serverConds) !== stable(c.conditions)) {
      ok = false;
      console.error(`❌ 连线条件复核失败: ${c.nodeId}（线上 ${stable(serverConds)}，期望 ${stable(c.conditions)}）`);
    }
  }

  if (varDiff.added.length || varDiff.removed.length || varDiff.changed.length) {
    const afterVars = await getVarsList(env, def.defId);
    const afterKeys = new Set(afterVars.map(v => v.varKey));
    for (const v of varDiff.added) if (!afterKeys.has(v.key)) { ok = false; console.error(`❌ 变量新增复核失败: ${v.key}`); }
    for (const v of varDiff.removed) if (afterKeys.has(v.varKey)) { ok = false; console.error(`❌ 变量删除复核失败: ${v.varKey}`); }
    for (const v of varDiff.changed) if (!afterKeys.has(v.ws.key)) { ok = false; console.error(`❌ 变量修改复核失败: ${v.ws.key}`); }
  }

  if (ok) {
    // 热发布后线上已是新基线；不再重新导出 zip 刷新工作区。
    if (keepWorkspace) {
      console.log('  ⚠ 工作区保留；服务端可能已规范化线上 XML，继续编辑前建议重新 checkout');
    } else {
      try {
        discard(def.defKey, env.name);
        console.log('  ✓ 工作区已丢弃（热发布完成；如需继续编辑请重新 checkout）');
      } catch (e) {
        console.log(`  ⚠ 工作区丢弃失败，请手动 ibpm discard ${def.defKey}: ${e.message}`);
      }
    }
  }
  console.log(ok
    ? '✅ 热发布完成：所有差异已生效，版本未变更（新发起实例立即使用新配置）'
    : '❌ 热发布存在复核失败项，请人工检查');
  if (!ok) process.exitCode = 1;
}


