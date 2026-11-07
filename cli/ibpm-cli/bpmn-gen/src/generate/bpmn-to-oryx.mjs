// bpmn-to-oryx.mjs
// 带坐标的 BPMN XML → Oryx defJson（系统设计器原生格式）
//
// 输入：
//   layoutedXml - bpmn-auto-layout 输出的带坐标 BPMN XML
//   spec        - 原始简单 JSON 描述（用来读节点 name/condition 等业务字段）
// 输出：Oryx defJson 对象（可直接 JSON.stringify 写文件）
//
// 坐标转换规则（来自对原 zip 的实测分析）：
//   节点 bounds:  upperLeft = {x, y},  lowerRight = {x+width, y+height}
//   边 dockers:
//     首点 = 源节点中心相对偏移 {源w/2, 源h/2}
//     末点 = 目标节点中心相对偏移 {目标w/2, 目标h/2}
//     中间点 = waypoint 绝对坐标（去掉首尾，因为首尾是边的实际起止点=节点边界）

import { BpmnModdle } from 'bpmn-moddle';
import { randomUUID } from 'node:crypto';

/**
 * XML 实体反转义：把 &gt; &lt; &amp; &quot; &apos; 还原成原文
 * 输入可能是转义态（如从原 zip 提取的 "&gt;=20万"），也可能是原文（如 AI 直接生成的 ">=20万"）
 * 统一反转义，保证输出干净
 */
function unescapeXml(s) {
  if (!s || typeof s !== 'string') return s;
  return s
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&'); // &amp; 必须最后还原，避免二次替换
}

// 输入 type(camelCase) → Oryx stencil.id 映射（已实测）
const STENCIL_MAP = {
  startEvent: 'StartEvent',
  endEvent: 'EndEvent',
  task: 'Task',
  userTask: 'UserTask',
  serviceTask: 'ServiceTask',
  manualTask: 'ManualTask',
  sendTask: 'SendTask',
  receiveTask: 'ReceiveTask',
  scriptTask: 'ScriptTask',
  businessRuleTask: 'BusinessRuleTask',
  exclusiveGateway: 'XORGateway',
  parallelGateway: 'ANDGateway',
  inclusiveGateway: 'ORGateway',
  subProcess: 'Subprocess',
};

// 输入 type(camelCase) → BPMN moddle type(PascalCase) 映射（用于反查节点类型）
const MODDLE_TYPE_MAP = {
  startEvent: 'StartEvent',
  endEvent: 'EndEvent',
  task: 'Task',
  userTask: 'UserTask',
  serviceTask: 'ServiceTask',
  manualTask: 'ManualTask',
  sendTask: 'SendTask',
  receiveTask: 'ReceiveTask',
  scriptTask: 'ScriptTask',
  businessRuleTask: 'BusinessRuleTask',
  exclusiveGateway: 'ExclusiveGateway',
  parallelGateway: 'ParallelGateway',
  inclusiveGateway: 'InclusiveGateway',
  subProcess: 'SubProcess',
};

// 节点标准尺寸表（来自原 zip 实测，强制对齐系统原版）
// bpmn-auto-layout 给的尺寸（36×36/100×80/50×50）和系统不一致，统一覆盖
const DEFAULT_SIZE = {
  StartEvent:       { width: 30, height: 30 },
  EndEvent:         { width: 28, height: 28 },
  UserTask:         { width: 100, height: 46 },
  Task:             { width: 100, height: 80 },
  ServiceTask:      { width: 100, height: 80 },
  ManualTask:       { width: 100, height: 80 },
  SendTask:         { width: 100, height: 80 },
  ReceiveTask:      { width: 100, height: 80 },
  ScriptTask:       { width: 100, height: 80 },
  BusinessRuleTask: { width: 100, height: 80 },
  XORGateway:       { width: 40, height: 40 },
  ANDGateway:       { width: 40, height: 40 },
  ORGateway:        { width: 40, height: 40 },
  Subprocess:       { width: 100, height: 80 },
};

// UserTask 名字过长时按需扩展宽度（对齐系统行为：原版里 19个是100宽，2个长名是186/215宽）
// 经验值：每个中文字符约 14px，超过 7 个字（100px 装不下）就扩展
function estimateTextWidth(name) {
  if (!name) return 0;
  let textWidth = 0;
  for (const ch of name) {
    textWidth += /[\u4e00-\u9fa5]/.test(ch) ? 14 : 8;
  }
  return textWidth;
}

function calcUserTaskWidth(name) {
  if (!name) return 100;
  // 估算文字宽度：中文2字节按14px，英文1字节按8px
  const textWidth = estimateTextWidth(name);
  // padding 10px 左右，最小 100
  return Math.max(100, Math.ceil(textWidth + 20));
}

// 根据节点类型和名字，返回应该用的尺寸
function getNodeSize(stencilId, name) {
  const base = DEFAULT_SIZE[stencilId];
  if (!base) return { width: 100, height: 80 };
  if (stencilId === 'UserTask') {
    return { width: calcUserTaskWidth(name), height: base.height };
  }
  return base;
}

