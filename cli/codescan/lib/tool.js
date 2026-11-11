'use strict';

/**
 * 工具适配器契约(所有内置工具和外部工具都实现它)。
 *
 * @typedef {Object} ToolAdapter
 * @property {string} name        唯一名称,也是 --tools 使用的名字
 * @property {string[]} languages 适用语言:java/js/ts/vue,或 ['*'] 表示不限
 * @property {string[]} [dimensions] 产出的维度:reuse/srp/quality/performance/kiss
 * @property {string} [description]
 * @property {(ctx: ToolContext) => Promise<ToolResult>} run
 *
 * @typedef {Object} ToolContext
 * @property {string} targetAbs
 * @property {string} targetKey
 * @property {string|null} repoRoot
 * @property {string} rootDir
 * @property {string|null} packageDir
 * @property {string[]} langs
 * @property {Record<string, string[]>} byLang
 * @property {string[]} allFiles
 * @property {boolean} hasVue
 * @property {any} args
 * @property {Map<string, [number, number][]>|null} diffRanges
 * @property {number} toolTimeout
 *
 * @typedef {Object} Finding
 * @property {string} tool
 * @property {string} rule
 * @property {'reuse'|'srp'|'quality'|'performance'|'kiss'} dimension
 * @property {'high'|'medium'|'low'|'info'} severity
 * @property {string} file
 * @property {number} line
 * @property {string} message
 * @property {boolean} [fileLevel]
 * @property {Object} [evidence]
 *
 * @typedef {Object} ToolResult
 * @property {'ok'|'skipped'|'partial'|'error'} status
 * @property {string} [detail]
 * @property {Finding[]} [findings]
 * @property {Object} [meta]
 */

const STATUSES = new Set(['ok', 'skipped', 'partial', 'error']);
const DIMENSIONS = new Set(['reuse', 'srp', 'quality', 'performance', 'kiss']);
const SEVERITIES = new Set(['high', 'medium', 'low', 'info']);

/** 校验适配器是否满足接口;不满足时给出可定位的错误 */
function assertAdapter(adapter) {
  if (!adapter || typeof adapter !== 'object') {
    throw new Error('工具适配器必须是对象');
  }
  if (!adapter.name || typeof adapter.name !== 'string') {
    throw new Error('工具适配器缺少 name');
  }
  if (!Array.isArray(adapter.languages) || !adapter.languages.length ||
      adapter.languages.some((l) => typeof l !== 'string' || !l)) {
    throw new Error(`工具 ${adapter.name} 的 languages 必须是非空字符串数组`);
  }
  if (typeof adapter.run !== 'function') {
    throw new Error(`工具 ${adapter.name} 缺少 run(ctx) 方法`);
  }
  if (adapter.dimensions !== undefined &&
      (!Array.isArray(adapter.dimensions) || adapter.dimensions.some((d) => !DIMENSIONS.has(d)))) {
    throw new Error(`工具 ${adapter.name} 的 dimensions 含有非法值`);
  }
  return adapter;
}

/** 把适配器返回值收敛到统一契约,坏数据不会让整个扫描崩掉 */
function normalizeResult(raw, name) {
  if (!raw || typeof raw !== 'object') {
    return { status: 'error', detail: `${name} 返回了无效结果(非对象)`, findings: [] };
  }
  let status = raw.status;
  let detail = typeof raw.detail === 'string' ? raw.detail : '';
  if (!STATUSES.has(status)) {
    detail = `${detail}${detail ? '; ' : ''}无效 status: ${status}`;
    status = 'error';
  }
  const findings = Array.isArray(raw.findings)
    ? raw.findings.map((f) => normalizeFinding(f, name)).filter(Boolean)
    : [];
  const out = { status, detail, findings };
  if (raw.meta && typeof raw.meta === 'object') out.meta = raw.meta;
  return out;
}

function normalizeFinding(f, fallbackTool) {
  if (!f || typeof f !== 'object') return null;
  const file = typeof f.file === 'string' ? f.file : '';
  if (!file) return null; // 没有文件位置的 finding 无法进入 diff 过滤/报告
  const out = {
    tool: typeof f.tool === 'string' && f.tool ? f.tool : fallbackTool,
    rule: typeof f.rule === 'string' && f.rule ? f.rule : 'unknown',
    dimension: DIMENSIONS.has(f.dimension) ? f.dimension : 'quality',
    severity: SEVERITIES.has(f.severity) ? f.severity : 'info',
    file,
    line: Number.isFinite(f.line) ? f.line : 0,
    message: typeof f.message === 'string' ? f.message : '',
  };
  if (f.fileLevel) out.fileLevel = true;
  if (f.evidence && typeof f.evidence === 'object') out.evidence = f.evidence;
  return out;
}

module.exports = { assertAdapter, normalizeResult, normalizeFinding, STATUSES, DIMENSIONS, SEVERITIES };