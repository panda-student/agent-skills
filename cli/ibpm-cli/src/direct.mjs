// 非拓扑配置直写热改：读线上 → 内存修改 → 热写 → 回读复核。
// 不依赖 checkout/工作区/导出包；拓扑变更仍走 checkout → verify → import。
import { defGet } from './api.mjs';
import { buildSettingFromXml, saveDefConf } from './defconf.mjs';
import { buildRulesFromArgs, userAssignXml } from './userassign.mjs';
import { parseUserAssignMap } from './hot.mjs';
import { applyFlowPropValues } from './flowprops.mjs';
import { isSignKey, SIGN_KEYS } from './signconfig.mjs';
import { projectButtons } from './buttons.mjs';
import { getBranches, getDefSetting, getOtherParam, getSignConfig, getVarsList, writeJson } from './domain-api.mjs';
import { projectUserRules } from './assignee-summary.mjs';
import { sleep, stable } from './util.mjs';

const assertState = (resp, what) => {
  if (resp && resp.state === false) throw new Error(`${what}失败: ${resp.message || JSON.stringify(resp).slice(0, 200)}`);
};

// ---- 审批人 ----
export async function setAssigneeDirect(env, defId, rev, { key, assigneeArgs, logicCal }) {
  const ds = await getDefSetting(env, defId);
  const nodeName = (ds.nodeSetData?.nodes || []).find(n => n.nodeId === key)?.name || key;
  const rules = buildRulesFromArgs(assigneeArgs || {}, nodeName);
  if (logicCal) for (const r of rules) r.rule.logicCal = logicCal;

  // 复用平台同构的 userAssign XML → 再解析成 nodeUserMap（保证字段形态一致）
  const snippet = `<ext:userNode bpmnElement="${key}"><ext:extPlugins>${userAssignXml(rules.map(r => r.rule))}</ext:extPlugins></ext:userNode>`;
  const newRules = parseUserAssignMap(snippet)[key] || [];

  const live = await defGet(env, defId);
  const setting = buildSettingFromXml(live.bpmDefData.bpmnXml, {});
  const resp = await saveDefConf(env, defId, setting, {
    userJson: JSON.stringify({ [key]: newRules }),
    rev: rev ?? 0,
  });
  assertState(resp, 'saveDefConf ');
  await sleep(400);

  const after = await getDefSetting(env, defId);
  const serverRules = after.nodeSetData?.nodeUserMap?.[key] || [];
  if (stable(projectUserRules(serverRules)) !== stable(projectUserRules(newRules))) {
    throw new Error(`审批人回读不一致（${key}）`);
  }
  return { nodeName, desc: rules.map(r => r.displayDesc).join(' + ') };
}

// ---- 连线条件 ----
export async function setConditionDirect(env, defId, { from, to, expr, name }) {
  if (name !== undefined) {
    throw new Error('连线名称变更不支持无文件热改：请用 --workspace 走 checkout → verify → import（hot 不支持连线名称）');
  }
  const cur = await getBranches(env, defId, from);
  const outcome = cur.outcomeNodes || [];
  if (!outcome.some(n => n.nodeId === to)) throw new Error(`连线 ${from}→${to} 不存在`);
  const conditions = { ...(cur.conditions || {}) };
  if (expr !== undefined) conditions[to] = expr;

  const resp = await writeJson(env, '/flow/node/v1/branchConditionSave', {
    defId, nodeId: from, condition: JSON.stringify(conditions),
  });
  assertState(resp, `branchConditionSave(${from}) `);
  await sleep(300);
  const after = await getBranches(env, defId, from);
  if (stable(after.conditions) !== stable(conditions)) {
    throw new Error(`连线条件回读不一致（${from}→${to}）`);
  }
  return conditions;
}

// ---- 流程变量 ----
export async function varAddDirect(env, defId, { key, name, type = 'string' }) {
  const list = await getVarsList(env, defId);
  if (list.some(v => v.varKey === key)) throw new Error(`变量 ${key} 已存在`);
  const resp = await writeJson(env, '/flow/var/v1/save', {
    variableDef: {
      nodeId: '', name: name || key, varKey: key, dataType: type,
      required: 'false', isRequired: false, defaultVal: '', description: '',
    },
    isAdd: true, defId,
  });
  assertState(resp, `变量新增(${key}) `);
  await sleep(300);
  const after = await getVarsList(env, defId);
  const row = after.find(v => v.varKey === key);
  if (!row) throw new Error(`变量新增回读失败（${key}）`);
  return row;
}