// 固定模板：task listeners（每个 UserTask 都挂这两个，来自原 zip 实测）
const TASK_LISTENERS = {
  taskListeners: [
    { event: 'create', delegateExpression: '${taskCreateListener}' },
    { event: 'complete', delegateExpression: '${taskCompleteListener}' },
  ],
};

// 各 stencil 类型的默认 properties（来自原 zip 实测，系统导入时校验这些字段必须存在）
// 即使是空值/默认值，缺失也会导致"属性丢失"
// 字段顺序按原版排列（overrideid/name 在前，扩展字段在后）
const DEFAULT_PROPS_BY_STENCIL = {
  StartEvent: {},  // 主字段后追加 i18nKey
  EndEvent: {},    // 主字段后追加 documentation
  UserTask: {},    // 主字段后追加 i18nKey
  Task: {},
  ServiceTask: {},
  XORGateway: {},  // 主字段后追加 documentation/asynchronousdefinition/...
  ANDGateway: {},
  ORGateway: {},
};

// 节点"尾部"扩展字段（按原版顺序，追加在主字段之后）
const TAIL_PROPS_BY_STENCIL = {
  StartEvent: { i18nKey: '' },
  EndEvent: { documentation: '' },
  UserTask: { i18nKey: '' },
  Task: { i18nKey: '' },
  ServiceTask: { i18nKey: '' },
  XORGateway: {
    documentation: '',
    asynchronousdefinition: 'false',
    exclusivedefinition: 'false',
    sequencefloworder: '',
  },
  ANDGateway: {
    documentation: '',
    asynchronousdefinition: 'false',
    exclusivedefinition: 'false',
    sequencefloworder: '',
  },
  ORGateway: {
    documentation: '',
    asynchronousdefinition: 'false',
    exclusivedefinition: 'false',
    sequencefloworder: '',
  },
};

// 固定模板：execution listeners（流程级，来自原 zip 实测）
const EXECUTION_LISTENERS = JSON.stringify({
  executionListeners: [
    { event: 'start', delegateExpression: '${startEventListener}' },
    { event: 'end', delegateExpression: '${endEventListener}' },
  ],
});

/**
 * 计算节点中心的相对偏移量（docker 首尾点用）
 * 原版规律：XORGateway(40×40) 用 {20.5, 20.5}（偶数尺寸中心 +0.5 像素对齐），
 *           其他用整数 {w/2, h/2}
 */
function centerOffset(shape, stencilId) {
  const halfW = shape.width / 2;
  const halfH = shape.height / 2;
  // 网关尺寸 40(偶数)，中心 20，原版统一用 20.5
  if (stencilId === 'XORGateway' || stencilId === 'ANDGateway' || stencilId === 'ORGateway') {
    return { x: halfW + 0.5, y: halfH + 0.5 };
  }
  return { x: halfW, y: halfH };
}

/**
 * 坐标重排：解决节点重叠 + 强制同行水平对齐
 *
 * bpmn-auto-layout 按 100×80 尺寸布局，我们改成真实尺寸后会重叠，且不同类型节点
 * 因高度不同导致中心 y 不齐。这里保留 layout 的拓扑顺序和分行，重新算 x/y：
 *   1. 按 layout 的中心 y 聚类成"行"（y 差异 < 40 算同行）
 *   2. 每行内按 layout 的 x 排序，紧凑排列（节点间固定间距 GAP）
 *   3. 主行（含 StartEvent）的节点中心 y 对齐到 StartEvent 中心 y
 *      其他行的节点中心 y 对齐到该行第一个节点的中心 y
 *
 * @param {object} spec - 流程描述（读 nodes）
 * @param {Map} shapeMap - bpmnId → {x,y,width,height}（会被原地更新坐标和尺寸）
 */
