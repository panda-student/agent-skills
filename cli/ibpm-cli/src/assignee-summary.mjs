// 审批人规则摘要：show / nodes 共用，避免三处重复映射
export function calcSummary(c, limit = 60) {
  if (c.source === 'spec') return `指定:${c.description || c.userName}`;
  if (c.source === 'start') return '发起人';
  if (c.source === 'var') return `变量:${c.var?.name || '?'}`;
  if (c.pluginType === 'hrScript') return `脚本:${(c.script || '').slice(0, limit)}`;
  if (c.pluginType === 'orgReport') return `组织:${c.orgName || c.orgCode || '?'}`;
  return c.source || c.pluginType || '?';
}

/** userRule[] → 扁平 calc[]（nodeUserMap 是 userRule，nodeDispose.cacl 是 calc） */
export const flattenCalcs = rules =>
  (rules || []).flatMap(r => (r.calcs && r.calcs.length) ? r.calcs : [r]);

export const summarizeRules = (rules, limit = 60) =>
  flattenCalcs(rules).map(c => calcSummary(c, limit)).join(' + ');

/** 审批人规则投影：用于写入后回读复核（忽略服务端补充的额外字段） */
export const projectUserRules = rules => (rules || []).map(r => ({
  groupNo: r.groupNo,
  description: r.description,
  condition: r.condition,
  calcs: (r.calcs || []).map(c => ({
    pluginType: c.pluginType, source: c.source, logicCal: c.logicCal,
    varName: c.var?.name, account: c.account, userId: c.userId, userName: c.userName,
    orgCode: c.orgCode, reportLevel: c.reportLevel, scriptId: c.scriptId,
  })),
}));