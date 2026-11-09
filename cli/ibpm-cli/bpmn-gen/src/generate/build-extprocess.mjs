// build-extprocess.mjs
// 生成 ext:extProcess 段（宏天 BPM 扩展：节点按钮、审批人、表单、变量）
//
// 这是系统 POJO 转换必须的部分（占原版 bpmnXml 的 24.7%）
// 结构（来自平台人工修正后的 golden 导出）:
//   <ext:extProcess>
//     <ext:extNodes>
//       ...每个节点一个 ext:userNode 或 ext:baseNode（含 extPlugins 审批人 + extButtons 按钮）
//     </ext:extNodes>
//     <ext:globalForm><ext:form .../></ext:globalForm>
//     <ext:extProperties>...12个空子标签...</ext:extProperties>
//     <ext:varDefs/>
//     <ext:extPlugins></ext:extPlugins>
//   </ext:extProcess>
//
// 输入：spec（流程描述）+ nodeDispose（审批人配置，从中提取 cacl 派生 extPlugins）

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 环境常量（config.json）：form.targetSystemId 前端页面所属子系统 ID（写死，与流程分类主系统不同）
let ENV = {};
try {
  ENV = JSON.parse(readFileSync(join(__dirname, '..', '..', 'config.json'), 'utf8'));
} catch { /* config 缺失时降级为 spec.sysName */ }
const FORM_TARGET_SYSTEM_ID = ENV.form?.targetSystemId || '';

function escapeAttr(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// 元素文本转义：只转 & < >（引号在元素文本里不需转义，对齐平台导出的 "S3" 裸引号形态）
function escapeText(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// CDATA 内容转义：只需拆开 ]]> 序列（CDATA 内实体不解析，绝不能做 XML 实体转义）
function escapeCdata(s) {
  if (s == null) return '';
  return String(s).replace(/]]>/g, ']]]]><![CDATA[>');
}

// ============ 按钮模板 ============

// UserTask 的 8 个操作按钮（固定模板，来自原版实测）
const USER_TASK_BUTTONS = [
  { alias: 'agree', name: '下一步' },
  { alias: 'reject', name: '退回' },
  { alias: 'free', name: '自由跳转' },
  { alias: 'delegate', name: '转办' },
  { alias: 'addSign', name: '加签' },
  { alias: 'saveDraft', name: '保存' },
  { alias: 'endProcess', name: '终止流程' },
];

// StartEvent 的按钮
const START_EVENT_BUTTONS = [
  { alias: 'startFlow', name: '提交申请' },
  { alias: 'saveDraft', name: '保存' },
];

// 单个按钮 XML
function buildButton(btn) {
  return `<ext:button alias="${escapeAttr(btn.alias)}" buttonType="system" customAlias="" isLock="false" name="${escapeAttr(btn.name)}"><ext:rejectMode><![CDATA[backToStart,rejectPre,reject]]></ext:rejectMode></ext:button>`;
}

function buildButtons(buttons) {
  if (!buttons || buttons.length === 0) return '';
  return `<ext:buttons>${buttons.map(buildButton).join('')}</ext:buttons>`;
}

// ============ 节点行为属性 propers ============