function relayoutNodes(spec, shapeMap) {
  const GAP = 50; // 同行节点间的水平间距
  const ROW_PITCH = 140; // 行中心距（hints 模式）

  // 1. 先给每个节点算出"真实尺寸"（对齐后的，含长名加宽）
  const nodeInfo = spec.nodes.map(n => {
    const shape = shapeMap.get(n.id);
    const stencilId = STENCIL_MAP[n.type];
    const size = getNodeSize(stencilId, n.name);
    const cx = shape.x + shape.width / 2;
    const cy = shape.y + shape.height / 2;
    return { id: n.id, type: n.type, name: n.name, size, layoutCx: cx, layoutCy: cy };
  });

  const startNode = spec.nodes.find(n => n.type === 'startEvent');
  const startCy = startNode
    ? shapeMap.get(startNode.id).y + shapeMap.get(startNode.id).height / 2
    : null;

  // ---- 路径 A：Visio 布局提示模式 ----
  // 行归属/行内顺序来自用户 Visio 原图（跨行 x 对齐按 Visio 比例缩放还原）
  if (spec.layoutHints && spec.layoutHints.nodeRow) {
    const hints = spec.layoutHints;
    const byRow = new Map();
    for (const info of nodeInfo) {
      const r = hints.nodeRow[info.id] ?? 0;
      if (!byRow.has(r)) byRow.set(r, []);
      byRow.get(r).push(info);
    }
    const rowIdxs = [...byRow.keys()].sort((a, b) => a - b);
    const mainIdx = rowIdxs.find(r => byRow.get(r).some(x => x.type === 'startEvent')) ?? 0;

    // 全局 x 比例尺：用主行 Visio 跨度对齐紧凑排布宽度，保持跨行相对位置
    const mainRowNodes = byRow.get(mainIdx).slice()
      .sort((a, b) => hints.nodeXRank[a.id] - hints.nodeXRank[b.id]);
    const visioXById = new Map(); // nodeId → Visio pinX
    if (hints.nodeVisioX) for (const [id, vx] of Object.entries(hints.nodeVisioX)) visioXById.set(id, vx);
    const mainPackedWidth = (() => {
      let w = 0;
      mainRowNodes.forEach((info, i) => { w += info.size.width + (i ? GAP : 0); });
      return w;
    })();
    const mainVisioSpan = (() => {
      const xs = mainRowNodes.map(info => visioXById.get(info.id)).filter(v => v !== undefined);
      if (xs.length < 2) return 0;
      return Math.max(...xs) - Math.min(...xs);
    })();
    const scaleX = mainVisioSpan > 0 ? mainPackedWidth / mainVisioSpan : 0;
    const mainVisioMinX = mainVisioSpan > 0
      ? Math.min(...mainRowNodes.map(info => visioXById.get(info.id)).filter(v => v !== undefined))
      : 0;

    for (const r of rowIdxs) {
      const row = byRow.get(r).slice().sort((a, b) => (hints.nodeXRank[a.id] ?? 0) - (hints.nodeXRank[b.id] ?? 0));
      const rowCy = startCy !== null ? startCy + (r - mainIdx) * ROW_PITCH : row[0].layoutCy;

      // 行内 x：Visio x 缩放定位；可用 Visio x 缺失时退回紧凑排
      const canScale = scaleX > 0 && row.every(info => visioXById.get(info.id) !== undefined);
      const placed = [];
      if (canScale) {
        for (const info of row) {
          placed.push({ info, x: (visioXById.get(info.id) - mainVisioMinX) * scaleX });
        }
        // 防重叠：从左到右，遇间距不足右推
        placed.sort((a, b) => a.x - b.x);
        for (let i = 1; i < placed.length; i++) {
          const prev = placed[i - 1];
          const cur = placed[i];
          const minX = prev.x + prev.info.size.width + GAP;
          if (cur.x < minX) cur.x = minX;
        }
      } else {
        let cursorX = row[0].layoutCx - row[0].size.width / 2;
        for (const info of row) {
          placed.push({ info, x: cursorX });
          cursorX += info.size.width + GAP;
        }
      }
      for (const { info, x } of placed) {
        shapeMap.set(info.id, {
          x,
          y: rowCy - info.size.height / 2,
          width: info.size.width,
          height: info.size.height,
        });
      }
    }
    return;
  }

  // ---- 路径 B：布局聚类模式（默认） ----
  // 2. 按 layout 的中心 y 聚类成行（y 差异 < 40 视为同行）
  const rowThreshold = 40;
  const rows = []; // 每行是 nodeInfo 的数组
  for (const info of [...nodeInfo].sort((a, b) => a.layoutCy - b.layoutCy)) {
    const lastRow = rows[rows.length - 1];
    if (lastRow && Math.abs(lastRow[0].layoutCy - info.layoutCy) < rowThreshold) {
      lastRow.push(info);
    } else {
      rows.push([info]);
    }
  }

  // 3. 每行重新排列：按 layoutCx 排序，紧凑排，y 对齐
  for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx].sort((a, b) => a.layoutCx - b.layoutCx);

    // 确定这一行的基准中心 y
    let rowCy;
    const hasStart = row.some(r => r.type === 'startEvent');
    if (hasStart && startCy !== null) {
      rowCy = startCy; // 主行对齐到 StartEvent
    } else {
      // 其他行：用该行最大高度算一个合理的中心 y（基于 layoutCy 偏移）
      // 简化：保留原 layoutCy 的相对关系，主行 cy 对齐后，其他行按原偏移
      const mainRow = rows.find(r => r.some(x => x.type === 'startEvent'));
      if (mainRow && startCy !== null) {
        rowCy = startCy + (row[0].layoutCy - mainRow[0].layoutCy);
      } else {
        rowCy = row[0].layoutCy;
      }
    }

    // 紧凑排列 x：从第一个节点的 layoutCx 开始，依次排
    let cursorX = row[0].layoutCx - row[0].size.width / 2;
    for (const info of row) {
      const newX = cursorX;
      const newY = rowCy - info.size.height / 2; // 中心 y 对齐 rowCy
      // 更新 shapeMap（坐标 + 真实尺寸）
      shapeMap.set(info.id, {
        x: newX,
        y: newY,
        width: info.size.width,
        height: info.size.height,
      });
      cursorX = newX + info.size.width + GAP;
    }
  }
}

