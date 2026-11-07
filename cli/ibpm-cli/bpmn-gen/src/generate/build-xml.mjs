// build-xml.mjs
// JSON 流程描述 → 无坐标 BPMN 2.0 XML（可喂给 bpmn-auto-layout）
//
// 输入 schema:
//   {
//     name: string,                 // 流程名（可选）
//     nodes: [{ id, type, name }],  // type 用 BPMN 规范类型名，如 startEvent/userTask/exclusiveGateway/...
//     edges: [{ id, source, target }]  // source/target 是 node.id
//   }
//
// 输出: 无坐标 BPMN XML 字符串（不含 BPMNDiagram 段）

import { BpmnModdle } from 'bpmn-moddle';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 平台内置流程变量白名单（来自 config.json，缺失时降级为空）
let BUILTIN_VARS = {};
try {
  const cfg = JSON.parse(readFileSync(join(__dirname, '..', '..', 'config.json'), 'utf8'));
  BUILTIN_VARS = cfg.builtinVars || {};
} catch { /* config 缺失时降级 */ }

// 网关 condition 表达式里的 UEL/JUEL 保留字（非变量引用）
const COND_KEYWORDS = new Set([
  'and', 'or', 'not', 'true', 'false', 'null', 'empty',
  'eq', 'ne', 'lt', 'gt', 'le', 'ge', 'div', 'mod', 'instanceof',
]);

// 支持的节点类型：JSON 用 camelCase（贴近 BPMN 规范、对 AI 自然），内部转 moddle 要的 PascalCase
// 后续要加类型，往这里加即可，moddle 会按 BPMN 2.0 元模型校验
const SUPPORTED_NODE_TYPES = {
  startEvent:        'StartEvent',
  endEvent:          'EndEvent',
  task:              'Task',
  userTask:          'UserTask',
  serviceTask:       'ServiceTask',
  manualTask:        'ManualTask',
  sendTask:          'SendTask',
  receiveTask:       'ReceiveTask',
  scriptTask:        'ScriptTask',
  businessRuleTask:  'BusinessRuleTask',
  exclusiveGateway:  'ExclusiveGateway',  // 排他网关
  parallelGateway:   'ParallelGateway',   // 并行网关
  inclusiveGateway:  'InclusiveGateway',  // 包容网关
  subProcess:        'SubProcess',        // 子流程（bpmn-auto-layout 只支持折叠态）
};

/**
 * 校验 JSON 流程描述的结构合法性
 * @param {object} spec
 */
export function validateSpec(spec) {
  const errors = [];

  if (!spec || typeof spec !== 'object') {
    return ['spec 必须是对象'];
  }
  if (!Array.isArray(spec.nodes)) {
    errors.push('spec.nodes 必须是数组');
  }
  if (!Array.isArray(spec.edges)) {
    errors.push('spec.edges 必须是数组');
  }
  if (errors.length) return errors;

  // 检查节点
  const nodeIds = new Set();
  for (const n of spec.nodes) {
    if (!n.id) {
      errors.push(`节点缺少 id: ${JSON.stringify(n)}`);
      continue;
    }
    if (nodeIds.has(n.id)) {
      errors.push(`节点 id 重复: ${n.id}`);
    }
    nodeIds.add(n.id);

    if (!n.type) {
      errors.push(`节点 ${n.id} 缺少 type`);
    } else if (!SUPPORTED_NODE_TYPES[n.type]) {
      errors.push(`节点 ${n.id} 的 type "${n.type}" 不支持（支持: ${Object.keys(SUPPORTED_NODE_TYPES).join(', ')}）`);
    }

    // ID 必须是合法 XML NCName（不能以数字开头）
    if (n.id && /^[0-9]/.test(n.id)) {
      errors.push(`节点 id "${n.id}" 不能以数字开头（XML 规范要求）`);
    }
  }

  // 检查边
  const edgeIds = new Set();
  for (const e of spec.edges) {
    if (!e.id) {
      errors.push(`边缺少 id: ${JSON.stringify(e)}`);
      continue;
    }
    if (edgeIds.has(e.id)) {
      errors.push(`边 id 重复: ${e.id}`);
    }
    edgeIds.add(e.id);

    if (!nodeIds.has(e.source)) {
      errors.push(`边 ${e.id} 的 source "${e.source}" 不存在`);
    }
    if (!nodeIds.has(e.target)) {
      errors.push(`边 ${e.id} 的 target "${e.target}" 不存在`);
    }
  }

  // 网关出边 condition 引用的变量必须已声明（spec.variables 或 config.json builtinVars）
  const GATEWAY_TYPES = new Set(['exclusiveGateway', 'inclusiveGateway', 'parallelGateway']);
  const gatewayIds = new Set(spec.nodes.filter(n => GATEWAY_TYPES.has(n.type)).map(n => n.id));
  if (gatewayIds.size) {
    const declaredVars = new Set([
      ...Object.keys(BUILTIN_VARS),
      ...(spec.variables || []).map(v => v.key).filter(Boolean),
    ]);
    for (const e of spec.edges) {
      if (!e.condition || !gatewayIds.has(e.source)) continue;
      // 剔除字符串字面量后提取标识符；lookbehind 排除属性访问（obj.prop 的 prop）
      const cleaned = String(e.condition).replace(/'[^']*'|"[^"]*"/g, '');
      for (const m of cleaned.matchAll(/(?<!\.)[a-zA-Z_$][\w$]*/g)) {
        const id = m[0];
        if (!COND_KEYWORDS.has(id) && !declaredVars.has(id)) {
          errors.push(`边 ${e.id} 的 condition "${e.condition}" 引用了未声明的变量 "${id}"；请在 spec.variables 声明，或在 config.json.builtinVars 补为平台内置变量`);
        }
      }
    }
  }

  return errors;
}

