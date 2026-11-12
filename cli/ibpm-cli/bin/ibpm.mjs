#!/usr/bin/env node
// ibpm-cli 入口：命令分发
// 查：whoami/list/show/nodes/vars/export
// 改：checkout → add-node/connect/set-condition/set-assignee/remove-node/var-add/var-remove → verify → import-confirm
// 增：create（复用 create-ibpm-flow 生成器）
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync, spawnSync } from 'node:child_process';
import { tokenStatus, getEnv, ENV_PRESETS } from '../src/config.mjs';
import { login } from '../src/login.mjs';
import { ssoLogin, ssoSetup, hasSsoCredentials } from '../src/ssologin.mjs';
import { ensureAuth, listDefs, defGet, exportZip } from '../src/api.mjs';
import { unzipToTemp, parseFlowXml, renderShow, parseDefJsonModel, assignsFromUserMap, nodeDisposeFromUserMap } from '../src/show.mjs';
import { readFlow, writeFlow } from '../src/flowxml.mjs';
import { renderNodes, addNode, addEdge, removeEdge, setCondition, setAssignee, removeNode, varAdd, varRemove } from '../src/surgery.mjs';
import { getDefContext, resolveDef, getNodeSet, getVarsList, listVersions } from '../src/defcontext.mjs';
import { checkout, loadWorkspace, flowDirOf, discard, pack } from '../src/workspace.mjs';
import { ensureGrf, ensureGrfInZip } from '../src/grf.mjs';
import { approvalQuery, approvalSave, contract, opinions, readNodeStates } from '../src/approval.mjs';
import { extractFormValue, extractGlobalRestfuls, buildFormObj, buildDefSetting, nodeProps, saveDefConf, stashDefConfFromZip, loadDefConfStash } from '../src/defconf.mjs';
import { readProcNotify, saveProcNotify, renderProcNotify, carryOverProcNotify, stashProcNotify, loadProcNotifyStash } from '../src/procnotify.mjs';
import { setNodeProps, parsePropAssignments } from '../src/nodeprops.mjs';
import { hotApply } from '../src/hot.mjs';
import { applyFlowProps, FLOW_PROP_META } from '../src/flowprops.mjs';
import { applySignConfig } from '../src/signconfig.mjs';
import { applyButton } from '../src/buttons.mjs';
import { setAssigneeDirect, setConditionDirect, varAddDirect, varRemoveDirect, setButtonDirect, setSignConfigDirect, setFlowPropsDirect } from '../src/direct.mjs';
import { cfgGet, cfgSet, CFG_TYPES, isCfgType } from '../src/cfg.mjs';

// Windows 下优先使用系统 bsdtar：Git Bash 的 GNU tar 会把 "C:" 当作远程主机
if (process.platform === 'win32') {
  process.env.PATH = 'C:\\Windows\\System32;' + process.env.PATH;
}

const args = process.argv.slice(2);
const cmd = args[0];
const GEN_PIPELINE = process.env.IBPM_GEN_PIPELINE
  || fileURLToPath(new URL('../bpmn-gen/pipeline.mjs', import.meta.url));

const getFlag = (name, short) => {
  const i = args.indexOf(name) >= 0 ? args.indexOf(name) : short ? args.indexOf(short) : -1;
  return i >= 0 ? args[i + 1] : undefined;
};
const hasFlag = name => args.includes(name);
const getFlags = name => {
  const out = [];
  for (let i = 0; i < args.length; i++) if (args[i] === name && args[i + 1] !== undefined) out.push(args[i + 1]);
  return out;
};
const argEnv = () => getFlag('--env', '-e') || 'uat';
const positional = i => args[i] && !args[i].startsWith('-') ? args[i] : undefined;
const versionOpt = () => getFlag('--version');
const defIdOpt = () => getFlag('--defId') || getFlag('--def-id');
const nodeArg = () => getFlag('--node') || getFlag('--nodes');
const nodesListArg = () => getFlag('--nodes') || getFlag('--node');
const logicCalArg = () => getFlag('--logicCal') || getFlag('--logic-cal');

