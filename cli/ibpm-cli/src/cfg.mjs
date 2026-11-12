// 独立插件配置：不在导出 XML 中，采用「读线上 JSON → 编辑 → 热写」模式。
// 所有接口均按 defId/节点级直写，不新增版本；写入后回读复核。
import { defGet } from './api.mjs';
import { buildSettingFromXml } from './defconf.mjs';
import { getDefSetting } from './domain-api.mjs';
import { subsetMatches, sleep } from './util.mjs';

const headers = env => ({
  Authorization: `Bearer ${env.token}`,
  'Content-Type': 'application/json;charset=UTF-8',
  'ibpm-client': 'pc',
  cookie: 'lang=zh',
  accept: '*/*',
});

async function req(env, path, { method = 'GET', body, portal = false } = {}) {
  const url = (portal ? env.baseUrl + '/portal' : env.baseUrl + env.bpmModel) + path;
  const res = await fetch(url, {
    method,
    headers: headers(env),
    body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)),
  });
  if (res.status === 401) { console.error('✗ 401：token 失效，请 ibpm login'); process.exit(2); }
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) throw new Error(`HTTP ${res.status} ${path}: ${String(text).slice(0, 300)}`);
  return data;
}

export const CFG_TYPES = {
  reminders: {
    scope: 'node',
    label: '人工催办',
    read: async (env, defId, nodeId) => {
      const r = await req(env, `/flow/plugins/v1/remindersJson?defId=${defId}&nodeId=${nodeId}`);
      return r.reminders ?? r;
    },
    write: async (env, defId, nodeId, data) =>
      req(env, `/flow/plugins/v1/remindersSave?defId=${defId}&nodeId=${nodeId}`, { method: 'POST', body: JSON.stringify(data) }),
  },

  jumpRules: {
    scope: 'node',
    label: '跳转规则',
    read: async (env, defId, nodeId) => {
      const r = await req(env, `/flow/node/v1/ruleEdit?definitionId=${defId}&nodeId=${nodeId}`);
      return r.nodeDef?.jumpRuleList ?? [];
    },
    write: async (env, defId, nodeId, data) =>
      req(env, `/flow/node/v1/ruleSave?defId=${defId}&nodeId=${nodeId}`, { method: 'POST', body: data }),
  },

  eventScript: {
    scope: 'node',
    label: '事件脚本',
    read: async (env, defId, nodeId) => {
      const r = await req(env, `/flow/node/v1/eventScriptEdit?defId=${defId}&nodeId=${nodeId}`);
      return r.eventScriptMap ?? {};
    },
    write: async (env, defId, nodeId, data) => {
      let map = data || {};
      // 服务端忽略空数组；传 {} 时对现有事件逐一写空内容，才能真正清空
      if (Object.keys(map).length === 0) {
        const current = await CFG_TYPES.eventScript.read(env, defId, nodeId);
        map = Object.fromEntries(Object.keys(current || {}).map(k => [k, '']));
      }
      const arr = Object.entries(map).map(([scriptType, content]) => ({ scriptType, content }));
      return req(env, '/flow/node/v1/eventScriptSave', {
        method: 'POST',
        body: { defId, nodeId, eventScriptArray: JSON.stringify(arr) },
      });
    },
  },

  startNewFlow: {
    scope: 'node',
    label: '自动发起流程',
    read: async (env, defId, nodeId) => {
      const r = await req(env, `/flow/plugins/v1/startNewFlowJson?defId=${defId}&nodeId=${nodeId}`);
      return (r && Object.keys(r).length) ? r : { condition: '', startConfig: [] };
    },
    write: async (env, defId, nodeId, data) =>
      req(env, `/flow/plugins/v1/startNewFlowSave?defId=${defId}&nodeId=${nodeId}`, { method: 'POST', body: JSON.stringify(data) }),
  },

  autoTask: {
    scope: 'node',
    label: '自动任务',
    read: async (env, defId, nodeId) => {
      const mgr = await req(env, `/flow/node/v1/autoTaskManager?defId=${defId}&nodeId=${nodeId}`);
      const ctx = mgr?.bpmPluginContext;
      if (!ctx) return null;
      const type = ctx.type;
      const p = await req(env, `/flow/node/v1/autoTaskPluginGet?defId=${defId}&nodeId=${nodeId}&pluginType=${type}`);
      if (!p?.bpmPluginDefJson) return ctx.bpmPluginDef || null;
      // 平台存的是 Base64(pluginDef JSON)，与设计器 Base64.decode 对齐
      return JSON.parse(Buffer.from(p.bpmPluginDefJson, 'base64').toString('utf8'));
    },
    write: async (env, defId, nodeId, data) =>
      req(env, '/flow/node/v1/autoTaskPluginSave', {
        method: 'POST',
        body: { defId, nodeId, jsonStr: JSON.stringify(data) },
      }),
  },

  msgReceiver: {
    scope: 'node',
    label: '消息接收人',
    read: async (env, defId, nodeId) => {
      const s = await getDefSetting(env, defId);
      return s.nodeSetData?.nodeUserMsgMap?.[nodeId] ?? [];
    },
    write: async (env, defId, nodeId, data) => {
      const live = await defGet(env, defId);
      const s = await getDefSetting(env, defId);
      const setting = buildSettingFromXml(live.bpmDefData.bpmnXml, {});
      const payload = {
        defSettingJson: JSON.stringify(setting),
        userJson: '{}',
        userReadJson: '{}',
        restfulJson: '{}',
        defId,
        rev: s.initData?.bpmDefinition?.rev ?? live.rev ?? 0,
        topDefKey: '',
        nodeFormKeys: '',
        userMsgJson: JSON.stringify({ [nodeId]: data }),
      };
      return req(env, '/flow/node/v1/saveMsgReceiver', { method: 'POST', body: payload });
    },
  },

  msgTemplate: {
    scope: 'flow',
    label: '流程消息模板（租户级）',
    read: async (env) => {
      const r = await req(env, '/flow/MsgTemplate/v1/listJson', {
        method: 'POST', portal: true,
        body: { pageBean: { page: 1, pageSize: 2000, total: 0 }, sorter: [] },
      });
      return r.rows ?? r.data?.rows ?? r;
    },
    write: async (env, defId, nodeId, data) =>
      req(env, '/flow/MsgTemplate/v1/save', { method: 'POST', portal: true, body: data }),
    verify: (data, after) => {
      if (!Array.isArray(after)) return false;
      const row = after.find(x => (data.id && x.id === data.id) || (!data.id && data.key && x.key === data.key));
      const keep = ['id', 'name', 'key', 'typeKey', 'isDefault', 'subject', 'plain', 'html',
        'smsTemplateNo', 'voiceTemplateNo', 'mobileHtml', 'pcUrl', 'mobileUrl'];
      const project = o => Object.fromEntries(keep.filter(k => k in o).map(k => [k, o[k]]));
      return !!row && subsetMatches(project(data), project(row));
    },
  },

  // ---- 只读查询类型（统一验证入口） ----
  nodeProps: {
    scope: 'node', label: '节点属性（propers）', readOnly: true,
    read: async (env, defId, nodeId) =>
      (await getDefSetting(env, defId)).nodeSetData?.bpmDefSetting?.nodePropertieMap?.[nodeId] ?? null,
  },
  buttons: {
    scope: 'node', label: '节点按钮', readOnly: true,
    read: async (env, defId, nodeId) =>
      (await getDefSetting(env, defId)).nodeSetData?.nodeBtnMap?.[nodeId] ?? [],
  },
  assignees: {
    scope: 'node', label: '节点审批人规则', readOnly: true,
    read: async (env, defId, nodeId) =>
      (await getDefSetting(env, defId)).nodeSetData?.nodeUserMap?.[nodeId] ?? [],
  },
  signConfig: {
    scope: 'node', label: '会签配置', readOnly: true,
    read: (env, defId, nodeId) => req(env, `/flow/node/v1/getSignConfig?defId=${defId}&nodeId=${nodeId}`),
  },
  conditions: {
    scope: 'node', label: '连线条件', readOnly: true,
    read: (env, defId, nodeId) => req(env, `/flow/node/v1/branchConditionEdit?defId=${defId}&nodeId=${nodeId}`),
  },
  flowProps: {
    scope: 'flow', label: '流程级「其它设置」', readOnly: true,
    read: async (env, defId) =>
      (await req(env, `/flow/def/v1/getOtherParam?defId=${defId}`)).prop ?? {},
  },
};

