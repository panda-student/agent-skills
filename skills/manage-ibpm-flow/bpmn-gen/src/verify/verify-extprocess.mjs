// 校验 bpmdefs.flow.xml 的 extProcess 完整性
// 用法（库）：const { ok, stats } = verifyExtprocess(dir)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * @param {string} dir - zip 解压后的流程目录
 * @returns {{ok: boolean, stats: object}}
 */
export function verifyExtprocess(dir) {
  const raw = readFileSync(join(dir, 'bpmdefs.flow.xml'), 'utf8');
  const dec = raw.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  const bpmnXml = dec.match(/<bpmnXml>([\s\S]*?)<\/bpmnXml>/)?.[1] || '';

  const userNodes = [...bpmnXml.matchAll(/<ext:userNode[^>]*bpmnElement="([^"]+)"/g)].map(m => m[1]);
  const gwNodes = [...bpmnXml.matchAll(/<ext:(?:userNode|baseNode)[^>]*bpmnElement="([^"]+)"/g)].map(m => m[1]).filter(id => id.startsWith('G_'));
  console.log('extProcess userNode:', userNodes.length, ' 网关误入:', gwNodes.length);

  const varDefs = [...bpmnXml.matchAll(/<ext:key>([^<]+)<\/ext:key>/g)].map(m => m[1]);
  console.log(`变量(${varDefs.length}):`, varDefs.join(','));

  console.log('条件边数:', (bpmnXml.match(/conditionExpression/g) || []).length);

  const form = bpmnXml.match(/formValue="([^"]*)"/)?.[1];
  console.log('formValue:', form);
  console.log('globalRestFul:', /<globalRestFul /.test(bpmnXml) ? '存在' : '无');

  // 网关条件分支完备性：每个 XOR 网关出边均有条件（用完整 sequenceFlow 块匹配，跨行安全）
  const flowBlocks = [...bpmnXml.matchAll(/<sequenceFlow id="([^"]+)"[\s\S]*?sourceRef="([^"]+)"[\s\S]*?targetRef="([^"]+)"[\s\S]*?(?:\/>|<\/sequenceFlow>)/g)];
  const gwOut = {};
  for (const f of flowBlocks) {
    if (f[2].startsWith('G_')) (gwOut[f[2]] ||= []).push({ id: f[1], hasCond: f[0].includes('conditionExpression') });
  }
  let badGw = 0;
  for (const [gw, outs] of Object.entries(gwOut)) {
    const noCond = outs.filter(o => !o.hasCond).length;
    if (noCond > 0) { badGw++; console.log(`  ⚠️ 网关 ${gw} 有 ${noCond} 条无条件出边`); }
  }
  console.log('网关分支完备:', badGw === 0 ? '通过（全部出边显式条件）' : `${badGw} 个网关有默认流`);

  const ok = gwNodes.length === 0 && badGw === 0;
  return { ok, stats: { userNodes: userNodes.length, gwNodes: gwNodes.length, vars: varDefs.length, badGw } };
}
