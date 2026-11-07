// defConf 域配置：全局事件(globalRestfuls)/全局表单(PC、移动)/节点 propers 的提取、构造与保存
// 背景：平台导入不回填这些配置（bpmnXml 顶层执行插件与表单段被忽略），saveDefConf 是唯一写入通道；
//       配置保存后会回写嵌入 bpmnXml（平台导出即镜像）。header 走 base64：XML 值 = base64(JSON 原始值)。
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { api } from './api.mjs';
import { unesc } from './flowxml.mjs';

const DEF_CONF_STASH_DIR = join(homedir(), '.ibpm-cli');

// ---- 提取（bpmnXml → defConf JSON）----

/** 全局表单 URL 模板（PC/移动同构；段不存在=空，段存在但抽不到值=结构变体） */
export function extractFormValue(bpmnXml, seg) {
  const m = bpmnXml.match(new RegExp(`<ext:${seg}>[\\s\\S]*?<ext:form[^>]*formValue="([^"]*)"`));
  if (m) return { value: m[1].replace(/&amp;/g, '&'), variant: false };
  if (new RegExp(`<ext:${seg}>[\\s\\S]*?formValue="[^"]+"`).test(bpmnXml)) return { value: '', variant: true };
  return { value: '', variant: false };
}

/** 全局事件列表（XML → JSON；header 解 base64 还原原始值，平台保存时会再编码回去） */
export function extractGlobalRestfuls(bpmnXml) {
  const block = bpmnXml.match(/<globalRestFuls[\s\S]*?<\/globalRestFuls>/);
  if (!block) return [];
  return [...block[0].matchAll(/<globalRestFul\s([^>]*)>([\s\S]*?)<\/globalRestFul>/g)].map(([, attrs, inner]) => {
    const child = tag => (inner.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`)) || [, ''])[1];
    const attr = name => (attrs.match(new RegExp(`${name}="([^"]*)"`)) || [, ''])[1];
    let header = child('header');
    try { header = Buffer.from(header, 'base64').toString('utf8'); } catch { /* 非 base64 原样保留 */ }
    return {
      params: attr('params'), outPutScript: attr('outPutScript'), parentDefKey: attr('parentDefKey'), name: attr('name'),
      url: child('url'), desc: child('desc'), header, invokeMode: child('invokeMode'), callTime: child('callTime'),
    };
  });
}

// ---- 构造（defConf JSON 片段）----

export const buildFormObj = (formType, formValue) => ({
  nodeId: null, parentFlowKey: 'local_', name: '', type: 'FRAME', formValue: formValue || '',
  formType, formExtraConf: '', helpFile: '', printUrl: '', printType: '',
  prevHandler: null, postHandler: null, formEmpty: false, id: '',
});

/** 节点属性全量模板（约50字段，缺字段可能被重置为默认，勿删减） */
export function nodeProps(nodeId, allowInterfaceApproval) {
  return {
    parentDefKey: 'local_', nodeId, jumpType: '', help: '', helpGlobal: '',
    prevHandler: '', postHandler: '', allowExecutorEmpty: false, skipExecutorEmpty: false,
    userSamecantSkip: false, notifyType: 'inner', backMode: 'normal', referOpinion: true,
    backNode: '', backUserMode: 'normal', dateType: 'caltime', dueTime: 0, popWin: true,
    choiceExcutor: '', allowEditUrgentState: false, allowSmsApproval: false,
    allowInterfaceApproval, userNodeType: '',
    approvalArea: 'approvalOpinion,zFile,file,processRecord,imageBpm',
    sponsorRevoke: false, previousRevoke: false, sponsorRevokeNew: 0, previousRevokeNew: 0,
    previousRevokeNodes: '', template: '', phone: '', email: '', sendType: '',
    initFillData: false, signatureField: '', signatureCover: false, secretFree: false,
    opinionField: '', appendOpinion: false, batchHandleRevoke: true,
    preSkipAfterApprovePreview: false, msgConfig: '', printTemplate: '',
    agreeCount: '', disagreeCount: '', executorIsEmpty: 'jump',
    executorUserAccount: '', executorUserName: '', summaryRule: '',
    backToCurNodeVisible: false, needSignTask: false, machineNodeIdentifier: false,
    approvalCommentsDefinition: '',
  };
}

/** 组装全量 defSettingJson（saveDefConf 全量覆盖语义，所有段必须显式兜底，防其它段被清空） */
export function buildDefSetting({ globalForm, globalMobileForm, globalRestfuls, nodePropertieMap }) {
  return {
    functionPanels: [],
    globalForm: globalForm ?? buildFormObj('pc', ''),
    globalMobileForm: globalMobileForm ?? buildFormObj('mobile', ''),
    instForm: { type: 'INNER', formType: 'pc', name: '', formValue: '' },
    instMobileForm: { type: 'INNER', formType: 'mobile', name: '', formValue: '' },
    bpmSubTableRights: [],
    nodePropertieMap: nodePropertieMap ?? {},
    globalRestfuls: globalRestfuls ?? [],
    globalScripts: [], formMap: {}, bpmSubTableRightMap: {}, mobileFormMap: {},
  };
}

// ---- 保存（唯一写通道：approval 命令与 import 恢复共用）----

export async function saveDefConf(env, defId, defSettingJson, restfulJson = '{}') {
  const resp = await api(env, '/flow/node/v1/saveDefConf', {
    method: 'POST',
    body: { defSettingJson: JSON.stringify(defSettingJson), userJson: '{}', userReadJson: '{}', restfulJson, defId, rev: 0, nodeFormKeys: '', userMsgJson: '{}' },
  });
  if (resp.state === false) throw new Error('saveDefConf 保存失败: ' + JSON.stringify(resp).slice(0, 200));
  return resp;
}

// ---- import → import-confirm 跨进程交接快照（机制与 procnotify 相同）----

function stashPath(cacheFileId) {
  return join(DEF_CONF_STASH_DIR, `defconf-stash-${cacheFileId}.json`);
}

export function stashDefConf(cacheFileId, payload) {
  writeFileSync(stashPath(cacheFileId), JSON.stringify(payload), 'utf8');
}

export function loadDefConfStash(cacheFileId) {
  const path = stashPath(cacheFileId);
  if (!existsSync(path)) return null;
  const payload = JSON.parse(readFileSync(path, 'utf8'));
  rmSync(path);
  return payload;
}

/** 导入时从包内 bpmdefs.flow.xml 提取 defConf 要点并落快照（检查失败静默跳过，不阻塞导入） */
export function stashDefConfFromZip(zipPath, cacheFileId) {
  const tmp = mkdtempSync(join(tmpdir(), 'ibpm-defconf-'));
  try {
    execSync(`tar -xf "${zipPath}" -C "${tmp}"`, { stdio: 'pipe' });
    const entries = readdirSync(tmp);
    if (entries.length !== 1) return null;
    const xmlPath = join(tmp, entries[0], 'bpmdefs.flow.xml');
    if (!existsSync(xmlPath)) return null;
    const x = readFileSync(xmlPath, 'utf8');
    const bm = x.match(/<bpmnXml>([\s\S]*?)<\/bpmnXml>/);
    if (!bm) return null;
    const bpmnXml = unesc(bm[1]);
    const payload = {
      globalForm: extractFormValue(bpmnXml, 'globalForm').value,
      globalMobileForm: extractFormValue(bpmnXml, 'globalMobileForm').value,
      globalRestfuls: extractGlobalRestfuls(bpmnXml),
    };
    stashDefConf(cacheFileId, payload);
    return payload;
  } catch {
    return null;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
