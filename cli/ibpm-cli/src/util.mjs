// 通用小工具：等待 / 稳定序列化 / 子集比较
export const sleep = ms => new Promise(r => setTimeout(r, ms));

export const stable = v => {
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
  return JSON.stringify(v);
};

/** 校验 expected 的字段在 actual 中一致；忽略服务端补充的额外字段 */
export function subsetMatches(expected, actual) {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length) return false;
    return expected.every((v, i) => subsetMatches(v, actual[i]));
  }
  if (expected && typeof expected === 'object') {
    if (!actual || typeof actual !== 'object') return false;
    return Object.keys(expected).every(k => subsetMatches(expected[k], actual[k]));
  }
  return expected === actual;
}