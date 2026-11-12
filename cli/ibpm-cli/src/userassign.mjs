// 审批人规则 → cacl（复用 create-ibpm-flow 生成器 buildRules）+ userAssign XML 渲染（四型形态原包取证）
import { buildRules } from './gen/generate-nodedispose.mjs';

/** CLI 参数 → assignee 描述对象（与 spec.assignee 同构） */
export function assigneeFromArgs(a) {
  if (a.spec) {
    const [userName, account] = a.spec.split('/');
    return { source: 'spec', userName, account, userId: account, description: a.description };
  }
  if (a.var) return { source: 'var', varName: a.var, description: a.description };
  if (a.hrScript) {
    const [role, userVar] = a.hrScript.split(',');
    return { source: 'hrScript', role, userVar: userVar || 'startorAccount', description: a.description };
  }
  if (a.orgReport) {
    const [orgName, orgCode, reportLevel] = a.orgReport.split(',');
    return { source: 'orgReport', orgName, orgCode, reportLevel: reportLevel || 'L1', description: a.description };
  }
  return { source: 'start', description: a.description };
}

/** 规则对象 → userAssign extPlugins XML（形态对齐平台导出） */
function calcsXml(rule) {
  const lc = rule.logicCal || 'or';
  if (rule.pluginType === 'cusers') {
    const src = rule.source || 'start';
    if (src === 'spec') {
      const m = (rule.members && rule.members[0]) || { account: rule.account, userId: rule.userId, userName: rule.userName };
      return `<cusers xmlns="http://www.jee-soft.cn/bpm/plugins/userCalc/cusers" extract="extract" logicCal="${lc}" source="spec"><members account="${m.account}" userId="${m.userId}" userName="${m.userName}"/></cusers>`;
    }
    if (src === 'var') {
      const v = rule.var || {};
      return `<cusers xmlns="http://www.jee-soft.cn/bpm/plugins/userCalc/cusers" extract="extract" logicCal="${lc}" source="var"><var executorType="${v.executorType || 'user'}" name="${v.name || ''}" source="flowVar" userValType="${v.userValType || 'account'}"/></cusers>`;
    }
    return `<cusers xmlns="http://www.jee-soft.cn/bpm/plugins/userCalc/cusers" extract="extract" logicCal="${lc}" source="start"></cusers>`;
  }
  if (rule.pluginType === 'hrScript') {
    return `<hrScript xmlns="http://www.jee-soft.cn/bpm/plugins/userCalc/hrScript" extract="extract" logicCal="${lc}">`
      + `<content><![CDATA[${rule.script}]]></content>`
      + `<description><![CDATA[${rule.description}]]></description>`
      + `<scriptId><![CDATA[${rule.scriptId}]]></scriptId>`
      + `<params><![CDATA[${rule.params}]]></params></hrScript>`;
  }
  if (rule.pluginType === 'orgReport') {
    return `<orgReport xmlns="http://www.jee-soft.cn/bpm/plugins/userCalc/orgReport" extract="extract" logicCal="${lc}" orgCode="${rule.orgCode}" orgName="${rule.orgName}" reportLevel="${rule.reportLevel || 'L1'}"></orgReport>`;
  }
  throw new Error('未支持的审批人插件类型: ' + rule.pluginType);
}

export function userAssignXml(rules) {
  const body = rules.map(r =>
    `<userRule xmlns="http://www.jee-soft.cn/bpm/plugins/userCalc/base" groupNo="1">`
    + `<description>${(r.description || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')}</description>`
    + `<keyId/><condition>{"junction":"and","condition":[]}</condition><conditionMode/><parentFlowkey>local_</parentFlowkey><type>user</type>`
    + `<calcs>${calcsXml(r)}</calcs></userRule>`).join('');
  return `<userAssign xmlns="http://www.jee-soft.cn/bpm/plugins/task/userAssign">${body}</userAssign>`;
}

/** CLI 参数 → 规则数组（buildRules 复用技能实现，含 hrScript 环境常量） */
export function buildRulesFromArgs(a, nodeName) {
  return buildRules(assigneeFromArgs(a), nodeName);
}

/** 规则数组 → nodeDispose 条目字段（cacl/pluginType/description 拼接对齐平台导出） */
export function disposeFields(rules, displayDescs) {
  return {
    cacl: rules.map(r => JSON.stringify(r)).join(';'),
    pluginType: [...new Set(rules.map(r => r.pluginType))].join(';'),
    description: displayDescs.join(';'),
  };
}
