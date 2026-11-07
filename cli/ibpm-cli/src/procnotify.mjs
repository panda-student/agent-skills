// 办结抄送（procNotify）配置：流程结束后按规则抄送指定节点处理人
// 对应设计器「其它设置 → 传阅 → 办结抄送设置」
// API 契约（2026-10-28 mvue 前端抓包实证）：
//   读 GET  {bpmModel}/flow/plugins/v1/procNotifyEdit?defId=<defId> → [{userAssignRules, msgTypes}]（未配置返回 []）
//   写 POST {bpmModel}/flow/plugins/v1/procNotifySave?defId=<defId>，body 同读取结构（全量覆盖）
// 关键约束：配置按 defId（版本）逐版本存储，导入新增版本后【不会】自动继承——
//   因此 import（两段式）必须快照旧版规则、import-confirm 成功后承接，否则 CLI 编辑重导入会丢配置。
import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PROC_NOTIFY_STASH_DIR = join(homedir(), '.ibpm-cli');

// ---- 纯决策：规则结构校验（不触网） ----
export function validateProcNotifyRules(rules) {
  const errors = [];
  if (!Array.isArray(rules) || rules.length === 0) return ['规则必须是非空数组'];
  rules.forEach((rule, i) => {
    if (!rule.msgTypes) errors.push(`规则${i + 1}: msgTypes（通知方式）为空`);
    if (!Array.isArray(rule.userAssignRules) || rule.userAssignRules.length === 0) {
      errors.push(`规则${i + 1}: userAssignRules（人员配置）为空`);
    } else {
      rule.userAssignRules.forEach((r, j) => {
        const hasCalc = Array.isArray(r.calcs) && r.calcs.length > 0;
        if (!r.description && !hasCalc) errors.push(`规则${i + 1}.人员${j + 1}: description 与 calcs 均为空`);
      });
    }
  });
  return errors;
}

// ---- 通信协议层：接口唯一定义处 ----
async function procNotifyApi(env, path, { method = 'GET', body } = {}) {
  const res = await fetch(env.baseUrl + env.bpmModel + path, {
    method,
    headers: {
      Authorization: `Bearer ${env.token}`,
      'content-type': 'application/json;charset=UTF-8',
      'ibpm-client': 'pc',
      cookie: 'lang=zh',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    console.error('✗ 认证失败(401)：token 已失效。请执行: ibpm login');
    process.exit(2);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} ${path}: ${(await res.text()).slice(0, 200)}`);
  return res;
}

export async function readProcNotify(env, defId) {
  const res = await procNotifyApi(env, `/flow/plugins/v1/procNotifyEdit?defId=${defId}`);
  const text = await res.text();
  if (!text) return [];
  try {
    const value = JSON.parse(text);
    return Array.isArray(value) ? value : (value.value || []);
  } catch {
    return [];
  }
}

export async function saveProcNotify(env, defId, rules) {
  const errors = validateProcNotifyRules(rules);
  if (errors.length) throw new Error('办结抄送规则校验失败:\n  - ' + errors.join('\n  - '));
  const res = await procNotifyApi(env, `/flow/plugins/v1/procNotifySave?defId=${defId}`, { method: 'POST', body: rules });
  const data = await res.json();
  if (data.state === false) throw new Error('办结抄送保存失败: ' + (data.message || JSON.stringify(data).slice(0, 200)));
}

// ---- 渲染 ----
const MSG_TYPE_NAMES = { mail: '邮件', inner: '站内消息' };

export function renderProcNotify(rules) {
  if (!rules.length) {
    console.log('（未配置办结抄送）');
    return;
  }
  rules.forEach((rule, i) => {
    const descs = (rule.userAssignRules || [])
      .map(r => r.description || (r.calcs || []).map(c => c.description).join(' 或 '))
      .filter(Boolean);
    const msgs = String(rule.msgTypes || '').split(',').filter(Boolean).map(t => MSG_TYPE_NAMES[t] || t).join('+');
    console.log(`  规则${i + 1}: ${descs.join('；') || '(无人员配置)'} → ${msgs}`);
  });
}

// ---- 业务规则：版本间承接（新版本为空且旧版非空时才复制，绝不覆盖新配置） ----
export async function carryOverProcNotify(env, fromDefId, toDefId) {
  const fromRules = await readProcNotify(env, fromDefId);
  if (!fromRules.length) return '源版本未配置办结抄送，跳过';
  const toRules = await readProcNotify(env, toDefId);
  if (toRules.length) return '新版本已存在办结抄送配置，跳过（不覆盖）';
  await saveProcNotify(env, toDefId, fromRules);
  return `已承接 ${fromRules.length} 条办结抄送规则`;
}

// ---- import → import-confirm 跨进程交接快照 ----
function stashPath(cacheFileId) {
  return join(PROC_NOTIFY_STASH_DIR, `procnotify-stash-${cacheFileId}.json`);
}

export function stashProcNotify(cacheFileId, payload) {
  writeFileSync(stashPath(cacheFileId), JSON.stringify(payload), 'utf8');
}

export function loadProcNotifyStash(cacheFileId) {
  const path = stashPath(cacheFileId);
  if (!existsSync(path)) return null;
  const payload = JSON.parse(readFileSync(path, 'utf8'));
  rmSync(path);
  return payload;
}