// 节点行为属性模板（52 项，键序/默认值对齐真实导出包验证；仅当 spec 节点声明 propers 时输出）
// executorIsEmpty="jump" 即"审批人为空时自动跳过该节点"（二级会签/三级会签/执行人这类可空节点用）
const NODE_PROPERS_DEFAULTS = [
  ['allowExecutorEmpty', 'false'],
  ['backMode', 'normal'],
  ['backNode', ''],
  ['backUserMode', 'normal'],
  ['jumpType', ''],
  ['notifyType', 'inner'],
  ['parentDefKey', 'local_'],
  ['postHandler', ''],
  ['prevHandler', ''],
  ['skipExecutorEmpty', 'false'],
  ['dateType', 'caltime'],
  ['dueTime', '0'],
  ['popWin', 'true'],
  ['choiceExcutor', ''],
  ['allowEditUrgentState', 'false'],
  ['help', ''],
  ['helpGlobal', ''],
  ['allowSmsApproval', 'false'],
  ['userNodeType', ''],
  ['approvalArea', 'approvalOpinion,zFile,file,processRecord,imageBpm'],
  ['referOpinion', 'true'],
  ['sponsorRevoke', 'false'],
  ['previousRevoke', 'false'],
  ['sponsorRevokeNew', '0'],
  ['previousRevokeNew', '0'],
  ['previousRevokeNodes', ''],
  ['template', ''],
  ['phone', ''],
  ['email', ''],
  ['sendType', ''],
  ['initFillData', 'false'],
  ['opinionField', ''],
  ['appendOpinion', 'false'],
  ['batchHandleRevoke', 'true'],
  ['signatureField', ''],
  ['signatureCover', 'false'],
  ['secretFree', 'false'],
  ['msgConfig', ''],
  ['printTemplate', ''],
  ['agreeCount', ''],
  ['disagreeCount', ''],
  ['userSamecantSkip', 'false'],
  ['executorIsEmpty', ''],
  ['executorUserAccount', ''],
  ['executorUserName', ''],
  ['preSkipAfterApprovePreview', 'false'],
  ['summaryRule', ''],
  ['backToCurNodeVisible', 'false'],
  // 默认 true：所有生成节点均允许 openapi 接口代办（E2E 自动化依赖；引擎对无 propers 块的节点同样放行）
  ['allowInterfaceApproval', 'true'],
  ['needSignTask', 'false'],
  ['machineNodeIdentifier', 'false'],
  ['approvalCommentsDefinition', ''],
];

/**
 * 生成节点行为属性块 <ext:propers>（紧跟 ext:buttons 之后，对齐平台导出）
 * @param {object} propers - spec 节点上的属性覆盖（如 { executorIsEmpty: 'jump' }），未声明则不输出
 */
export function buildPropers(propers) {
  if (!propers) return '';
  const attrs = NODE_PROPERS_DEFAULTS
    .map(([k, def]) => `${k}="${escapeAttr(propers[k] ?? def)}"`)
    .join(' ');
  return `<ext:propers><ext:item ${attrs}/></ext:propers>`;
}

// ============ 审批人 extPlugins ============

/**
 * 渲染单条规则的 calcs 内部 XML（cusers 或 hrScript）
 * @param {object} rule - 单条规则 {pluginType, source, logicCal, ...}
 * @returns {string} calcs 标签内的 XML 片段
 */
function buildCalcs(rule) {
  const logicCal = escapeAttr(rule.logicCal || 'or');
  // hrScript 规则无顶层 source 键，先按 pluginType 分流
  const source = rule.source || 'start';

  // hrScript：人员脚本（汇报关系）——CDATA 内一律原文，不做实体转义
  if (rule.pluginType === 'hrScript') {
    const scriptContent = escapeCdata(rule.script || '');
    const params = escapeCdata(rule.params || '[]');
    const scriptId = escapeCdata(rule.scriptId || '<SCRIPT_ID>');
    const desc = escapeCdata(rule.description || '');
    return `<hrScript xmlns="http://www.jee-soft.cn/bpm/plugins/userCalc/hrScript" extract="extract" logicCal="${logicCal}"><content><![CDATA[${scriptContent}]]></content><description><![CDATA[${desc}]]></description><scriptId><![CDATA[${scriptId}]]></scriptId><params><![CDATA[${params}]]></params></hrScript>`;
  }

  // orgReport：指定组织部门主管——对齐平台导出元素（属性平铺，无子元素）
  if (rule.pluginType === 'orgReport') {
    return `<orgReport xmlns="http://www.jee-soft.cn/bpm/plugins/userCalc/orgReport" extract="extract" logicCal="${logicCal}" orgCode="${escapeAttr(rule.orgCode || '')}" orgName="${escapeAttr(rule.orgName || '')}" reportLevel="${escapeAttr(rule.reportLevel || 'L2')}"></orgReport>`;
  }

  // cusers 系列：start / spec / var
  let inner = '';
  if (source === 'spec' && rule.userName) {
    inner = `<members account="${escapeAttr(rule.account || '')}" userId="${escapeAttr(rule.userId || '')}" userName="${escapeAttr(rule.userName)}"/>`;
  } else if (source === 'var') {
    // var 型：<var> 子元素指定流程变量（cacl 里是嵌套 var 对象；兼容旧版扁平 varName 字段）
    const v = rule.var || {};
    const varName = escapeAttr(v.name ?? rule.varName ?? '');
    const userValType = escapeAttr(v.userValType ?? rule.userValType ?? 'account');
    const executorType = escapeAttr(v.executorType ?? rule.executorType ?? 'user');
    inner = `<var executorType="${executorType}" name="${varName}" source="flowVar" userValType="${userValType}"/>`;
  }
  // source=start：inner 为空
  return `<cusers xmlns="http://www.jee-soft.cn/bpm/plugins/userCalc/cusers" extract="extract" logicCal="${logicCal}" source="${escapeAttr(source)}">${inner}</cusers>`;
}

