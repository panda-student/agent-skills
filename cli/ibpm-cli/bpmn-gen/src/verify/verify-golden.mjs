// 用平台人工修正后的 golden 导出包做回归校验：
// 逐节点对比生成的 nodeDispose.json 与 golden nodeDispose.json 的
// cacl（精确字符串，含键序）/ description / pluginType / sources 字段。
// 自动字段（id/pkVal/updateTime/updateBy 等）不参与对比。
//
// 用法（库）：const { ok, pass, fail } = verifyGolden(genPath, goldenPath)

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// 参与对比的字段（其余为自动/元数据字段）
const COMPARE_FIELDS = ['nodeKey', 'nodeName', 'description', 'cacl', 'pluginType', 'sources', 'tenantId', 'actionType', 'actionTypeId'];

function loadData(path) {
  const json = JSON.parse(readFileSync(resolve(path), 'utf8'));
  const data = json?.[0]?.data;
  if (!Array.isArray(data)) throw new Error(`结构不对（期望 [{code, data:[...]}]）: ${path}`);
  return new Map(data.map(d => [d.nodeKey, d]));
}

// 定位两个字符串第一处差异，带上下文输出
function firstDiff(a, b) {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) {
      const from = Math.max(0, i - 40);
      return `  位置 ${i}:\n    生成: ...${a.slice(from, i + 40)}...\n    golden: ...${b.slice(from, i + 40)}...`;
    }
  }
  return '';
}

/**
 * @param {string} genPath - 生成的 nodeDispose.json 路径
 * @param {string} goldenPath - 平台人工修正后的 golden nodeDispose.json 路径
 * @returns {{ok: boolean, pass: number, fail: number}}
 */
export function verifyGolden(genPath, goldenPath) {
  const gen = loadData(genPath);
  const golden = loadData(goldenPath);

  let pass = 0, fail = 0;
  for (const [nodeKey, g] of golden) {
    const mine = gen.get(nodeKey);
    if (!mine) {
      console.log(`❌ ${nodeKey}: 生成结果缺少此节点`);
      fail++;
      continue;
    }
    const errors = [];
    for (const f of COMPARE_FIELDS) {
      const a = String(mine[f] ?? '');
      const b = String(g[f] ?? '');
      if (a !== b) {
        errors.push(`  字段 ${f} 不一致:\n${firstDiff(a, b)}`);
      }
    }
    if (errors.length) {
      console.log(`❌ ${nodeKey} (${g.nodeName}):`);
      errors.forEach(e => console.log(e));
      fail++;
    } else {
      console.log(`✅ ${nodeKey} (${g.nodeName})`);
      pass++;
    }
  }
  // 反向：生成了 golden 没有的节点
  for (const nodeKey of gen.keys()) {
    if (!golden.has(nodeKey)) {
      console.log(`⚠️ ${nodeKey}: golden 中不存在（多生成）`);
    }
  }

  console.log(`\n结果: ${pass} 通过 / ${fail} 失败（共 ${golden.size} 个节点）`);
  return { ok: fail === 0, pass, fail };
}
