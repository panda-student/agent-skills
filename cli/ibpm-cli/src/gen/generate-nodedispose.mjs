// generate-nodedispose.mjs
// 生成 nodeDispose.json（节点审批人配置）
//
// 用法:
//   node src/generate-nodedispose.mjs samples/full-project-approval.json
//   node src/generate-nodedispose.mjs samples/full-project-approval.json -o out/nodeDispose.json
//
// 为流程里每个 UserTask 生成一条默认配置（框架），审批人用 source=start（发起人）占位，
// 导入系统后由用户手动配置实际审批人。
//
// 样本 schema 扩展（可选字段）:
//   {
//     name, processKey,
//     typeId, typeName, sysName, processVersion,  ← 流程元数据（不填用默认）
//     nodes: [{ id, type, name, assignee? }],      ← assignee 可选：覆盖默认审批人
//     edges: [...]
//   }
//
// assignee 结构（单对象或数组；数组=多规则，对应真实 cacl 的分号分隔）:
//   单对象: { source: "start" }
//   数组:   [ {source:"var",...}, {source:"hrScript",...} ]   ← 多规则（如 S6-1 或 S6-2）
//
// 4 种 source 类型（详见 references/assignee-rules.md）:
//   { source: "start" }                                      ← 发起人（默认）
//   { source: "spec", userName, userId, account }            ← 指定用户（会签加 logicCal:"and"）
//   { source: "var", varName, userValType?, executorType?, desc?, logicCal? }   ← 流程变量取人
//   { source: "hrScript", role, scriptVariant?, userVar?, userVarDesc?, orgDim?, logicCal? } ← 人员脚本（汇报关系）
//     scriptVariant: "byCode"（默认）| "byId"，scriptId/方法名/参数描述从 config.json 的 hrScript.scriptVariants 取

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 环境常量（config.json）：hrScript 变体/默认组织纬度/内置变量
let ENV = {};
try {
  ENV = JSON.parse(readFileSync(join(__dirname, '..', '..', 'config.json'), 'utf8'));
} catch { /* config 缺失时降级为占位符 */ }
const HR_VARIANTS = ENV.hrScript?.scriptVariants || {};
const DEFAULT_ORG_DIM = ENV.hrScript?.orgDim || '';
const BUILTIN_VARS = ENV.builtinVars || {};

// 流程元数据默认值（可被样本覆盖）
const DEFAULT_META = {
  typeId: '',
  typeName: '',
  sysName: '',
  processVersion: 1,
  tenantId: '-1',
};

// 雪花ID风格的19位数字字符串
function snowflakeId() {
  const ts = Date.now();
  const rand = Math.floor(Math.random() * 1e6).toString().padStart(6, '0');
  return (ts + rand).slice(0, 19);
}

// 当前时间字符串
function nowStr() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * 构造单条审批人规则（cacl 的一个单元）
 * @param {object} assignee - 审批人配置 {source, ...}
 * @param {string} nodeName - 节点名（用于 description 兑底）
 * @returns {{rule: object, displayDesc: string}} rule=序列化进 cacl 的规则对象（键序对齐平台导出），
 *   displayDesc=节点级/userRule 的人读描述（var 型与 cacl 内 description 不同）
 */