export async function varRemoveDirect(env, defId, { key }) {
  const list = await getVarsList(env, defId);
  if (!list.some(v => v.varKey === key)) throw new Error(`变量 ${key} 不存在`);
  const resp = await writeJson(env, `/flow/var/v1/remove?defId=${defId}&varKey=${encodeURIComponent(key)}`, undefined, 'DELETE');
  assertState(resp, `变量删除(${key}) `);
  await sleep(300);
  const after = await getVarsList(env, defId);
  if (after.some(v => v.varKey === key)) throw new Error(`变量删除回读失败（${key}）`);
}

// ---- 节点按钮 ----
export async function setButtonDirect(env, defId, nodeKey, opts) {
  const ds = await getDefSetting(env, defId);
  if (!(ds.nodeSetData?.nodes || []).some(n => n.nodeId === nodeKey)) {
    throw new Error(`节点 ${nodeKey} 不存在`);
  }
  const list = (ds.nodeSetData?.nodeBtnMap?.[nodeKey] || []).map(b => ({ ...b }));
  const alias = opts.alias;
  if (!alias) throw new Error('需要 --alias');
  const idx = list.findIndex(b => b.alias === alias);

  if (opts.remove) {
    if (idx < 0) throw new Error(`节点 ${nodeKey} 没有按钮 ${alias}`);
    list.splice(idx, 1);
  } else {
    const next = idx >= 0 ? { ...list[idx] } : {
      alias, buttonType: 'system', customAlias: '', name: '', isLock: false, rejectMode: '',
      beforeScript: null, afterScript: null, groovyScript: null, completeEventGroovyScript: null,
      supportScript: false, msgConfig: null, i18nKey: null,
    };
    if (opts.name !== undefined) next.name = opts.name;
    if (opts.buttonType !== undefined) next.buttonType = opts.buttonType;
    if (opts.customAlias !== undefined) next.customAlias = opts.customAlias;
    if (opts.isLock !== undefined) next.isLock = opts.isLock === true || opts.isLock === 'true';
    if (opts.rejectMode !== undefined) next.rejectMode = opts.rejectMode;
    if (next.buttonType === 'system' && !next.customAlias) next.customAlias = next.alias;
    delete next.status;
    if (idx >= 0) list[idx] = next; else list.push(next);
  }

  const resp = await writeJson(env, '/flow/def/v1/saveNodeBtns', { nodeId: nodeKey, defId, btns: list });
  assertState(resp, `saveNodeBtns(${nodeKey}) `);
  await sleep(400);

  const after = await getDefSetting(env, defId);
  const serverBtns = after.nodeSetData?.nodeBtnMap?.[nodeKey] || [];
  if (stable(projectButtons(serverBtns)) !== stable(projectButtons(list))) {
    throw new Error(`节点按钮回读不一致（${nodeKey}）`);
  }
  return list.length;
}

// ---- 会签配置 ----
export async function setSignConfigDirect(env, defId, nodeKey, assignments) {
  for (const k of Object.keys(assignments)) {
    if (!isSignKey(k)) throw new Error(`不支持的会签字段: ${k}（可用: ${SIGN_KEYS.join(', ')}）`);
  }
  const cur = await getSignConfig(env, defId, nodeKey);
  const signRule = { ...(cur.signRule || {}) };
  for (const [k, v] of Object.entries(assignments)) {
    if (k === 'voteAmount') {
      signRule[k] = Number(v);
      if (!Number.isFinite(signRule[k])) throw new Error(`voteAmount 必须是数字: ${v}`);
    } else {
      signRule[k] = String(v);
    }
  }
  const resp = await writeJson(env, '/flow/node/v1/signConfigSave', {
    defId, nodeId: nodeKey,
    privilegeList: JSON.stringify(cur.privilegeList || {}),
    signRule: JSON.stringify(signRule),
  });
  assertState(resp, `signConfigSave(${nodeKey}) `);
  await sleep(400);
  const after = await getSignConfig(env, defId, nodeKey);
  if (stable(after.signRule) !== stable(signRule)) throw new Error(`会签配置回读不一致（${nodeKey}）`);
  return signRule;
}

// ---- 流程级「其它设置」 ----
export async function setFlowPropsDirect(env, defId, rev, assignments) {
  const cur = await getOtherParam(env, defId);
  const prop = applyFlowPropValues(cur.prop || {}, assignments);
  const resp = await writeJson(env, '/flow/def/v1/saveProp', {
    bpmProp: prop, description: prop.description ?? '', defId, rev: rev ?? 0,
  });
  assertState(resp, 'saveProp ');
  await sleep(400);

  const after = await getOtherParam(env, defId);
  const keys = new Set([...Object.keys(assignments), 'skipRules', 'skipSameUser']);
  for (const k of keys) {
    if (stable(after.prop?.[k]) !== stable(prop[k])) {
      throw new Error(`流程设置回读不一致（${k}: 线上 ${JSON.stringify(after.prop?.[k])}，期望 ${JSON.stringify(prop[k])}）`);
    }
  }
  return { keys: Object.keys(assignments) };
}