/**
 * 从 nodeDispose 的 cacl（可能多条规则，';' 分隔）构造 userAssign 的 userRule XML
 * @param {Array} rules - 规则数组（已从 cacl split 解析）
 * @param {string[]} descs - 与 rules 同序的人读描述（来自 nodeDispose 节点级 description，
 *   var 型用它而非 cacl 内的 flowVar[user:x]，对齐平台导出）
 */
function buildUserAssign(rules, descs = []) {
  if (!rules || rules.length === 0) return '';
  // 每条规则一个 userRule（对齐真实导出包：多规则=多 userRule）
  const userRules = rules.map((rule, i) => {
    const desc = escapeText(descs[i] ?? rule.description ?? '');
    const calcs = buildCalcs(rule);
    return `<userRule xmlns="http://www.jee-soft.cn/bpm/plugins/userCalc/base" groupNo="1"><description>${desc}</description><keyId/><condition>{"junction":"and","condition":[]}</condition><conditionMode/><parentFlowkey>local_</parentFlowkey><type>user</type><calcs>${calcs}</calcs></userRule>`;
  }).join('');
  return `<userAssign xmlns="http://www.jee-soft.cn/bpm/plugins/task/userAssign">${userRules}</userAssign>`;
}

// ============ 节点 ============

/**
 * 生成单个节点的 ext 配置
 * @param {object} node - 节点 {id, type, name}
 * @param {Map} caclByNode - nodeId → cacl（审批人规则，从 nodeDispose 提取）
 */
function buildExtNode(node, caclByNode) {
  const name = escapeAttr(node.name || '');
  const elem = escapeAttr(node.id);

  if (node.type === 'userTask') {
    // extPlugins: 审批人（有 cacl 则填 userAssign，否则空）
    const entry = caclByNode.get(node.id);
    const extPlugins = entry
      ? `<ext:extPlugins>${buildUserAssign(entry.rules, entry.descs)}</ext:extPlugins>`
      : '<ext:extPlugins/>';
    const buttons = buildButtons(USER_TASK_BUTTONS);
    // 节点行为属性（如 executorIsEmpty=jump 审批人为空跳过）：spec 节点声明 propers 才输出
    const propers = node.propers ? '\n      ' + buildPropers(node.propers) : '';
    return `<ext:userNode nodeType="common" name="${name}" bpmnElement="${elem}">\n        ${extPlugins}\n      ${buttons}${propers}</ext:userNode>`;
  }

  // StartEvent：baseNode + 按钮
  if (node.type === 'startEvent') {
    const buttons = buildButtons(START_EVENT_BUTTONS);
    return `<ext:baseNode nodeType="common" name="${name}" bpmnElement="${elem}">\n        <ext:extPlugins/>\n      ${buttons}</ext:baseNode>`;
  }

  // EndEvent：baseNode 无按钮
  if (node.type === 'endEvent') {
    return `<ext:baseNode nodeType="common" name="${name}" bpmnElement="${elem}">\n        <ext:extPlugins/>\n      </ext:baseNode>`;
  }

  // 网关等其他类型：不进 extNodes（原版规律：只有 UserTask 和 StartEvent/EndEvent 才进）
  return null;
}