function buildRule(assignee, nodeName) {
  const a = assignee || {};
  const source = a.source || 'start';
  const logicCal = a.logicCal || 'or';

  // spec：指定用户
  if (source === 'spec') {
    const desc = a.description || a.userName || nodeName;
    return {
      rule: {
        extract: 'extract',
        pluginType: 'cusers',
        description: desc,
        source: 'spec',
        logicCal,
        userName: a.userName || '',
        userId: a.userId || '',
        account: a.account || '',
      },
      displayDesc: desc,
    };
  }

  // var：流程变量取人（嵌套 var 对象 + flowVar[user:x] 描述，对齐平台导出结构）
  if (source === 'var') {
    const varName = a.varName || '';
    const userValType = a.userValType || 'account';
    const executorType = a.executorType || 'user';
    return {
      rule: {
        extract: 'extract',
        pluginType: 'cusers',
        var: {
          userValType,
          executorType,
          groupValType: '',
          name: varName,
          source: 'flowVar',
          dimension: '',
        },
        description: a.description || `flowVar[${executorType}:${varName}]`,
        source: 'var',
        logicCal,
        userName: '',
        userId: '',
        account: '',
      },
      displayDesc: a.description || a.desc || `[变量]${varName || nodeName}`,
    };
  }

  // orgReport：指定组织部门主管（属性平铺，无子元素）
  if (source === 'orgReport') {
    const desc = a.description || '组织汇报关系查询插件';
    return {
      rule: {
        extract: 'extract',
        pluginType: 'orgReport',
        description: desc,
        orgCode: a.orgCode || '',
        orgName: a.orgName || '',
        reportLevel: a.reportLevel || 'L1',
        logicCal,
      },
      displayDesc: `组织:${a.orgName || a.orgCode || ''}`,
    };
  }

  // hrScript：人员脚本（汇报关系），双变体：byCode（默认）/ byId，常量从 config.json 取
  if (source === 'hrScript') {
    const variantKey = a.scriptVariant || 'byCode';
    let variant = HR_VARIANTS[variantKey];
    if (!variant) {
      console.warn(`  ⚠️ 未知 scriptVariant="${variantKey}"（节点 ${nodeName}），降级用占位模板（byCode 形态）`);
      variant = { scriptId: '<SCRIPT_ID>', scriptName: '根据用户code获取指定用户的汇报关系', method: 'getUserByFlowUserCode', userParaDesc: '用户账号account', userParaCtBindKey: 'account', dimParaDesc: '组织纬度ID' };
    }
    const role = a.role || '';
    const userVar = a.userVar || 'startorAccount';
    // 参数人读描述：显式指定 > 内置变量表 > 变量名兑底（golden 里 value 与 description 分离，如 startorAccount/发起人工号）
    const userVarDesc = a.userVarDesc || BUILTIN_VARS[userVar] || userVar;
    const orgDim = a.orgDim || DEFAULT_ORG_DIM;
    const script = `jiuMooUserScript.${variant.method}(${userVar} ,"${role}" ,"${orgDim}" )`;
    // 平台描述形态：常量参数（角色码/纬度）带引号，变量参数用人读描述
    const desc = a.description || `[人员脚本]【${variant.scriptName}】参数:(${variant.userParaDesc}:${userVarDesc} ,流程角色code:"${role}" ,${variant.dimParaDesc}:"${orgDim}" )`;
    // 参数定义（对齐平台 params 结构：常量 value/description 均带引号，变量 description 用人读文案）
    const params = [
      { paraName: 'arg0', paraType: 'java.lang.String', paraDesc: variant.userParaDesc, paraCt: 'base:user-selector', paraCtBindKey: variant.userParaCtBindKey, valueType: '0', value: userVar, description: userVarDesc },
      { paraName: 'arg1', paraType: 'java.lang.String', paraDesc: '流程角色code', paraCt: '', valueType: '1', value: `"${role}"`, description: `"${role}"` },
      { paraName: 'arg2', paraType: 'java.lang.String', paraDesc: variant.dimParaDesc, paraCt: 'base:dem-selector', paraCtBindKey: 'id', valueType: '1', value: `"${orgDim}"`, description: `"${orgDim}"` },
    ];
    // 键序对齐平台导出：scriptId 首位，无顶层 source/userName/userId/account
    return {
      rule: {
        scriptId: a.scriptId || variant.scriptId,
        extract: 'extract',
        pluginType: 'hrScript',
        description: desc,
        logicCal,
        params: JSON.stringify(params),
        script,
      },
      displayDesc: desc,
    };
  }

  // 未知 source：告警并降级为发起人
  if (source !== 'start') {
    console.warn(`  ⚠️ 未识别的 source="${source}"（节点 ${nodeName}），降级为 start（发起人）`);
  }
  return {
    rule: {
      extract: 'extract',
      pluginType: 'cusers',
      description: a.description || '发起人',
      source: 'start',
      logicCal: 'or',
      userName: '',
      userId: '',
      account: '',
    },
    displayDesc: a.description || '发起人',
  };
}

