// 几何原语：供布局路由与后处理共享

// 矩形内一点向矩形外一点连线的边框交点（DI 首末 waypoint 吸附形状边界用；
// 真实导出包实证 waypoint 首末落在源/目标形状边框上而非中心，否则 IBPM 流程图箭头指进形状内部造成重叠）
export function boundaryExit(from, to, rect) {
  const dx = to.x - from.x, dy = to.y - from.y;
  let t = Infinity;
  if (dx > 0) t = Math.min(t, (rect.x + rect.w - from.x) / dx);
  else if (dx < 0) t = Math.min(t, (rect.x - from.x) / dx);
  if (dy > 0) t = Math.min(t, (rect.y + rect.h - from.y) / dy);
  else if (dy < 0) t = Math.min(t, (rect.y - from.y) / dy);
  if (!isFinite(t)) return { x: from.x, y: from.y };
  return { x: from.x + dx * t, y: from.y + dy * t };
}
