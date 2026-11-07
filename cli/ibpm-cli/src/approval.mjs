// 接口审批配置 + 流程契约/运行时查询（能力自 configuring-ibpm-interface-approval 技能整合，实测契约保持）
// 三态语义：无 propers=引擎不校验(放行,勿动) / 显式 false=拒绝 openapi complete / true=放行
import { readFileSync } from 'node:fs';
import { extractFormValue, extractGlobalRestfuls, buildFormObj, nodeProps, saveDefConf } from './defconf.mjs';

const headers = token => ({
  accept: '*/*',
  authorization: `Bearer ${token}`,
  'content-type': 'application/json;charset=UTF-8',
  'ibpm-client': 'pc',
  cookie: 'lang=zh',
});

async function api(env, path, { method = 'GET', body } = {}) {
  const res = await fetch(env.baseUrl + path, { method, headers: headers(env.token), body: body ? JSON.stringify(body) : undefined });
  if (res.status === 401) { console.error('✗ 401：token 失效，请 ibpm login'); process.exit(2); }
  if (!res.ok) throw new Error(`HTTP ${res.status} ${path}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

export const defGet = (env, defId) => api(env, `/model/flow/def/v1/defGet?defId=${defId}`);

/** 解析 bpmnXml 中每个 ext:userNode 的 allowInterfaceApproval 三态 */
export function readNodeStates(defJson) {
  const xml = defJson.bpmDefData.bpmnXml;
  const map = {};
  for (const c of xml.split(/<ext:userNode\s/).slice(1)) {
    const endIdx = c.indexOf('</ext:userNode>');
    const body = endIdx !== -1 ? c.slice(0, endIdx) : c;
    const bm = body.match(/bpmnElement="([^"]+)"/);
    const am = body.match(/allowInterfaceApproval="([^"]*)"/);
    if (bm) map[bm[1]] = am ? am[1] : '(无propers)';
  }
  return map;
}

export function printStates(title, map, targets) {
  console.log(`\n=== ${title} ===`);
  for (const [nid, v] of Object.entries(map)) {
    console.log(`  ${nid.padEnd(28)} ${v}${targets?.includes(nid) ? '  ← 目标' : ''}`);
  }
}

/** 查询三态 */
export async function approvalQuery(env, defId) {
  const json = await defGet(env, defId);
  console.log(`流程: ${json.name} defKey=${json.defKey} 状态=${json.status} 版本=${json.version} 更新=${json.updateTime}`);
  printStates(`节点配置 (${json.updateTime})`, readNodeStates(json));
  console.log('\n提示: 无propers=引擎不校验(放行,勿动)；false=拒绝(需改true)；true=放行');
}

/** 修改 + 改后复验 */
export async function approvalSave(env, defId, { nodes, value = true, formValue, mobileFormValue, settingTemplate, force }) {
  const targets = (nodes || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!targets.length) throw new Error('需要 --nodes "NodeA,NodeB"');
  const v = String(value) === 'true';

  const before = await defGet(env, defId);
  const beforeMap = readNodeStates(before);
  printStates(`改前 (${before.updateTime})`, beforeMap, targets);
  const badTargets = targets.filter(n => beforeMap[n] === '(无propers)');
  if (badTargets.length && !force) {
    throw new Error(`节点 ${badTargets.join(',')} 无 propers（引擎本就放行），写入显式配置无收益，已拒绝。确认要写时加 --force`);
  }

  const bpmnXml = before.bpmDefData.bpmnXml;
  let setting;
  if (settingTemplate) {
    setting = JSON.parse(readFileSync(settingTemplate, 'utf8'));
  } else {
    const auto = { pc: extractFormValue(bpmnXml, 'globalForm'), mobile: extractFormValue(bpmnXml, 'globalMobileForm') };
    const pc = formValue ?? auto.pc.value;
    const mobile = mobileFormValue ?? auto.mobile.value;
    const variant = [auto.pc, auto.mobile].some(x => x.variant);
    if (variant && (!pc || !mobile)) {
      throw new Error('线上存在全局表单配置但自动提取失败（结构变体），请从浏览器抓包取 defSettingJson 提供 --setting-template，或手动传 --form-value/--mobile-form-value');
    }
    console.log(`全局表单: PC=${pc ? pc.slice(0, 50) + '...' : '(空,维持原状)'} 移动=${mobile ? mobile.slice(0, 50) + '...' : '(空,维持原状)'}`);
    setting = {
      functionPanels: [],
      globalForm: buildFormObj('pc', pc),
      globalMobileForm: buildFormObj('mobile', mobile),
      instForm: { type: 'INNER', formType: 'pc', name: '', formValue: '' },
      instMobileForm: { type: 'INNER', formType: 'mobile', name: '', formValue: '' },
      bpmSubTableRights: [],
      nodePropertieMap: {},
      // 全局事件保留现状：saveDefConf 全量覆盖，写 [] 会清空设计器里配置的 globalRestFuls
      globalRestfuls: extractGlobalRestfuls(bpmnXml),
      globalScripts: [], formMap: {}, bpmSubTableRightMap: {}, mobileFormMap: {},
    };
  }
  setting.nodePropertieMap = Object.fromEntries(targets.map(n => [n, nodeProps(n, v)]));

  await saveDefConf(env, defId, setting);

  const after = await defGet(env, defId);
  const afterMap = readNodeStates(after);
  printStates(`改后 (${after.updateTime})`, afterMap, targets);
  const ok = targets.every(n => afterMap[n] === String(v));
  const othersChanged = Object.keys(beforeMap).filter(n => !targets.includes(n) && beforeMap[n] !== afterMap[n]);
  console.log(`\n${ok ? `✅ 验证通过：目标节点均为 ${v}` : '❌ 验证失败：目标节点未达预期值'}（saveDefConf 热生效，新发起实例立即使用新配置）`);
  if (othersChanged.length) console.log(`⚠️ 非目标节点变化: ${othersChanged.map(n => `${n}: ${beforeMap[n]}→${afterMap[n]}`).join(', ')}`);
}

/** 在线注册变量契约（varKey 以后端 buildFlowVars 的 key 为准，禁止自编；协议：defId + nodeId= 空串查流程级变量） */
export async function contract(env, defId) {
  const res = await api(env, `/model/flow/var/v1/listJson?defId=${defId}&nodeId=`);
  const list = Array.isArray(res) ? res : [];
  console.log('varKey               类型     名称');
  for (const v of list) {
    console.log(`${(v.varKey || '').padEnd(20)} ${(v.dataType || '').padEnd(8)} ${v.name || ''}${v.isRequired ? ' [必填]' : ''}`);
  }
  console.log(`\n共 ${list.length} 个。提示: 后端 startFlow 的 vars key 必须用这里的 varKey`);
}

/** 运行时实际审批链（注意双段前缀 /runtime/runtime/；参数 procInstId） */
export async function opinions(env, instId) {
  const res = await fetch(env.baseUrl + `/runtime/runtime/instance/v1/instanceFlowOpinions?procInstId=${instId}`, {
    headers: headers(env.token),
  });
  const text = await res.text();
  if (res.status !== 200 || text.includes('No value present')) {
    console.error(`✗ 实例 ${instId} 不存在或已被运行时清理（可用 ibpm 管理的最新发单实例重试）`);
    process.exit(1);
  }
  const data = JSON.parse(text);
  const list = Array.isArray(data) ? data : data.value || [];
  console.log('节点                审批人            状态      意见');
  for (const o of list) {
    console.log(`${(o.taskName || o.nodeId || '').padEnd(18)} ${(o.auditorName || o.qualfiedNames || '').padEnd(14)} ${(o.status || '').padEnd(8)} ${(o.opinion || '').slice(0, 20)}`);
  }
  console.log(`\n共 ${list.length} 条`);
}