/**
 * 把节点的 assignee 归一化为规则数组
 * @param {object|object[]|undefined} assigneeRaw - 单对象 / 数组 / 未定义
 * @param {string} nodeName - 节点名
 * @returns {{rule: object, displayDesc: string}[]} 规则数组（至少 1 条）
 */
function buildRules(assigneeRaw, nodeName) {
  if (!assigneeRaw) return [buildRule({ source: 'start' }, nodeName)];
  const arr = Array.isArray(assigneeRaw) ? assigneeRaw : [assigneeRaw];
  return arr.map(a => buildRule(a, nodeName));
}
export { buildRule, buildRules, buildNodeDispose };

/**
 * 为单个节点构造完整的 dispose 配置项
 * 多规则时：cacl/pluginType/description 用 ';' 拼接，对应真实导出包结构
 */
function buildNodeDispose(node, meta, assigneeMap) {
  const id = snowflakeId();
  const built = buildRules(assigneeMap?.get(node.id), node.name);
  const rules = built.map(b => b.rule);
  // cacl：多条规则 JSON 用 ';' 分隔（对齐真实导出包的 cacl 字段格式）
  const cacl = rules.map(r => JSON.stringify(r)).join(';');
  // pluginType：多规则类型用 ';' 拼接（去重保序）
  const pluginTypes = [...new Set(rules.map(r => r.pluginType))];
  const pluginType = pluginTypes.join(';');
  // description：节点级用人读描述（var 型与 cacl 内 flowVar[user:x] 不同，对齐平台导出）
  const description = built.map(b => b.displayDesc).join(';');

  return {
    createBy: null,
    createOrgId: null,
    createTime: null,
    updateBy: null,
    updateTime: nowStr(),
    id,
    processName: meta.processName,
    processKey: meta.processKey,
    typeId: meta.typeId,
    typeName: meta.typeName,
    sysName: meta.sysName,
    processVersion: meta.processVersion,
    nodeKey: node.id,
    nodeName: node.name || '',
    nodeType: 'userTask',
    userType: null,
    description,
    cacl,
    pluginType,
    sources: String(rules.length),
    isDele: '0',
    version: null,
    tenantId: meta.tenantId,
    actionType: '审批',
    actionTypeId: '1',
    orgCodes: null,
    pkVal: id,
  };
}

/**
 * 主生成函数
 * @param {object} spec - 流程描述 {name, processKey, typeId?, typeName?, sysName?, nodes, ...}
 * @returns {Array} nodeDispose.json 的内容（数组）
 */
export function generateNodeDispose(spec) {
  const meta = {
    processName: spec.name || '',
    processKey: spec.processKey || spec.name || 'process_1',
    typeId: spec.typeId ?? DEFAULT_META.typeId,
    typeName: spec.typeName ?? DEFAULT_META.typeName,
    sysName: spec.sysName ?? DEFAULT_META.sysName,
    processVersion: spec.processVersion ?? DEFAULT_META.processVersion,
    tenantId: spec.tenantId ?? DEFAULT_META.tenantId,
  };

  // 建 assignee 覆盖映射：nodeId → assignee 配置
  const assigneeMap = new Map();
  if (Array.isArray(spec.nodes)) {
    for (const n of spec.nodes) {
      if (n.assignee) assigneeMap.set(n.id, n.assignee);
    }
  }

  // 为每个 userTask 生成一条配置
  const userTasks = (spec.nodes || []).filter(n => n.type === 'userTask');
  const data = userTasks.map(n => buildNodeDispose(n, meta, assigneeMap));

  return [{ code: meta.processKey, data }];
}