export const isCfgType = t => !!CFG_TYPES[t];

export async function cfgGet(env, defId, type, { nodeId } = {}) {
  const t = CFG_TYPES[type];
  if (!t) throw new Error(`未知配置类型: ${type}（可用: ${Object.keys(CFG_TYPES).join(', ')}）`);
  if (t.scope === 'node' && !nodeId) throw new Error(`类型 ${type} 需要 --node <nodeId>`);
  return t.read(env, defId, nodeId);
}

export async function cfgSet(env, def, type, data, { nodeId } = {}) {
  const t = CFG_TYPES[type];
  if (!t) throw new Error(`未知配置类型: ${type}（可用: ${Object.keys(CFG_TYPES).join(', ')}）`);
  if (t.readOnly) throw new Error(`类型 ${type} 是只读查询，请用 ibpm cfg-get ${type} ...`);
  if (t.scope === 'node' && !nodeId) throw new Error(`类型 ${type} 需要 --node <nodeId>`);
  const resp = await t.write(env, def.defId, nodeId, data);
  if (resp && resp.state === false) throw new Error(`写入失败: ${resp.message || JSON.stringify(resp).slice(0, 200)}`);
  // 服务端回写可能有短暂延迟；回读复核（允许服务端补充 null/默认字段）
  await sleep(400);
  const after = await t.read(env, def.defId, nodeId);
  const same = t.verify ? t.verify(data, after) : subsetMatches(data, after);
  if (!same) {
    const norm = v => JSON.stringify(v);
    console.log('⚠️ 回读与写入内容不完全一致（服务端可能做过规范化），请人工确认：');
    console.log('写入:', norm(data).slice(0, 800));
    console.log('回读:', norm(after).slice(0, 800));
    return { ok: false, after };
  }
  return { ok: true, after };
}