// ============ 流程级配置 ============

/**
 * 生成 globalForm（表单 URL 模板）
 * 从 spec.globalFormUrl 读，没填用占位模板
 */
function buildGlobalForm(spec) {
  let url;
  if (spec.globalFormUrl) {
    // 显式完整 URL 覆盖
    url = spec.globalFormUrl;
  } else {
    // formPath = 前端 view 组件路由路径（如 projectApply/addIbpm），workflowType 参数携带 processKey
    // targetSystemId 写死取 config.json form.targetSystemId（PMS 前端固定子系统，≠ 流程分类主系统 sysName）
    const formPath = spec.formPath || `${spec.processKey}/form`;
    const targetSystemId = escapeAttr(FORM_TARGET_SYSTEM_ID || spec.sysName || '');
    url = `{host}${formPath}?iframe=1&amp;workflowType=${spec.processKey}&amp;id={pk}&amp;nisbos_auth_token={nisbos_auth_token}&amp;targetSystemId=${targetSystemId}&amp;isEdit=[isEdit]`;
  }
  // {host} 后不能有 /（{host} 本身已含末尾 /，多一个 / 会导致网关 404）
  url = url.replace('{host}/', '{host}');
  return `<ext:globalForm><ext:form formExtraConf="" formValue="${url}" helpFile="" name="" parentFlowKey="local_" printType="" printUrl="" type="frame"/></ext:globalForm>`;
}

/**
 * 生成 globalMobileForm（移动端 H5 表单，结构同 PC、type=mobile）
 * spec.globalMobileFormUrl 填完整 URL 模板（{host}mobile/#/views/...），未填则不生成该段
 */
function buildGlobalMobileForm(spec) {
  if (!spec.globalMobileFormUrl) return '';
  let url = String(spec.globalMobileFormUrl).replace('{host}/', '{host}');
  return `<ext:globalMobileForm><ext:form formExtraConf="" formValue="${url}" helpFile="" name="" parentFlowKey="local_" printType="" printUrl="" type="mobile"/></ext:globalMobileForm>`;
}

/**
 * 生成 extProperties（12 个空子标签，固定模板）
 */
function buildExtProperties() {
  const tags = ['subjectRule', 'description', 'startNotifyType', 'archiveNotifyType', 'skipFirstNode', 'firstNodeUserAssign', 'skipSameUser', 'allowCopyTo', 'allowTransTo', 'useMainForm', 'allowReference', 'allowRefCounts'];
  return `<ext:extProperties>\n      ${tags.map(t => `<ext:${t}/>`).join('\n      ')}\n    </ext:extProperties>`;
}

/**
 * 生成 varDefs（流程变量定义）
 * 从 spec.variables 读（可选），格式：[{name, key, type, defaultVal, isRequired}]
 */
function buildVarDefs(spec) {
  const vars = spec.variables || [];
  if (vars.length === 0) {
    // 空时自闭合，对齐平台导出
    return '<ext:varDefs/>';
  }
  const defs = vars.map(v => {
    const name = escapeAttr(v.name || '');
    const key = escapeAttr(v.key || '');
    const type = escapeAttr(v.type || 'string');
    const desc = v.description ? escapeAttr(v.description) : '';
    const defaultVal = v.defaultVal !== undefined && v.defaultVal !== '' ? `<ext:defaultVal>${escapeAttr(v.defaultVal)}</ext:defaultVal>` : '<ext:defaultVal/>';
    const required = v.isRequired ? 'true' : 'false';
    return `<ext:variableDef><ext:name>${name}</ext:name><ext:key>${key}</ext:key><ext:type>${type}</ext:type><ext:description>${desc}</ext:description>${defaultVal}<ext:isRequired>${required}</ext:isRequired></ext:variableDef>`;
  }).join('\n');
  return `<ext:varDefs>${defs}\n</ext:varDefs>`;
}