function usage() {
  console.log(`ibpm-cli — 宏天 IBPM 流程定义命令行

查（全部在线接口，内存解析，不下载文件）:
  ibpm login [-e uat] [--manual]   登录并保存 token（已配凭据时全自动 SSO 直连；--manual 强制浏览器手动流程）
  ibpm sso-setup [-e uat]          验证 vault 中的 IBPM 凭据并登录（密码不再弹窗/落盘，操作见 vault-ops 技能）
  ibpm whoami [-e uat]             token 状态
  ibpm list [关键词] [-e uat]       流程列表
  ibpm versions <defKey>            历史版本列表（v/主版本/状态/defId）
  ibpm show <defKey> [--version n | --defId id] [-e uat]
                                   流程画像（defJson + nodeUserMap，内存渲染；支持历史版本）
  ibpm nodes <defKey> [--version n | --defId id] [-e uat]
                                   属性标签视图（getDefSetting.nodeUserMap，内存渲染；支持历史版本）
  ibpm vars <defKey> [--version n | --defId id] [-e uat]
                                   变量管理视图（在线 bpmnXml → varDefs；支持历史版本）
  ibpm export <defKey> [--version n | --defId id] [-o 文件]
                                   导出流程 zip（唯一需要落文件的查询）
  ibpm approval <defKey> [--version n | --defId id] [--nodes|--node "A,B" --value true] [--setting-template 文件]
                                   允许接口审批三态；查询支持历史版本，写配置仅限主版本（只改该字段，保留其它属性）
                                   --setting-template 仅结构变体兜底；--form-value/--mobile-form-value 已废弃
  ibpm contract <defKey> [--version n | --defId id]
                                   在线注册变量契约（varKey 以后端 buildFlowVars 为准）
  ibpm opinions <instId>            运行时实际审批链
  ibpm cc <defKey> [--set 规则.json | --carry-from <源defKey>]   办结抄送规则查/写/跨版本承接

改（热改：默认直写线上，无需工作区，不升版本）:
  ibpm set-node-props <defKey> --node|--nodes "A,B" --prop k=v [--prop k2=v2] [--create-propers]
  ibpm set-flow-props <defKey> --prop k=v [--prop k2=v2] [--workspace]
                                   流程级「其它设置」；可用字段: ${Object.keys(FLOW_PROP_META).join(',')}
  ibpm set-assignee <key> --flow <defKey> --spec 张磊/00133543 | --var varName | --hrScript S1 | --orgReport 组织名,编码 [--logicCal|--logic-cal and] [--description 显示描述] [--workspace]
  ibpm set-condition <from> <to> --flow <defKey> [--expr 条件] [--name 名称] [--workspace]
                                   注：连线名称变更仅支持 --workspace + import（hot 不支持名称）
  ibpm set-button <节点key> --flow <defKey> --alias 别名 [--name 名称] [--button-type system|custom] [--lock true] [--reject-mode "..."] [--remove] [--workspace]
  ibpm set-sign-config <节点key> --flow <defKey> --prop decideType|voteType|voteAmount|followMode=... [--workspace]
  ibpm var-add <key> --flow <defKey> [--name 名称] [--type string] [--workspace]
  ibpm var-remove <key> --flow <defKey> [--workspace]
  ibpm cfg-get <type> <defKey> [--node|--nodes <nodeId>] [--version n | --defId id] [-o 文件]
                                   读取配置 JSON（类型: ${Object.keys(CFG_TYPES).join(',')}；支持历史版本）
                                   只读类型: nodeProps,buttons,assignees,signConfig,conditions,flowProps
  ibpm cfg-set <type> <defKey> [--node|--nodes <nodeId>] --file 配置.json
                                   热写独立插件配置（按 defId 直写，不升版本；写后回读复核）
  支持 --workspace 的命令: set-flow-props / set-assignee / set-condition / set-button / set-sign-config / var-add / var-remove
  规则: 单点改配置用 set-*；批量/需要 diff 用 checkout + hot；拓扑变更用 checkout + verify + import

拓扑修改（必须工作区 → verify → import，升版本）:
  ibpm checkout <defKey> [-e uat]  导出流程到编辑工作区
  ibpm add-node <key> --name 名称 --after 参照节点 [--branch] [--sign] [--spec ... | --var ... | --hrScript ... | --orgReport ...]
  ibpm connect <from> <to> [--name 名称] [--cond 条件表达式]
  ibpm remove-edge <from> <to>
  ibpm remove-node <key> --reconnect
  ibpm verify <defKey> [-e uat]    校验工作区（布局/ID 关联/审批人）
  ibpm hot <defKey> [-e uat] [--keep-workspace]
                                   热发布工作区的非拓扑差异（流程设置/按钮/会签/属性/审批人/条件/变量；拓扑变化拒绝）
                                   默认成功后丢弃工作区（不再重新下载 zip）；--keep-workspace 保留
  ibpm import <defKey|zip> [-e uat]  推送新版本（两段式确认）
  ibpm discard <defKey> [-e uat]   丢弃工作区

增:
  ibpm create spec.json [-e uat]   由 spec 生成新流程包（生成后用 ibpm import 推送）
`);
}

/** 指定了 --version/--defId 或对象本身就是旧版时，先提示版本，避免看错 */
function printSelectedVersion(version, defId, isMain) {
  if (!versionOpt() && !defIdOpt() && isMain !== false) return;
  console.log(`版本: v${version}（defId ${defId}${isMain === false ? '，非主版本' : ''}）`);
}

/** 直写后提醒：旧工作区基线已过期，避免后续 hot 使用旧数据 */
function warnStaleWorkspace(defKey, envName) {
  if (loadWorkspace(defKey, envName)) {
    console.log(`  ⚠ 检测到 ${defKey} 工作区；直写已改变线上，建议 ibpm discard ${defKey} 或重新 checkout 后再用 hot`);
  }
}

// ---- 编辑公共：加载工作区三份数据 ----
function loadEditable(defKey, envName) {
  const ws = loadWorkspace(defKey, envName) || (() => { console.error(`✗ 无 ${defKey} 工作区，先 ibpm checkout ${defKey}`); process.exit(1); })();
  const fdir = flowDirOf(ws);
  const flow = readFlow(join(fdir, 'bpmdefs.flow.xml'));
  const nd = JSON.parse(readFileSync(join(fdir, 'nodeDispose.json'), 'utf8'));
  return { ws, fdir, flow, nd, save() {
    writeFlow(flow);
    writeFileSync(join(fdir, 'nodeDispose.json'), JSON.stringify(nd), 'utf8');
  } };
}