/**
 * 把 JSON 流程描述转成无坐标 BPMN XML
 * @param {object} spec - { name?, nodes, edges }
 * @returns {Promise<string>} 无坐标 BPMN XML
 */
export async function buildNoDiXml(spec) {
  const errors = validateSpec(spec);
  if (errors.length) {
    throw new Error('流程描述校验失败:\n  - ' + errors.join('\n  - '));
  }

  const moddle = new BpmnModdle();

  // 1. definitions 根节点
  const definitions = moddle.create('bpmn:Definitions', {
    id: 'Definitions_1',
    targetNamespace: 'http://bpmn.io/schema/bpmn',
  });

  // 2. process
  const process = moddle.create('bpmn:Process', {
    id: 'Process_1',
    isExecutable: false,
  });
  if (spec.name) {
    process.set('name', spec.name);
  }

  // 3. 创建所有节点，建 id→element 映射
  // JSON 用 camelCase type，这里转成 moddle 要的 PascalCase
  const nodeMap = new Map();
  for (const n of spec.nodes) {
    const attrs = { id: n.id };
    if (n.name) attrs.name = n.name;
    const moddleType = `bpmn:${SUPPORTED_NODE_TYPES[n.type]}`;
    const el = moddle.create(moddleType, attrs);
    nodeMap.set(n.id, el);
  }

  // 4. 创建所有边，source/target 用对象引用（moddle 序列化时自动转 ID）
  const edges = [];
  for (const e of spec.edges) {
    const flow = moddle.create('bpmn:SequenceFlow', {
      id: e.id,
      sourceRef: nodeMap.get(e.source),
      targetRef: nodeMap.get(e.target),
    });
    if (e.name) flow.set('name', e.name);
    // 网关条件表达式（UEL）：condition 是表达式字符串，如 "projectAmount>=200000"
    if (e.condition) {
      const condExpr = moddle.create('bpmn:FormalExpression', {
        body: e.condition,
      });
      flow.set('conditionExpression', condExpr);
    }
    edges.push({ flow, source: e.source, target: e.target });
  }

  // 5. 补 incoming/outgoing（保持规范对称，bpmn-auto-layout 不依赖它，但导入工具会检查）
  for (const { flow, source, target } of edges) {
    nodeMap.get(source).get('outgoing').push(flow);
    nodeMap.get(target).get('incoming').push(flow);
  }

  // 6. 节点和边都挂到 process.flowElements（顺序无所谓，moddle 序列化会按规范排）
  process.set('flowElements', [
    ...spec.nodes.map(n => nodeMap.get(n.id)),
    ...edges.map(e => e.flow),
  ]);

  // 7. process 放进 definitions.rootElements
  definitions.get('rootElements').push(process);

  // 8. 序列化（不带 DI → 无坐标）
  const { xml } = await moddle.toXML(definitions, { format: true });
  return xml;
}
