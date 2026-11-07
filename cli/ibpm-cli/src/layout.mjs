// 布局：id 生成 / 锚点 / 正交折线（规则经 QT04001 手术实证）
import { randomUUID } from 'node:crypto';

export const sid = () => 'sid-' + randomUUID().toUpperCase();
export const snowflake = () => (String(Date.now()) + String(Math.floor(Math.random() * 1e6)).padStart(6, '0')).slice(0, 19);

/** DI 形状锚点（box 左上角 + 尺寸）：right/left/bottom/top 中点或顶点 */
export function anchors(b) {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  return {
    R: [b.x + b.w, cy], L: [b.x, cy], T: [cx, b.y], B: [cx, b.y + b.h], C: [cx, cy],
  };
}

/**
 * 正交折线 waypoint（DI 系）：目标在下方→从源 B 顶点垂直下再水平右；否则 R 顶点水平右再垂直。
 * 返回 waypoint 数组 [[x,y],...]。defJson dockers 拐点与 DI waypoint 坐标通用（原「否」边实证）。
 */
export function orthPath(srcB, tgtB) {
  const s = anchors(srcB), t = anchors(tgtB);
  if (tgtB.y >= srcB.y + srcB.h - 10) {
    // 目标在下方：B → 垂直到目标中心线 → 水平到目标左中
    return [s.B, [s.B[0], t.L[1]], t.L];
  }
  if (tgtB.x >= srcB.x + srcB.w) {
    // 目标在右侧：R → 水平到目标中心 x 前的拐点 → 垂直到目标中心线 → 左中
    return [s.R, [s.R[0], t.L[1]]].concat(t.L[0] > s.R[0] ? [t.L] : [[t.L[0], s.R[1]], t.L]);
  }
  // 目标在左/上：R → 水平右出 60px → 垂直 → 水平到目标左中
  const midX = Math.max(s.R[0], t.L[0]) + 60;
  return [s.R, [midX, s.R[1]], [midX, t.L[1]], t.L];
}

/** DI waypoints → defJson dockers（首尾锚相对 defJson shape box，中间点绝对坐标直接共用） */
export function dockersFrom(wps, defSrcBox, defTgtBox) {
  const [p0, ...mid] = wps;
  const pN = wps[wps.length - 1];
  return [
    { x: p0[0] - defSrcBox.x, y: p0[1] - defSrcBox.y },
    ...mid.slice(0, -1).map(p => ({ x: p[0], y: p[1] })),
    { x: pN[0] - defTgtBox.x, y: pN[1] - defTgtBox.y },
  ];
}

/** defJson 边 bounds = 路径包围盒（DI 系与 defJson 系中心对齐，直接用 DI 值） */
export function boundsOf(wps) {
  const xs = wps.map(p => p[0]), ys = wps.map(p => p[1]);
  return {
    upperLeft: { x: Math.min(...xs), y: Math.min(...ys) },
    lowerRight: { x: Math.max(...xs), y: Math.max(...ys) },
  };
}

/** 新 userTask defJson shape（copy 参照节点；dx=水平位移（与 DI 位移一致保证中心对齐），offsetY=垂直位移） */
export function cloneNodeShape(refShape, newKey, newName, newResId, offsetY = 0, dx = null) {
  const s = JSON.parse(JSON.stringify(refShape));
  s.resourceId = newResId;
  s.properties.overrideid = newKey;
  s.properties.name = newName;
  if (dx !== null) {
    s.bounds.upperLeft.x += dx;
    s.bounds.lowerRight.x += dx;
  } else if (offsetY) {
    s.bounds.upperLeft.y += offsetY;
    s.bounds.lowerRight.y += offsetY;
  } else {
    const w = s.bounds.lowerRight.x - s.bounds.upperLeft.x;
    s.bounds.upperLeft.x += w + 60;
    s.bounds.lowerRight.x += w + 60;
  }
  return s;
}