/** import 两段式期间快照旧主版本办结抄送规则，供 import-confirm 承接（zip 导入时从包内 defJson 解析 defKey） */
async function stashProcNotifyForImport(env, target, ws, cacheFileId) {
  let tempDir = '';
  try {
    let defKey = ws ? target : '';
    if (!defKey) {
      const unzipped = unzipToTemp(target);
      tempDir = unzipped.temp;
      defKey = parseFlowXml(join(unzipped.dir, 'bpmdefs.flow.xml')).meta.defKey;
    }
    if (!defKey) return;
    const mainDef = await resolveDef(env, defKey);
    const rules = await readProcNotify(env, mainDef.defId);
    if (!rules.length) return;
    stashProcNotify(cacheFileId, { defKey, fromDefId: mainDef.defId, rules });
    console.log('  ✓ 已快照旧主版本办结抄送规则，import-confirm 后自动承接');
  } catch (e) {
    console.log(`  ⚠ 办结抄送快照失败（不阻断导入）: ${e.message}`);
  } finally {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  }
}

/** import-confirm 后自动恢复 defConf：平台导入不回填全局事件/移动端表单（bpmnXml 顶层执行插件与表单段被忽略），
 *  节点接口审批 propers 同样丢失。恢复源：导入包快照优先，旧主版本 bpmnXml 兜底。 */
async function restoreDefConfForImport(env, stash, cacheFileId) {
  if (!stash?.defKey) return;
  try {
    const pkg = cacheFileId ? loadDefConfStash(cacheFileId) : null;
    let oldXml = '';
    if (stash.fromDefId) {
      try { oldXml = (await defGet(env, stash.fromDefId)).bpmDefData.bpmnXml; } catch { /* 旧版本不可读则只按包恢复 */ }
    }
    const states = oldXml ? readNodeStates({ bpmDefData: { bpmnXml: oldXml } }) : {};
    const nodePropertieMap = Object.fromEntries(
      Object.entries(states).filter(([, v]) => v === 'false').map(([n]) => [n, nodeProps(n, false)])
    );
    const setting = buildDefSetting({
      globalForm: buildFormObj('pc', pkg?.globalForm || extractFormValue(oldXml, 'globalForm').value),
      globalMobileForm: buildFormObj('mobile', pkg?.globalMobileForm || extractFormValue(oldXml, 'globalMobileForm').value),
      globalRestfuls: pkg?.globalRestfuls?.length ? pkg.globalRestfuls : extractGlobalRestfuls(oldXml),
      nodePropertieMap,
    });
    const newMain = await resolveDef(env, stash.defKey);
    await saveDefConf(env, newMain.defId, setting);
    console.log(`  ✓ defConf 自动恢复: 全局事件×${setting.globalRestfuls.length} / 移动表单${setting.globalMobileForm.formValue ? '✓' : '无'} / 接口审批false×${Object.keys(nodePropertieMap).length}`);
  } catch (e) {
    console.log(`  ⚠ defConf 自动恢复失败（可手动 ibpm approval 重设）: ${e.message}`);
  }
}

