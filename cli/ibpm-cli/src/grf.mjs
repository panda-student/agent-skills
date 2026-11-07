// 全局事件设置（globalRestFuls，PMS 工作流全局回调）——PMS 系统流程必须的配置。
// 定义侧存放在 bpmnXml 的 ext:extProcess 顶层 extPlugins（varDefs 之后 </ext:extProcess> 之前）。
// 形态为 QT04001 v4 实测版（PM02001 同款）：设计器「初始赋值 → 全局事件设置」对话框可正常读取。
// 注入锚点：顶层 extPlugins 是唯一紧邻 </ext:extProcess> 的 ext:extPlugins（节点级的在 ext:userNode 内部，不会误中）。
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';
import { unesc, esc } from './flowxml.mjs';

/** 实测形态的流程级 globalRestFuls 内容（不含 ext:extPlugins 包裹，便于空段/非空段两种注入） */
export const GRF_CONTENT =
  '<globalRestFuls xmlns="http://www.jee-soft.cn/bpm/plugins/execution/globalRestFuls">' +
  '<globalRestFul params="" outPutScript="" parentDefKey="local_" name="PMS工作流全局回调">' +
  '<url>PMS工作流全局回调</url><desc>PMS工作流全局回调</desc><header>IiI=</header><invokeMode>1</invokeMode>' +
  '<callTime>taskCreate,taskComplete,startEvent,endEvent,doEndProcessEvent,backToNode,initiatorWithdraws</callTime>' +
  '<callNodes/></globalRestFul></globalRestFuls>';

export const hasGrf = bpmn => /globalRestFuls/.test(bpmn);

/** 向 bpmnXml 注入 globalRestFuls（幂等：已含则原样返回） */
export function injectGrf(bpmn) {
  if (hasGrf(bpmn)) return bpmn;
  const anchor = '</ext:extPlugins></ext:extProcess>';
  const emptyRe = /<ext:extPlugins>\s*<\/ext:extPlugins><\/ext:extProcess>/;
  if (emptyRe.test(bpmn)) return bpmn.replace(emptyRe, `<ext:extPlugins>${GRF_CONTENT}${anchor}`);
  if (bpmn.includes(anchor)) return bpmn.replace(anchor, GRF_CONTENT + anchor);
  throw new Error('未找到 extProcess 顶层 extPlugins 段，无法注入 globalRestFuls');
}

/** 确保工作区 bpmdefs.flow.xml 含全局事件；只替换 bpmnXml 段不触碰 defJson（对齐实测脚本）。返回 {injected} */
export function ensureGrf(flowDir) {
  const path = join(flowDir, 'bpmdefs.flow.xml');
  if (!existsSync(path)) throw new Error(`缺少 ${path}`);
  const xml = readFileSync(path, 'utf8');
  const m = xml.match(/<bpmnXml>([\s\S]*?)<\/bpmnXml>/);
  if (!m) throw new Error('bpmdefs.flow.xml 缺少 bpmnXml 段');
  const bpmn = unesc(m[1]);
  if (hasGrf(bpmn)) return { injected: false };
  const newBpmn = injectGrf(bpmn);
  writeFileSync(path, xml.replace(m[0], `<bpmnXml>${esc(newBpmn)}</bpmnXml>`), 'utf8');
  return { injected: true };
}

/** zip 兜底（import <zip> 用）：解包检查，缺失则注入重打包，返回（可能的）新 zip 路径；原 zip 不改动 */
export function ensureGrfInZip(zipPath) {
  const tmp = mkdtempSync(join(tmpdir(), 'ibpm-grf-'));
  try {
    execSync(`tar -xf "${zipPath}" -C "${tmp}"`, { stdio: 'pipe' });
    const entries = readdirSync(tmp);
    if (entries.length !== 1) return zipPath;
    const fd = join(tmp, entries[0]);
    if (!existsSync(join(fd, 'bpmdefs.flow.xml'))) return zipPath;
    if (!ensureGrf(fd).injected) return zipPath;
    const out = join(tmp, '_grf.zip');
    execSync(`tar -a -cf "${out}" -C "${tmp}" "${entries[0]}"`, { stdio: 'pipe' });
    return out;
  } catch {
    return zipPath; // 检查失败不阻塞导入，checkout/import 链路另有显式检查
  }
}