/**
 * 判断这条边是否需要绕行（U/Z 形，2 个转折点）
 * 与 computeOrthogonalWaypoints 的绕行条件保持一致，用于提前分配错开的 detourY
 *
 * 绕行场景（绕到主行上方）：
 *   1. 同行回退（dx<=0）：目标在源的左边，必须绕弯
 *   2. 同行远距离（dx>=LONG_SPAN）：主行直线会穿过中间的同行节点，必须绕行
 *   （跨行远距离回上 用 L 形单转折，不算绕行）
 */
function isDetourEdge(srcCx, srcCy, tgtCx, tgtCy, srcShape, tgtShape, hasBlockingNode = false) {
  const dy = tgtCy - srcCy;
  const dx = tgtCx - srcCx;
  const sameRowThreshold = Math.min(srcShape.height, tgtShape.height) * 0.6;
  const sameRow = Math.abs(dy) < sameRowThreshold;
  const LONG_SPAN = 300;
  // 同行回退 或 同行远距离 → U 形绕行
  if (sameRow && (dx <= 0 || dx >= LONG_SPAN || hasBlockingNode)) return true;
  return false;
}

/**
 * 检查同行中心线是否穿过非端点节点。
 *
 * 固定 LONG_SPAN 只能近似判断长边；当节点较窄或间距较小时，跨度不足 300px
 * 的跳过边仍可能横穿中间节点。Oryx 的最终坐标已经在 shapeMap 中，因此直接按
 * 实际矩形相交判断更可靠。
 */
function crossesIntermediateNodeHorizontally(srcCx, srcCy, tgtCx, tgtCy, shapeMap, sourceId, targetId) {
  const left = Math.min(srcCx, tgtCx);
  const right = Math.max(srcCx, tgtCx);
  for (const [nodeId, shape] of shapeMap.entries()) {
    if (nodeId === sourceId || nodeId === targetId) continue;
    const lineInsideNodeY = srcCy > shape.y && srcCy < shape.y + shape.height;
    const overlapsNodeX = Math.max(left, shape.x) < Math.min(right, shape.x + shape.width);
    if (lineInsideNodeY && overlapsNodeX) return true;
  }
  return false;
}

/**
 * 折线（绝对坐标点列）与节点矩形相交计数（非端点节点）。
 * 与验收脚本同口径：线段进入节点矩形内部超过 1px 才算穿越。
 */
function countNodeCrossings(points, shapeMap, sourceId, targetId) {
  let count = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const x1 = points[i].x, y1 = points[i].y, x2 = points[i + 1].x, y2 = points[i + 1].y;
    const loX = Math.min(x1, x2), hiX = Math.max(x1, x2);
    const loY = Math.min(y1, y2), hiY = Math.max(y1, y2);
    for (const [nodeId, shape] of shapeMap.entries()) {
      if (nodeId === sourceId || nodeId === targetId) continue;
      if (Math.abs(y1 - y2) <= 1) {
        const y = (y1 + y2) / 2;
        if (y > shape.y + 1 && y < shape.y + shape.height - 1 && loX < shape.x + shape.width - 1 && hiX > shape.x + 1) count++;
      } else if (Math.abs(x1 - x2) <= 1) {
        const x = (x1 + x2) / 2;
        if (x > shape.x + 1 && x < shape.x + shape.width - 1 && loY < shape.y + shape.height - 1 && hiY > shape.y + 1) count++;
      }
    }
  }
  return count;
}

/**
 * 候选折线与已路由边的冲突计数（§4.1 口径：共线重合 + 非共同端点交叉）。
 * 两条边在共同节点端点相接不算冲突。
 */
function countEdgeConflicts(points, routedPolylines) {
  const eps = 1;
  const near = (p, q) => Math.abs(p.x - q.x) <= eps && Math.abs(p.y - q.y) <= eps;
  const myEnds = [points[0], points[points.length - 1]];
  let count = 0;
  for (const rp of routedPolylines) {
    const otherEnds = [rp.pts[0], rp.pts[rp.pts.length - 1]];
    for (let i = 0; i < points.length - 1; i++) {
      const A = { x1: points[i].x, y1: points[i].y, x2: points[i + 1].x, y2: points[i + 1].y };
      const aH = Math.abs(A.y1 - A.y2) <= eps;
      for (let j = 0; j < rp.pts.length - 1; j++) {
        const B = { x1: rp.pts[j].x, y1: rp.pts[j].y, x2: rp.pts[j + 1].x, y2: rp.pts[j + 1].y };
        const bH = Math.abs(B.y1 - B.y2) <= eps;
        if (aH && bH) {
          if (Math.abs(A.y1 - B.y1) <= eps) {
            const lo = Math.max(Math.min(A.x1, A.x2), Math.min(B.x1, B.x2));
            const hi = Math.min(Math.max(A.x1, A.x2), Math.max(B.x1, B.x2));
            if (hi - lo > eps) count++;
          }
        } else if (!aH && !bH) {
          if (Math.abs(A.x1 - B.x1) <= eps) {
            const lo = Math.max(Math.min(A.y1, A.y2), Math.min(B.y1, B.y2));
            const hi = Math.min(Math.max(A.y1, A.y2), Math.max(B.y1, B.y2));
            if (hi - lo > eps) count++;
          }
        } else {
          const H = aH ? A : B, V = aH ? B : A;
          const x = V.x1, y = H.y1;
          if (x > Math.min(H.x1, H.x2) + eps && x < Math.max(H.x1, H.x2) - eps &&
              y > Math.min(V.y1, V.y2) + eps && y < Math.max(V.y1, V.y2) - eps) {
            const p = { x, y };
            if (myEnds.some(q => near(q, p)) && otherEnds.some(q => near(q, p))) continue;
            count++;
          }
        }
      }
    }
  }
  return count;
}