async function main() {
  // --version / --defId 是查询维度；写命令只允许主版本，避免误写历史版本
  const queryCmds = new Set(['show', 'nodes', 'vars', 'approval', 'contract', 'cfg-get', 'export']);
  if ((versionOpt() !== undefined || defIdOpt() !== undefined) && !queryCmds.has(cmd)) {
    console.error('✗ --version / --defId 仅用于查询；写配置请针对主版本');
    process.exit(1);
  }

  switch (cmd) {
    case undefined: case 'help': case '--help': usage(); return;

    case 'login': {
      const envName = argEnv();
      if (!hasFlag('--manual') && hasSsoCredentials(envName)) {
        try {
          const { jwt } = await ssoLogin(envName);
          const exp = new Date(jwt.exp * 1000).toLocaleString('zh-CN');
          console.log(`\n✓ 全自动登录成功（SSO 直连）：用户 ${jwt.sub || '?'}，token 有效期至 ${exp}`);
          console.log('  已写入 ~/.auth-center/apps/ibpm-cli/config.json');
          return;
        } catch (err) {
          console.log(`✗ 全自动登录失败：${err.message}`);
          console.log('  回退浏览器手动流程...\n');
        }
      } else if (!hasFlag('--manual')) {
        console.log('ℹ 未配置 SSO 凭据：请在 vault 中维护 IBPM 凭据（操作见 vault-ops 技能），再执行 `ibpm sso-setup` 验证，登录即全自动。');
        console.log('  本次走浏览器手动流程。\n');
      }
      await login(envName, { port: Number(getFlag('--port')) || 0 });
      return;
    }
    case 'sso-setup': await ssoSetup(argEnv()); return;
    case 'whoami': {
      const envName = argEnv();
      const st = tokenStatus(envName);
      if (st.state === 'missing') { console.log(`环境 ${envName}: 未登录（ibpm login）`); return; }
      if (st.state === 'invalid') { console.log(`环境 ${envName}: token 非法，请重新 login`); return; }
      const fmt = st.remain > 86400 ? `${Math.floor(st.remain / 86400)} 天` : st.remain > 3600 ? `${Math.floor(st.remain / 3600)} 小时` : `${Math.floor(st.remain / 60)} 分钟`;
      console.log(`环境 ${envName}: ${st.state === 'expired' ? '✗ 已过期' : '✓ 有效'}（用户 ${st.jwt?.sub || '?'}，剩余 ${fmt}）`);
      return;
    }

    case 'list': {
      const env = ensureAuth(argEnv());
      const rows = await listDefs(env, positional(1) || '');
      if (!rows.length) { console.log('（无匹配流程）'); return; }
      console.log('defKey          v  状态     名称                        defId');
      for (const r of rows) console.log(`${(r.defKey || '').padEnd(15)} ${(String(r.version) || '').padEnd(2)} ${(r.status || '').padEnd(8)} ${(r.name || '').padEnd(26)} ${r.defId}${r.isMain === 'N' ? ' (旧版)' : ''}`);
      console.log(`\n共 ${rows.length} 条`);
      return;
    }

    case 'versions': {
      const env = ensureAuth(argEnv());
      const defKey = positional(1) || (() => { console.error('用法: ibpm versions <defKey>'); process.exit(1); })();
      const row = await resolveDef(env, defKey);
      const versions = await listVersions(env, row.defId);
      console.log('v   主版本 状态      更新时间              defId');
      for (const v of versions) {
        console.log(`${String(v.version).padEnd(3)} ${(v.isMain === 'Y' ? '是' : '否').padEnd(5)} ${(v.status || '').padEnd(8)} ${(v.updateTime || '').padEnd(20)} ${v.defId}`);
      }
      console.log(`\n共 ${versions.length} 个版本`);
      return;
    }

    case 'show':
    case 'nodes': {
      const envName = argEnv();
      const defKey = positional(1) || (() => { console.error('用法: ibpm show <defKey>'); process.exit(1); })();
      const env = ensureAuth(envName);
      // nodes 只需要 getDefSetting（nodeUserMap/nodes），连 defGet 都不拉
      if (cmd === 'nodes') {
        const row = await resolveDef(env, defKey, { version: versionOpt(), defId: defIdOpt() });
        const ns = (await getNodeSet(env, row.defId))?.nodeSetData || {};
        const nd = nodeDisposeFromUserMap(ns.nodeUserMap || {}, ns.nodes || [], defKey);
        printSelectedVersion(row.version, row.defId, row.isMain !== 'N');
        console.log(renderNodes({ meta: { defKey } }, nd));
        return;
      }
      // show：defGet 自带 defJson + getDefSetting 的审批人摘要，全程内存渲染
      const ctx = await getDefContext(env, defKey, { nodeSet: true, version: versionOpt(), defId: defIdOpt() });
      const ns = ctx.nodeSet?.nodeSetData || {};
      printSelectedVersion(ctx.version, ctx.defId, ctx.isMain);
      const meta = {
        defKey: ctx.live.defKey || ctx.defKey,
        name: ctx.live.name || ctx.row.name || '',
        version: ctx.live.version ?? ctx.version,
      };
      const { nodes, edges } = parseDefJsonModel(ctx.defJson, meta);
      const assigns = assignsFromUserMap(ns.nodeUserMap || {}, ns.nodes || nodes);
      console.log(renderShow(meta, nodes, edges, assigns));
      return;
    }

    case 'vars': {
      const envName = argEnv();
      const defKey = positional(1) || (() => { console.error('用法: ibpm vars <defKey>'); process.exit(1); })();
      const env = ensureAuth(envName);
      const ctx = await getDefContext(env, defKey, { version: versionOpt(), defId: defIdOpt() });
      printSelectedVersion(ctx.version, ctx.defId, ctx.isMain);
      console.log('变量key               类型     变量名');
      for (const v of ctx.varsXml) console.log(`${v.key.padEnd(22)} ${v.type.padEnd(8)} ${v.name}`);
      console.log(`\n共 ${ctx.varsXml.length} 个`);
      return;
    }

    case 'export': {
      const env = ensureAuth(argEnv());
      const defKey = positional(1) || (() => { console.error('用法: ibpm export <defKey> [-o 文件]'); process.exit(1); })();
      const def = await resolveDef(env, defKey, { version: versionOpt(), defId: defIdOpt() });
      const out = getFlag('--output', '-o') || `${defKey}_v${def.version}.zip`;
      const buf = await exportZip(env, def.defId);
      writeFileSync(out, buf);
      console.log(`✓ ${def.name}（${defKey} v${def.version}）→ ${out}（${(buf.length / 1024).toFixed(1)} KB）`);
      return;
    }

    case 'checkout': {
      const env = ensureAuth(argEnv());
      const defKey = positional(1) || (() => { console.error('用法: ibpm checkout <defKey>'); process.exit(1); })();
      const def = await resolveDef(env, defKey);
      const buf = await exportZip(env, def.defId);
      const { flowDir, info } = checkout(env, def, buf);
      const grf = ensureGrf(flowDir); // PMS 流程必须的全局事件（globalRestFuls），导出包缺失时自动补
      console.log(`✓ ${defKey} v${def.version} 已检出到 ${flowDir}`);
      console.log(grf.injected ? '  ✓ 全局事件(PMS全局回调)导出包缺失，已自动注入' : '  ✓ 全局事件(PMS全局回调)已确认');
      console.log(`  编辑命令直接操作工作区，完成后 ibpm verify ${defKey} → ibpm import ${defKey}`);
      return;
    }

    case 'add-node': {
      const envName = argEnv();
      const key = positional(1) || (() => { console.error('用法: ibpm add-node <key> --name 名称 --after 参照节点'); process.exit(1); })();
      const defKey = getFlag('--flow', '-f') || (() => { console.error('缺少 --flow <defKey>（多流程工作区区分）'); process.exit(1); })();
      const ctx = loadEditable(defKey, envName);
      const name = getFlag('--name', '-n') || key;
      const after = getFlag('--after', '-a');
      if (!after) { console.error('缺少 --after <参照节点>'); process.exit(1); }
      const assigneeArgs = { spec: getFlag('--spec'), var: getFlag('--var'), hrScript: getFlag('--hrScript'), orgReport: getFlag('--orgReport'), description: getFlag('--description') };
      const msg = addNode(ctx.flow, ctx.nd, { key, name, after, mode: hasFlag('--branch') ? 'branch' : 'insert', sign: hasFlag('--sign'), assigneeArgs });
      ctx.save();
      console.log('✓', msg);
      return;
    }

    case 'connect': {
      const envName = argEnv();
      const from = positional(1), to = positional(2);
      if (!from || !to) { console.error('用法: ibpm connect <from> <to> [--name] [--cond]'); process.exit(1); }
      const defKey = getFlag('--flow', '-f') || (() => { console.error('缺少 --flow <defKey>'); process.exit(1); })();
      const ctx = loadEditable(defKey, envName);
      const msg = addEdge(ctx.flow, { from, to, name: getFlag('--name') || '', cond: getFlag('--cond') || '' });
      ctx.save();
      console.log('✓', msg);
      return;
    }

    case 'remove-edge': {
      const envName = argEnv();
      const from = positional(1), to = positional(2);
      if (!from || !to) { console.error('用法: ibpm remove-edge <from> <to>'); process.exit(1); }
      const defKey = getFlag('--flow', '-f') || (() => { console.error('缺少 --flow <defKey>'); process.exit(1); })();
      const ctx = loadEditable(defKey, envName);
      const msg = removeEdge(ctx.flow, { from, to });
      ctx.save();
      console.log('✓', msg);
      return;
    }

    case 'set-condition': {
      const envName = argEnv();
      const from = positional(1), to = positional(2);
      if (!from || !to) { console.error('用法: ibpm set-condition <from> <to> --flow <defKey> [--expr] [--name] [--workspace]'); process.exit(1); }
      const defKey = getFlag('--flow', '-f') || (() => { console.error('缺少 --flow <defKey>'); process.exit(1); })();
      if (hasFlag('--workspace')) {
        const ctx = loadEditable(defKey, envName);
        const msg = setCondition(ctx.flow, { from, to, expr: getFlag('--expr'), name: getFlag('--name') });
        ctx.save();
        console.log('✓', msg);
        console.log(`  下一步: ibpm hot ${defKey}（不升版本）`);
        return;
      }
      const env = ensureAuth(envName);
      const row = await resolveDef(env, defKey);
      const conditions = await setConditionDirect(env, row.defId, {
        from, to, expr: getFlag('--expr'), name: getFlag('--name'),
      });
      console.log(`✓ 连线 ${from}→${to} 条件已热更新: ${JSON.stringify(conditions[to] ?? '')}`);
      warnStaleWorkspace(defKey, envName);
      return;
    }

    case 'set-assignee': {
      const envName = argEnv();
      const key = positional(1) || (() => { console.error('用法: ibpm set-assignee <key> --flow <defKey> --spec|--var|--hrScript|--orgReport ... [--workspace]'); process.exit(1); })();
      const defKey = getFlag('--flow', '-f') || (() => { console.error('缺少 --flow <defKey>'); process.exit(1); })();
      const assigneeArgs = { spec: getFlag('--spec'), var: getFlag('--var'), hrScript: getFlag('--hrScript'), orgReport: getFlag('--orgReport'), description: getFlag('--description') };
      if (hasFlag('--workspace')) {
        const ctx = loadEditable(defKey, envName);
        const msg = setAssignee(ctx.flow, ctx.nd, { key, assigneeArgs, logicCal: logicCalArg() });
        ctx.save();
        console.log('✓', msg);
        console.log(`  下一步: ibpm hot ${defKey}（不升版本）`);
        return;
      }
      const env = ensureAuth(envName);
      const row = await resolveDef(env, defKey);
      const r = await setAssigneeDirect(env, row.defId, row.rev ?? 0, {
        key, assigneeArgs, logicCal: logicCalArg(),
      });
      console.log(`✓ 节点 ${key}「${r.nodeName}」审批人已热更新：${r.desc}`);
      warnStaleWorkspace(defKey, envName);
      return;
    }

    case 'remove-node': {
      const envName = argEnv();
      const key = positional(1);
      const defKey = getFlag('--flow', '-f') || (() => { console.error('缺少 --flow <defKey>'); process.exit(1); })();
      const ctx = loadEditable(defKey, envName);
      const msg = removeNode(ctx.flow, ctx.nd, { key, reconnect: hasFlag('--reconnect') });
      ctx.save();
      console.log('✓', msg);
      return;
    }

    case 'var-add': {
      const envName = argEnv();
      const key = positional(1);
      if (!key) { console.error('用法: ibpm var-add <key> --flow <defKey> [--name] [--type] [--workspace]'); process.exit(1); }
      const defKey = getFlag('--flow', '-f') || (() => { console.error('缺少 --flow <defKey>'); process.exit(1); })();
      if (hasFlag('--workspace')) {
        const ctx = loadEditable(defKey, envName);
        const msg = varAdd(ctx.flow, { key, name: getFlag('--name'), type: getFlag('--type') || 'string' });
        ctx.save();
        console.log('✓', msg);
        console.log(`  下一步: ibpm hot ${defKey}（不升版本）`);
        return;
      }
      const env = ensureAuth(envName);
      const row = await resolveDef(env, defKey);
      await varAddDirect(env, row.defId, { key, name: getFlag('--name'), type: getFlag('--type') || 'string' });
      console.log(`✓ 变量 ${key} 已热新增`);
      warnStaleWorkspace(defKey, envName);
      return;
    }

    case 'var-remove': {
      const envName = argEnv();
      const key = positional(1);
      if (!key) { console.error('用法: ibpm var-remove <key> --flow <defKey> [--workspace]'); process.exit(1); }
      const defKey = getFlag('--flow', '-f') || (() => { console.error('缺少 --flow <defKey>'); process.exit(1); })();
      if (hasFlag('--workspace')) {
        const ctx = loadEditable(defKey, envName);
        const msg = varRemove(ctx.flow, { key });
        ctx.save();
        console.log('✓', msg);
        console.log(`  下一步: ibpm hot ${defKey}（不升版本）`);
        return;
      }
      const env = ensureAuth(envName);
      const row = await resolveDef(env, defKey);
      await varRemoveDirect(env, row.defId, { key });
      console.log(`✓ 变量 ${key} 已热删除`);
      warnStaleWorkspace(defKey, envName);
      return;
    }

    case 'set-sign-config': {
      const envName = argEnv();
      const key = positional(1) || (() => { console.error('用法: ibpm set-sign-config <节点key> --flow <defKey> --prop k=v [--workspace]'); process.exit(1); })();
      const defKey = getFlag('--flow', '-f') || (() => { console.error('缺少 --flow <defKey>'); process.exit(1); })();
      const props = parsePropAssignments(getFlags('--prop'));
      if (!Object.keys(props).length) { console.error('至少需要一个 --prop key=value'); process.exit(1); }
      if (hasFlag('--workspace')) {
        const ctx = loadEditable(defKey, envName);
        ctx.flow.bpmn = applySignConfig(ctx.flow.bpmn, key, props);
        ctx.save();
        console.log('✓ 会签配置已写入工作区:', JSON.stringify(props));
        console.log(`  下一步: ibpm hot ${defKey}（不升版本）`);
        return;
      }
      const env = ensureAuth(envName);
      const row = await resolveDef(env, defKey);
      const signRule = await setSignConfigDirect(env, row.defId, key, props);
      console.log(`✓ 会签配置已热更新（${key}）:`, JSON.stringify(signRule));
      warnStaleWorkspace(defKey, envName);
      return;
    }

    case 'set-button': {
      const envName = argEnv();
      const key = positional(1) || (() => { console.error('用法: ibpm set-button <节点key> --flow <defKey> --alias 别名 ... [--workspace]'); process.exit(1); })();
      const defKey = getFlag('--flow', '-f') || (() => { console.error('缺少 --flow <defKey>'); process.exit(1); })();
      const opts = {
        alias: getFlag('--alias'),
        name: getFlag('--name'),
        buttonType: getFlag('--button-type'),
        customAlias: getFlag('--custom-alias'),
        isLock: getFlag('--lock'),
        rejectMode: getFlag('--reject-mode'),
        remove: hasFlag('--remove'),
      };
      if (hasFlag('--workspace')) {
        const ctx = loadEditable(defKey, envName);
        ctx.flow.bpmn = applyButton(ctx.flow.bpmn, key, opts);
        ctx.save();
        console.log(`✓ 节点 ${key} 按钮已写入工作区`);
        console.log(`  下一步: ibpm hot ${defKey}（不升版本）`);
        return;
      }
      const env = ensureAuth(envName);
      const row = await resolveDef(env, defKey);
      const count = await setButtonDirect(env, row.defId, key, opts);
      console.log(`✓ 节点 ${key} 按钮已热更新（当前 ${count} 个）`);
      warnStaleWorkspace(defKey, envName);
      return;
    }

    case 'cfg-get': {
      const envName = argEnv();
      const type = positional(1);
      const defKey = positional(2) || (() => { console.error('用法: ibpm cfg-get <type> <defKey> [--node <nodeId>] [-o 文件]'); process.exit(1); })();
      if (!isCfgType(type)) { console.error(`未知类型 ${type}（可用: ${Object.keys(CFG_TYPES).join(', ')}）`); process.exit(1); }
      const env = ensureAuth(envName);
      const def = await resolveDef(env, defKey, { version: versionOpt(), defId: defIdOpt() });
      const data = await cfgGet(env, def.defId, type, { nodeId: nodeArg() });
      const json = JSON.stringify(data, null, 2);
      const out = getFlag('--out', '-o');
      if (out) { writeFileSync(out, json, 'utf8'); console.log(`✓ ${type} 已写入 ${out}（${json.length} bytes）`); }
      else console.log(json);
      return;
    }

    case 'cfg-set': {
      const envName = argEnv();
      const type = positional(1);
      const defKey = positional(2) || (() => { console.error('用法: ibpm cfg-set <type> <defKey> [--node <nodeId>] --file 配置.json'); process.exit(1); })();
      if (!isCfgType(type)) { console.error(`未知类型 ${type}（可用: ${Object.keys(CFG_TYPES).join(', ')}）`); process.exit(1); }
      const file = getFlag('--file') || (() => { console.error('缺少 --file <json>'); process.exit(1); })();
      if (!existsSync(file)) { console.error(`✗ 文件不存在: ${file}`); process.exit(1); }
      const data = JSON.parse(readFileSync(file, 'utf8'));
      const env = ensureAuth(envName);
      const def = await resolveDef(env, defKey);
      console.log(`流程: ${def.name || defKey} defKey=${def.defKey} 版本=${def.version} defId=${def.defId}`);
      console.log(`配置类型: ${type}${nodeArg() ? `（节点 ${nodeArg()}）` : ''}`);
      const r = await cfgSet(env, def, type, data, { nodeId: nodeArg() });
      console.log(r.ok ? '✅ 热写完成：回读一致，版本未变更' : '⚠️ 热写完成但回读存在差异');
      warnStaleWorkspace(defKey, envName);
      if (!r.ok) process.exitCode = 1;
      return;
    }

    case 'verify': {
      const envName = argEnv();
      const defKey = positional(1) || (() => { console.error('用法: ibpm verify <defKey>'); process.exit(1); })();
      const ws = loadWorkspace(defKey, envName) || (() => { console.error('✗ 无工作区'); process.exit(1); })();
      const fdir = flowDirOf(ws);
      const r = spawnSync('node', [GEN_PIPELINE, '--stages', 'verify-import', fdir], { stdio: 'inherit' });
      process.exit(r.status || 0);
      return;
    }

    case 'hot': {
      const envName = argEnv();
      const defKey = positional(1) || (() => { console.error('用法: ibpm hot <defKey> [--keep-workspace]'); process.exit(1); })();
      const env = ensureAuth(envName);
      const ws = loadWorkspace(defKey, envName) || (() => { console.error('✗ 无工作区，请先 ibpm checkout ' + defKey); process.exit(1); })();
      const def = await resolveDef(env, defKey);
      await hotApply(env, def, ws, { keepWorkspace: hasFlag('--keep-workspace') });
      return;
    }

    case 'import': {
      const envName = argEnv();
      const target = positional(1) || (() => { console.error('用法: ibpm import <defKey|zip>'); process.exit(1); })();
      const env = ensureAuth(envName);
      let zipPath = target;
      const ws = loadWorkspace(target, envName);
      if (ws) {
        ensureGrf(flowDirOf(ws)); // 打包前兜底：工作区缺失全局事件则补
        zipPath = pack(ws);
      } else {
        const grfZip = ensureGrfInZip(zipPath); // 外部 zip 兜底
        if (grfZip !== zipPath) console.log('  ✓ zip 缺全局事件(PMS全局回调)，已注入后导入');
        zipPath = grfZip;
      }
      if (!existsSync(zipPath)) { console.error(`✗ 文件不存在: ${zipPath}`); process.exit(1); }
      const form = new FormData();
      form.append('file', new Blob([readFileSync(zipPath)]), zipPath.split(/[\\/]/).pop());
      const res = await fetch(`${env.baseUrl}${env.bpmModel}/flow/def/v1/importCheck?typeId=${env.typeId}&selectSystemKey=${env.selectSystemKey}`, {
        method: 'POST', headers: { Authorization: `Bearer ${env.token}` }, body: form,
      });
      const check = await res.json();
      if (check.state === false && !check.value) { console.error(`✗ 导入检查失败: ${check.message}`); process.exit(1); }
      if (check.value) {
        await stashProcNotifyForImport(env, target, ws, check.value);
        stashDefConfFromZip(zipPath, check.value);
        console.log(`⚠ ${check.message}`);
        console.log(`  确认导入新版本: ibpm import-confirm ${check.value} -e ${envName}`);
        process.exit(3);
      }
      console.log('✓ 导入完成（新流程）');
      return;
    }

    case 'import-confirm': {
      const envName = argEnv();
      const cacheFileId = positional(1);
      const env = ensureAuth(envName);
      const res = await fetch(`${env.baseUrl}${env.bpmModel}/flow/def/v1/importSave?cacheFileId=${cacheFileId}&confirmImport=true&typeId=${env.typeId}&selectSystemKey=${env.selectSystemKey}`, {
        method: 'POST', headers: { Authorization: `Bearer ${env.token}` },
      });
      const data = await res.json();
      if (data.state) {
        console.log('✓ 导入成功（同 defKey 自动新增版本）');
        const stash = cacheFileId ? loadProcNotifyStash(cacheFileId) : null;
        if (stash?.defKey) {
          const newMain = await resolveDef(env, stash.defKey);
          if (newMain.defId !== stash.fromDefId) {
            console.log('办结抄送承接: ' + await carryOverProcNotify(env, stash.fromDefId, newMain.defId));
          }
          await restoreDefConfForImport(env, stash, cacheFileId);
        }
      } else { console.error(`✗ ${data.message}`); process.exit(1); }
      return;
    }

    case 'approval': {
      const envName = argEnv();
      const defKey = positional(1) || (() => { console.error('用法: ibpm approval <defKey> [--nodes "A,B" --value true]'); process.exit(1); })();
      const env = ensureAuth(envName);
      const version = versionOpt(), defId = defIdOpt();
      const nodesOpt = nodesListArg();
      if (nodesOpt && (version !== undefined || defId !== undefined)) {
        console.error('✗ --version / --defId 仅用于查询；接口审批写配置请针对主版本');
        process.exit(1);
      }
      const ctx = await getDefContext(env, defKey, { version, defId });
      if (!nodesOpt) { await approvalQuery(env, ctx.defId, ctx.live); return; }
      await approvalSave(env, ctx.defId, {
        nodes: nodesOpt, value: getFlag('--value') || 'true',
        formValue: getFlag('--form-value'), mobileFormValue: getFlag('--mobile-form-value'),
        settingTemplate: getFlag('--setting-template'), force: hasFlag('--force'),
      });
      warnStaleWorkspace(defKey, envName);
      return;
    }

    case 'set-node-props': {
      const envName = argEnv();
      const defKey = positional(1) || (() => { console.error('用法: ibpm set-node-props <defKey> --node "A,B" --prop key=value [--create-propers]'); process.exit(1); })();
      const env = ensureAuth(envName);
      const def = await resolveDef(env, defKey);
      const overrides = parsePropAssignments(getFlags('--prop').concat(getFlags('--props').flatMap(s => s.split(',').filter(Boolean))));
      console.log(`流程: ${def.name || defKey} defKey=${def.defKey} 版本=${def.version} defId=${def.defId}`);
      console.log(`目标节点: ${nodeArg() || '(未指定)'}`);
      await setNodeProps(env, def.defId, {
        nodes: nodeArg(),
        overrides,
        createPropers: hasFlag('--create-propers'),
      });
      warnStaleWorkspace(defKey, envName);
      return;
    }

    case 'set-flow-props': {
      const envName = argEnv();
      const defKey = positional(1) || (() => { console.error('用法: ibpm set-flow-props <defKey> --prop key=value [--prop k2=v2] [--workspace]'); process.exit(1); })();
      const assignments = parsePropAssignments(getFlags('--prop'));
      if (!Object.keys(assignments).length) { console.error('至少需要一个 --prop key=value'); process.exit(1); }
      if (hasFlag('--workspace')) {
        const ctx = loadEditable(defKey, envName);
        const r = applyFlowProps(ctx.flow, assignments);
        ctx.flow.bpmn = r.bpmn;
        ctx.flow.xml = r.xml;
        ctx.save();
        console.log('✓ 流程设置已写入工作区:', r.messages.join(', '));
        console.log(`  下一步: ibpm hot ${defKey}（不升版本）`);
        return;
      }
      const env = ensureAuth(envName);
      const row = await resolveDef(env, defKey);
      const r = await setFlowPropsDirect(env, row.defId, row.rev ?? 0, assignments);
      console.log('✓ 流程设置已热更新:', r.keys.join(', '));
      warnStaleWorkspace(defKey, envName);
      return;
    }

    case 'contract': {
      const envName = argEnv();
      const env = ensureAuth(envName);
      const defKey = positional(1) || (() => { console.error('用法: ibpm contract <defKey>'); process.exit(1); })();
      const row = await resolveDef(env, defKey, { version: versionOpt(), defId: defIdOpt() });
      printSelectedVersion(row.version, row.defId, row.isMain !== 'N');
      const list = await getVarsList(env, row.defId);
      await contract(env, row.defId, list);
      return;
    }

    case 'opinions': {
      const env = ensureAuth(argEnv());
      const instId = positional(1) || (() => { console.error('用法: ibpm opinions <instId>'); process.exit(1); })();
      await opinions(env, instId);
      return;
    }

    case 'cc': {
      const envName = argEnv();
      const defKey = positional(1) || (() => { console.error('用法: ibpm cc <defKey> [--set 规则.json | --carry-from <源defKey>]'); process.exit(1); })();
      const env = ensureAuth(envName);
      const def = await resolveDef(env, defKey);
      const setFile = getFlag('--set');
      const carryFrom = getFlag('--carry-from');
      if (setFile) {
        const rules = JSON.parse(readFileSync(setFile, 'utf8'));
        await saveProcNotify(env, def.defId, rules);
        console.log(`✓ 办结抄送规则已保存（${def.name} v${def.version}，defId=${def.defId}）`);
      } else if (carryFrom) {
        const sourceDef = await resolveDef(env, carryFrom);
        console.log('承接结果: ' + await carryOverProcNotify(env, sourceDef.defId, def.defId));
      }
      console.log(`\n流程 ${def.name}（${def.defKey}）v${def.version} 办结抄送规则:`);
      renderProcNotify(await readProcNotify(env, def.defId));
      return;
    }

    case 'discard': {
      const defKey = positional(1);
      discard(defKey, argEnv());
      console.log(`✓ ${defKey} 工作区已丢弃`);
      return;
    }

    case 'create': {
      const envName = argEnv();
      const specFile = positional(1) || (() => { console.error('用法: ibpm create spec.json [-e uat]'); process.exit(1); })();
      const env = ensureAuth(envName);
      const outZip = join(tmpdir(), `ibpm-create-${Date.now()}.zip`);
      // spec 补环境字段后交给技能 pipeline 生成
      const spec = JSON.parse(readFileSync(specFile, 'utf8'));
      Object.assign(spec, { typeId: env.typeId, typeName: env.typeName, sysName: env.selectSystemKey, tenantId: env.selectSystemKey, processKey: spec.processKey });
      const specTmp = join(tmpdir(), `ibpm-spec-${Date.now()}.json`);
      writeFileSync(specTmp, JSON.stringify(spec), 'utf8');
      // stdin 必须是 pipe 才能接收 spec（inherit 会继承终端 stdin 导致 input 失效）
      const r = spawnSync('node', [GEN_PIPELINE, '--stdin', '--stages', 'build,postprocess,verify-zip', '-o', outZip], { stdio: ['pipe', 'inherit', 'inherit'], input: readFileSync(specTmp) });
      if (r.status !== 0) { console.error('✗ 生成失败'); process.exit(1); }
      console.log(`✓ 生成完成: ${outZip}，继续: ibpm import ${outZip} -e ${envName}`);
      return;
    }

    default:
      console.error(`未知命令: ${cmd}`);
      usage();
      process.exit(1);
  }
}

main().catch(e => { console.error('✗', e.message); process.exit(1); });