/**
 * 生成 extPlugins 内容（globalRestFul：全局事件/PMS 工作流全局回调）
 * PMS 系统流程必须——默认注入；仅 spec.globalRestFul === false 显式关闭。
 * 形态对齐 QT04001 v4 实测版（PM02001 同款，设计器「初始赋值 → 全局事件设置」可正常读取）
 */
function buildExtPlugins(spec) {
  if (spec.globalRestFul === false) return '';
  const grf = spec.globalRestFul === true || !spec.globalRestFul ? {} : spec.globalRestFul;
  const name = escapeAttr(grf.name || 'PMS工作流全局回调');
  const url = escapeText(grf.url || name);
  const desc = escapeText(grf.desc || name);
  const header = escapeText(grf.header || 'IiI=');
  const invokeMode = escapeText(grf.invokeMode || '1');
  const callTime = escapeText(grf.callTime || 'taskCreate,taskComplete,startEvent,endEvent,doEndProcessEvent,backToNode,initiatorWithdraws');
  return `<globalRestFuls xmlns="http://www.jee-soft.cn/bpm/plugins/execution/globalRestFuls"><globalRestFul params="" outPutScript="" parentDefKey="local_" name="${name}"><url>${url}</url><desc>${desc}</desc><header>${header}</header><invokeMode>${invokeMode}</invokeMode><callTime>${callTime}</callTime><callNodes/></globalRestFul></globalRestFuls>`;
}

// ============ 主函数 ============

/**
 * 生成完整的 ext:extProcess 段
 * @param {object} spec - 流程描述 {processKey, sysName, formPath?, globalFormUrl?, nodes, variables?}
 * @param {Array} nodeDispose - nodeDispose.json 内容 [{code, data: [...]}]，从中提取审批人 cacl
 * @returns {string} ext:extProcess 段的 XML（含开头和结尾标签）
 */
export function buildExtProcess(spec, nodeDispose) {
  // 建 nodeId → {rules, descs} 映射（从 nodeDispose 提取；cacl/description 均用 ';' 分隔且同序）
  const caclByNode = new Map();
  if (nodeDispose && nodeDispose[0] && Array.isArray(nodeDispose[0].data)) {
    for (const d of nodeDispose[0].data) {
      // cacl 字段格式：单条 JSON，或多条 JSON 用 ';' 分隔
      const ruleStrs = String(d.cacl || '').split(';').filter(s => s.trim());
      const rules = [];
      for (const rs of ruleStrs) {
        try { rules.push(JSON.parse(rs)); } catch {}
      }
      // 节点级 description 是人读描述（与规则同序 ';' 拼接），userRule 的 description 用它
      const descs = String(d.description || '').split(';');
      if (rules.length) caclByNode.set(d.nodeKey, { rules, descs });
    }
  }

  const lines = [];
  lines.push('  <ext:extProcess>');
  lines.push('    <ext:extNodes>');

  // 每个节点一个 ext:userNode 或 ext:baseNode（网关等其他类型返回 null，跳过）
  for (const n of spec.nodes || []) {
    const nodeXml = buildExtNode(n, caclByNode);
    if (nodeXml) lines.push('      ' + nodeXml);
  }

  lines.push('    </ext:extNodes>');
  lines.push('    ');
  lines.push('  ' + buildGlobalForm(spec));
  const mobileFormXml = buildGlobalMobileForm(spec);
  if (mobileFormXml) lines.push('  ' + mobileFormXml);
  // 尾部顺序对齐平台导出：extProperties → varDefs → extPlugins（无 instForm）
  const extPluginsContent = buildExtPlugins(spec);
  lines.push('  ' + buildExtProperties() + buildVarDefs(spec) + '<ext:extPlugins>');
  if (extPluginsContent) lines.push(extPluginsContent);
  lines.push('</ext:extPlugins></ext:extProcess>');
  lines.push('</ext:definitions>');

  return lines.join('\n');
}