/**
 * 根据最终节点、边和标签安全区，自适应画布并把内容整体居中。
 *
 * Oryx 边的首末 docker 是相对节点的偏移，不能平移；只有节点 bounds、
 * 边 bounds 和中间绝对 docker 随内容整体移动。
 */
function fitContentToCanvas(childShapes) {
  const CANVAS_PADDING_X = 60;
  const CANVAS_PADDING_Y = 60;
  const MIN_CANVAS_WIDTH = 480;
  const MIN_CANVAS_HEIGHT = 240;
  const LABEL_SAFE_BOTTOM = 24;

  if (!childShapes.length) {
    return { width: MIN_CANVAS_WIDTH, height: MIN_CANVAS_HEIGHT };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const shape of childShapes) {
    const { upperLeft, lowerRight } = shape.bounds;
    minX = Math.min(minX, upperLeft.x);
    minY = Math.min(minY, upperLeft.y);
    maxX = Math.max(maxX, lowerRight.x);
    maxY = Math.max(maxY, lowerRight.y);

    // 事件和网关的名称通常渲染在节点下方，额外计入标签安全区。
    if (shape.stencil.id !== 'SequenceFlow' &&
        (shape.stencil.id === 'StartEvent' ||
         shape.stencil.id === 'EndEvent' ||
         shape.stencil.id === 'XORGateway' ||
         shape.stencil.id === 'ANDGateway' ||
         shape.stencil.id === 'ORGateway')) {
      const centerX = (upperLeft.x + lowerRight.x) / 2;
      const labelWidth = estimateTextWidth(shape.properties.name || '');
      minX = Math.min(minX, centerX - labelWidth / 2);
      maxX = Math.max(maxX, centerX + labelWidth / 2);
      maxY = Math.max(maxY, lowerRight.y + LABEL_SAFE_BOTTOM);
    }
  }

  // 向外取整，避免居中后出现无意义的小数漂移。
  minX = Math.floor(minX);
  minY = Math.floor(minY);
  maxX = Math.ceil(maxX);
  maxY = Math.ceil(maxY);

  const contentWidth = Math.max(1, maxX - minX);
  const contentHeight = Math.max(1, maxY - minY);
  const canvasWidth = Math.max(MIN_CANVAS_WIDTH, contentWidth + CANVAS_PADDING_X * 2);
  const canvasHeight = Math.max(MIN_CANVAS_HEIGHT, contentHeight + CANVAS_PADDING_Y * 2);

  const leftMargin = Math.floor((canvasWidth - contentWidth) / 2);
  const topMargin = Math.floor((canvasHeight - contentHeight) / 2);
  const shiftX = leftMargin - minX;
  const shiftY = topMargin - minY;

  for (const shape of childShapes) {
    shape.bounds.upperLeft.x += shiftX;
    shape.bounds.upperLeft.y += shiftY;
    shape.bounds.lowerRight.x += shiftX;
    shape.bounds.lowerRight.y += shiftY;

    if (shape.stencil.id === 'SequenceFlow') {
      // 首末 docker 是相对偏移；只平移中间绝对坐标。
      for (let i = 1; i < shape.dockers.length - 1; i++) {
        shape.dockers[i].x += shiftX;
        shape.dockers[i].y += shiftY;
      }
    }
  }

  return {
    width: canvasWidth,
    height: canvasHeight,
    contentWidth,
    contentHeight,
    shiftX,
    shiftY,
  };
}

// 雪花ID风格的19位数字字符串（resourceId 用，Oryx 期望这种格式）
function fakeSnowflakeId() {
  // 41位时间戳(毫级) + 10位随机，截到19位
  const ts = Date.now(); // 13位
  const rand = Math.floor(Math.random() * 1e6).toString().padStart(6, '0');
  return (ts + rand).slice(0, 19);
}

// 生成 sid-UUID 格式的 resourceId
function sid() {
  return 'sid-' + randomUUID().toUpperCase();
}

/**
 * 主转换函数
 * @param {string} layoutedXml - 带坐标的 BPMN XML
 * @param {object} spec - 原始简单 JSON 描述 {name, nodes:[{id,type,name}], edges:[{id,source,target,name,condition}]}
 * @returns {Promise<object>} Oryx defJson 对象
 */
export async function bpmnToOryx(layoutedXml, spec) {
  const moddle = new BpmnModdle();
  const { rootElement } = await moddle.fromXML(layoutedXml);

  const proc = rootElement.rootElements.find(e => e.$type === 'bpmn:Process');
  const plane = rootElement.diagrams[0].plane;
  const planeElements = plane.get('planeElement') || [];

  // === 1. 建立索引：bpmnId → 各种数据 ===

  // BPMN 节点 id → 类型 (从 spec 读，因为 moddle 解析的是 PascalCase)
  const nodeSpecMap = new Map();
  for (const n of spec.nodes) nodeSpecMap.set(n.id, n);

  // BPMN 节点 id → shape 坐标
  const shapeMap = new Map();
  for (const pe of planeElements) {
    if (pe.$type === 'bpmndi:BPMNShape') {
      const bpmnId = pe.bpmnElement?.id;
      const b = pe.bounds;
      shapeMap.set(bpmnId, {
        x: b.x, y: b.y, width: b.width, height: b.height,
      });
    }
  }

  // BPMN 边 id → {source, target, waypoints}
  const edgeMap = new Map();
  for (const pe of planeElements) {
    if (pe.$type === 'bpmndi:BPMNEdge') {
      const bpmnId = pe.bpmnElement?.id;
      edgeMap.set(bpmnId, {
        sourceId: pe.bpmnElement?.sourceRef?.id,
        targetId: pe.bpmnElement?.targetRef?.id,
        waypoints: (pe.waypoint || []).map(w => ({ x: w.x, y: w.y })),
      });
    }
  }

  // 节点 bpmnId → resourceId（Oryx 内部用 sid-UUID，和 bpmnXml 无关）
  const resourceIdMap = new Map();
  for (const n of spec.nodes) resourceIdMap.set(n.id, sid());
  // 边 bpmnId → resourceId：边的 resourceId 必须等于 bpmnXml 里 sequenceFlow 的 id
  // （原版规律：defJson 边 resourceId = bpmnXml sequenceFlow id，系统靠这个关联两者）
  // 所以这里直接用 spec 里的边 id，不再单独生成 UUID
  const edgeResourceIdMap = new Map();
  for (const e of spec.edges) edgeResourceIdMap.set(e.id, e.id);

  // === 2. 构造节点 childShapes ===
  const childShapes = [];

  // 节点的出边索引（bpmnId → [edge bpmnId]）
  const outgoingByNode = new Map();
  for (const e of spec.edges) {
    if (!outgoingByNode.has(e.source)) outgoingByNode.set(e.source, []);
    outgoingByNode.get(e.source).push(e.id);
  }

  // ---- 坐标重排：解决重叠 + 水平对齐 ----
  // bpmn-auto-layout 的尺寸是 100×80，我们改成真实尺寸（含长名加宽）后会重叠，
  // 所以保留它的"拓扑顺序和分行"，但 x/y 重新计算：
  //   1. 按 layout 的中心 y 聚类成"行"
  //   2. 每行内按 layout 的 x 排序，紧凑排列（保证不重叠，留固定间距）
  //   3. 每行的 y 强制统一：主行对齐到 StartEvent 中心 y（水平对齐）
  relayoutNodes(spec, shapeMap);

  for (const n of spec.nodes) {
    const shape = shapeMap.get(n.id);
    if (!shape) {
      throw new Error(`节点 ${n.id} 在布局结果中找不到坐标`);
    }
    const resourceId = resourceIdMap.get(n.id);
    const stencilId = STENCIL_MAP[n.type];
    if (!stencilId) {
      throw new Error(`节点类型 ${n.type} 没有 Oryx stencil 映射`);
    }

    // 强制用原版标准尺寸（覆盖 bpmn-auto-layout 的默认尺寸），长名字 UserTask 自动加宽
    const size = getNodeSize(stencilId, n.name);

    // properties 按原版字段顺序构造：overrideid → name → 中段特有 → 尾部扩展
    const properties = {
      overrideid: n.id,
      name: unescapeXml(n.name) || '',
    };

    // UserTask 挂 taskListeners（实测原 zip 模板，紧跟 name 之后）
    if (n.type === 'userTask') {
      properties.tasklisteners = TASK_LISTENERS;
    }
    // StartEvent 挂 initiator（实测原 zip 模板，紧跟 name 之后）
    if (n.type === 'startEvent') {
      properties.initiator = 'startUser';
    }

    // 追加该类型的尾部扩展字段（i18nKey/documentation 等，保证字段完整 + 顺序对齐原版）
    const tail = TAIL_PROPS_BY_STENCIL[stencilId];
    if (tail) {
      for (const [k, v] of Object.entries(tail)) {
        properties[k] = v;
      }
    }

    const outgoing = (outgoingByNode.get(n.id) || []).map(eid => ({
      resourceId: edgeResourceIdMap.get(eid),
    }));

    childShapes.push({
      resourceId,
      properties,
      stencil: { id: stencilId },
      childShapes: [],
      outgoing,
      bounds: {
        lowerRight: { x: shape.x + size.width, y: shape.y + size.height },
        upperLeft: { x: shape.x, y: shape.y },
      },
      dockers: [],
    });
    // 同步更新 shapeMap，让后面算 dockers 用对齐后的尺寸
    shapeMap.set(n.id, { x: shape.x, y: shape.y, width: size.width, height: size.height });
  }

  // 建 bpmnId → stencilId 映射（边算 dockers 时要查源/目标类型，用于 0.5 偏移）
  const stencilByBpmnId = new Map();
  for (const n of spec.nodes) stencilByBpmnId.set(n.id, STENCIL_MAP[n.type]);

  // 算两个绕行 y 值：
  //   GLOBAL_DETOUR_TOP_Y：主行上方（所有节点最顶部之上），用于"同行绕行"
  //   GLOBAL_DETOUR_BOTTOM_Y：全局底部（所有节点最底部之下），用于"下行→主行超长边绕行"
  const allTops = [...shapeMap.values()].map(s => s.y);
  const allBottoms = [...shapeMap.values()].map(s => s.y + s.height);
  const MAIN_ROW_TOP = allTops.length ? Math.min(...allTops) : 0;
  const GLOBAL_BOTTOM = allBottoms.length ? Math.max(...allBottoms) : 200;
  const GLOBAL_DETOUR_Y = MAIN_ROW_TOP - 60;        // 上方绕行（同行回退/远距离）
  const GLOBAL_DETOUR_BOTTOM_Y = GLOBAL_BOTTOM + 60; // 下方绕行（下行→主行超长边）

  // === 3. 构造边 childShapes ===
  // 绕行槽池：上方槽自全局顶往下、下方槽自全局底往外，每用一次错开 30px。
  // 槽位动态分配：路由时打分选上/下侧，短跨度先路由占内侧槽，
  // 长跨度后路由自然落外侧槽，其长横线避开后续边的进出竖线。
  let nextTopSlotY = GLOBAL_DETOUR_Y;
  let nextBottomSlotY = GLOBAL_DETOUR_BOTTOM_Y;
  const SLOT_STEP = 30;
  const takeTopSlot = () => { const y = nextTopSlotY; nextTopSlotY -= SLOT_STEP; return y; };
  const takeBottomSlot = () => { const y = nextBottomSlotY; nextBottomSlotY += SLOT_STEP; return y; };

  // ---- 3.1 边分类：同行直线 / 同行绕行 / 跨行 ----
  const classified = [];
  for (const e of spec.edges) {
    const edgeData = edgeMap.get(e.id);
    if (!edgeData) {
      throw new Error(`边 ${e.id} 在布局结果中找不到路径`);
    }
    const sourceShape = shapeMap.get(edgeData.sourceId);
    const targetShape = shapeMap.get(edgeData.targetId);
    if (!sourceShape || !targetShape) {
      throw new Error(`边 ${e.id} 的源/目标节点坐标缺失`);
    }
    const srcCx = sourceShape.x + sourceShape.width / 2;
    const srcCy = sourceShape.y + sourceShape.height / 2;
    const tgtCx = targetShape.x + targetShape.width / 2;
    const tgtCy = targetShape.y + targetShape.height / 2;
    const hasBlockingNode = crossesIntermediateNodeHorizontally(
      srcCx, srcCy, tgtCx, tgtCy,
      shapeMap, edgeData.sourceId, edgeData.targetId
    );
    const needsDetour = isDetourEdge(
      srcCx, srcCy, tgtCx, tgtCy,
      sourceShape, targetShape, hasBlockingNode
    );
    const dy = tgtCy - srcCy;
    const sameRowThreshold = Math.min(sourceShape.height, targetShape.height) * 0.6;
    const sameRow = Math.abs(dy) < sameRowThreshold;
    classified.push({
      e, edgeData, sourceShape, targetShape,
      srcCx, srcCy, tgtCx, tgtCy,
      needsDetour, sameRow, dy,
      span: Math.abs(tgtCx - srcCx),
      dyAbs: Math.abs(dy),
    });
  }

  // ---- 3.2 路由：同行直线 → 同行绕行(跨度升序) → 跨行(|dy| 升序) ----
  // 候选打分：节点穿越(×1000) + 边冲突(×50) + 路径长度(×0.05，避免空旷长绕行压过短冲突)
  const routedPolylines = []; // 已路由边折线（后续候选做边-边冲突复查用）
  const midsByEdgeId = new Map();
  const routingOrder = [
    ...classified.filter(c => c.sameRow && !c.needsDetour),
    ...classified.filter(c => c.needsDetour).sort((a, b) => a.span - b.span),
    ...classified.filter(c => !c.sameRow && !c.needsDetour).sort((a, b) => a.dyAbs - b.dyAbs),
  ];
  const fullPtsOf = c => mids => [{ x: c.srcCx, y: c.srcCy }, ...mids, { x: c.tgtCx, y: c.tgtCy }];
  const polylineLength = pts => {
    let length = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      length += Math.abs(pts[i + 1].x - pts[i].x) + Math.abs(pts[i + 1].y - pts[i].y);
    }
    return length;
  };

  for (const c of routingOrder) {
    const fullPts = fullPtsOf(c);
    const scoreOf = mids => {
      const pts = fullPts(mids);
      return countNodeCrossings(pts, shapeMap, c.edgeData.sourceId, c.edgeData.targetId) * 1000
        + countEdgeConflicts(pts, routedPolylines) * 50
        + polylineLength(pts) * 0.05;
    };
    const uMids = slotY => [{ x: c.srcCx, y: slotY }, { x: c.tgtCx, y: slotY }];
    const pickBest = candidates => {
      const scored = candidates.map(cand => {
        const mids = cand.slot
          ? uMids(cand.slot === 'top' ? nextTopSlotY : nextBottomSlotY)
          : cand.mids;
        return { cand, mids, score: scoreOf(mids) };
      });
      const best = scored.reduce((a, b) => (b.score < a.score ? b : a), scored[0]);
      if (best.cand.slot === 'top') takeTopSlot();
      else if (best.cand.slot === 'bottom') takeBottomSlot();
      return best.mids;
    };

    let midPoints;
    if (c.needsDetour) {
      // 同行回退/远距离/中心线被挡 → U 形绕行，上下侧按冲突与长度打分
      midPoints = pickBest([
        { slot: 'top' },
        { slot: 'bottom' },
      ]);
    } else if (c.sameRow) {
      // 同行正常流向：直线；与已路由边冲突（如同网关双出边直线重叠）时改上下绕行
      midPoints = pickBest([
        { mids: [] },
        { slot: 'top' },
        { slot: 'bottom' },
      ]);
    } else {
      // 跨行：先竖后横 L → 先横后竖 L → 底部 Z → 顶部 Z，取穿越/冲突/长度最优候选
      midPoints = pickBest(c.dy > 0 ? [
        { mids: [{ x: c.srcCx, y: c.tgtCy }] },
        { mids: [{ x: c.tgtCx, y: c.srcCy }] },
        { slot: 'bottom' },
        { slot: 'top' },
      ] : [
        { mids: [{ x: c.tgtCx, y: c.srcCy }] },
        { mids: [{ x: c.srcCx, y: c.tgtCy }] },
        { slot: 'bottom' },
        { slot: 'top' },
      ]);
    }

    midsByEdgeId.set(c.e.id, midPoints);
    routedPolylines.push({ pts: fullPts(midPoints), srcId: c.edgeData.sourceId, tgtId: c.edgeData.targetId });
  }

  // ---- 3.3 按 spec 顺序构造边 childShapes ----
  for (const c of classified) {
    const { e, edgeData, sourceShape, targetShape, srcCx, srcCy, tgtCx, tgtCy } = c;

    // 首尾点 = 节点中心相对偏移；XORGateway(偶数尺寸40) 中心加 0.5 做像素对齐（实测原版规律）
    const srcStencilId = stencilByBpmnId.get(edgeData.sourceId);
    const tgtStencilId = stencilByBpmnId.get(edgeData.targetId);
    const srcOffset = centerOffset(sourceShape, srcStencilId);
    const tgtOffset = centerOffset(targetShape, tgtStencilId);

    const midPoints = midsByEdgeId.get(e.id) || [];
    const dockers = [srcOffset];
    for (const p of midPoints) dockers.push({ x: p.x, y: p.y });
    dockers.push(tgtOffset);

    const targetResourceId = resourceIdMap.get(edgeData.targetId);

    const properties = {
      overrideid: '',
      name: unescapeXml(e.name) || '',
      documentation: '',
      conditionsequenceflow: unescapeXml(e.condition) || '',
      defaultflow: 'false',
    };

    // bounds 用源/目标中心和中间点的范围
    const allPoints = [{ x: srcCx, y: srcCy }, ...midPoints, { x: tgtCx, y: tgtCy }];
    childShapes.push({
      resourceId: edgeResourceIdMap.get(e.id),
      properties,
      stencil: { id: 'SequenceFlow' },
      childShapes: [],
      outgoing: [{ resourceId: targetResourceId }],
      bounds: {
        lowerRight: {
          x: Math.max(...allPoints.map(p => p.x)),
          y: Math.max(...allPoints.map(p => p.y)),
        },
        upperLeft: {
          x: Math.min(...allPoints.map(p => p.x)),
          y: Math.min(...allPoints.map(p => p.y)),
        },
      },
      dockers,
      target: { resourceId: targetResourceId },
    });
  }

  // === 4. 自适应画布：包含节点、边和标签安全区，并把内容整体居中 ===
  const canvas = fitContentToCanvas(childShapes);

  // === 5. 组装顶层 defJson ===
  const defJson = {
    resourceId: fakeSnowflakeId(),
    properties: {
      process_id: proc.id || 'process_1',
      name: spec.name || proc.name || '',
      documentation: '',
      process_author: '',
      process_version: '',
      process_namespace: 'http://www.activiti.org/processdef',
      executionlisteners: EXECUTION_LISTENERS,
    },
    stencil: { id: 'BPMNDiagram' },
    childShapes,
    bounds: {
      lowerRight: { x: canvas.width, y: canvas.height },
      upperLeft: { x: 0, y: 0 },
    },
    stencilset: {
      url: 'stencilsets/bpmn2.0/bpmn2.0.json',
      namespace: 'http://b3mn.org/stencilset/bpmn2.0#',
    },
    ssextensions: [],
  };

  return defJson;
}
