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
import { unzipToTemp, parseFlowXml, parseNodeDispose, renderShow } from '../src/show.mjs';
import { readFlow, writeFlow, parseVars } from '../src/flowxml.mjs';
import { renderNodes, addNode, addEdge, setCondition, setAssignee, removeNode, varAdd, varRemove } from '../src/surgery.mjs';
import { checkout, loadWorkspace, flowDirOf, discard, pack } from '../src/workspace.mjs';
import { ensureGrf, ensureGrfInZip } from '../src/grf.mjs';
import { approvalQuery, approvalSave, contract, opinions, readNodeStates } from '../src/approval.mjs';
import { extractFormValue, extractGlobalRestfuls, buildFormObj, buildDefSetting, nodeProps, saveDefConf, stashDefConfFromZip, loadDefConfStash } from '../src/defconf.mjs';
import { readProcNotify, saveProcNotify, renderProcNotify, carryOverProcNotify, stashProcNotify, loadProcNotifyStash } from '../src/procnotify.mjs';

const args = process.argv.slice(2);
const cmd = args[0];
const GEN_PIPELINE = process.env.IBPM_GEN_PIPELINE
  || fileURLToPath(new URL('../bpmn-gen/pipeline.mjs', import.meta.url));

const getFlag = (name, short) => {
  const i = args.indexOf(name) >= 0 ? args.indexOf(name) : short ? args.indexOf(short) : -1;
  return i >= 0 ? args[i + 1] : undefined;
};
const hasFlag = name => args.includes(name);
const argEnv = () => getFlag('--env', '-e') || 'uat';
const positional = i => args[i] && !args[i].startsWith('-') ? args[i] : undefined;

function usage() {
  console.log(`ibpm-cli — 宏天 IBPM 流程定义命令行

查:
  ibpm login [-e uat] [--manual]   登录并保存 token（已配凭据时全自动 SSO 直连；--manual 强制浏览器手动流程）
  ibpm sso-setup [-e uat]          一次性弹窗录入 SSO 凭据（存 ~/.ibpm-cli/sso-credentials.json），启用全自动登录
  ibpm whoami [-e uat]             token 状态
  ibpm list [关键词] [-e uat]       流程列表
  ibpm show <defKey> [-e uat]      流程画像（节点/连线/审批人/条件）
  ibpm nodes <defKey> [-e uat]     属性标签视图（节点审批人表格）
  ibpm vars <defKey> [-e uat]      变量管理视图（变量名/key/类型）
  ibpm export <defKey> [-o 文件]    导出流程 zip
  ibpm approval <defKey> [--nodes "A,B" --value true]   允许接口审批三态查/改（saveDefConf 热生效）
  ibpm contract <defKey>            在线注册变量契约（varKey 以后端 buildFlowVars 为准）
  ibpm opinions <instId>            运行时实际审批链
  ibpm cc <defKey> [--set 规则.json | --carry-from <源defKey>]   办结抄送规则查/写/跨版本承接（按版本存储，import-confirm 自动承接）

改（工作区模式：checkout 后本地编辑，verify 通过后 import 推送新版本）:
  ibpm checkout <defKey> [-e uat]  导出流程到编辑工作区
  ibpm add-node <key> --name 名称 --after 参照节点 [--branch] [--sign] [--spec 张磊/00133543 | --var varName | --hrScript S1 | --orgReport 组织名,编码]
                                   （--sign 直接创建会签节点 SignTask，取人规则落 ext:signNode，避免设计器改类型丢规则）
  ibpm connect <from> <to> [--name 名称] [--cond 条件表达式]
  ibpm set-condition <from> <to> [--expr 条件] [--name 名称]
  ibpm set-assignee <key> --spec 张磊/00133543 | --var varName | --hrScript S1 | --orgReport 组织名,编码 [--logicCal and]
                                   （会签节点自动写入 ext:signNode 的 extPlugins）
  ibpm remove-node <key> --reconnect
  ibpm var-add <key> [--name 名称] [--type string]
  ibpm var-remove <key>
  ibpm verify <defKey> [-e uat]    校验工作区（布局/ID 关联/审批人）
  ibpm import <defKey|zip> [-e uat]  推送新版本（两段式确认）
  ibpm discard <defKey> [-e uat]   丢弃工作区

增:
  ibpm create spec.json [-e uat]   由 spec 生成新流程包并推送（复用 create-ibpm-flow 生成器）
`);
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

async function resolveDef(env, defKey) {
  const rows = await listDefs(env, defKey);
  const def = rows.filter(r => r.defKey === defKey && r.isMain !== 'N').sort((a, b) => b.version - a.version)[0]
    || rows.filter(r => r.defKey === defKey).sort((a, b) => b.version - a.version)[0];
  if (!def) { console.error(`✗ 未找到流程 ${defKey}`); process.exit(1); }
  return def;
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
  switch (cmd) {
    case undefined: case 'help': case '--help': usage(); return;

    case 'login': {
      const envName = argEnv();
      if (!hasFlag('--manual') && hasSsoCredentials(envName)) {
        try {
          const { jwt } = await ssoLogin(envName);
          const exp = new Date(jwt.exp * 1000).toLocaleString('zh-CN');
          console.log(`\n✓ 全自动登录成功（SSO 直连）：用户 ${jwt.sub || '?'}，token 有效期至 ${exp}`);
          console.log('  已写入 ~/.ibpm-cli/config.json');
          return;
        } catch (err) {
          console.log(`✗ 全自动登录失败：${err.message}`);
          console.log('  回退浏览器手动流程...\n');
        }
      } else if (!hasFlag('--manual')) {
        console.log('ℹ 未配置 SSO 凭据：执行 `ibpm sso-setup` 一次性录入后，登录即全自动（零浏览器零人工）。');
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

    case 'show':
    case 'nodes': {
      const envName = argEnv();
      const defKey = positional(1) || (() => { console.error('用法: ibpm show <defKey>'); process.exit(1); })();
      const env = ensureAuth(envName);
      const def = await resolveDef(env, defKey);
      const buf = await exportZip(env, def.defId);
      const tmpZip = join(tmpdir(), `ibpm-${defKey}.zip`);
      writeFileSync(tmpZip, buf);
      const { dir, temp } = unzipToTemp(tmpZip);
      try {
        if (cmd === 'show') {
          const { meta, nodes, edges } = parseFlowXml(join(dir, 'bpmdefs.flow.xml'));
          const assigns = parseNodeDispose(join(dir, 'nodeDispose.json'));
          console.log(renderShow(meta, nodes, edges, assigns));
        } else {
          const parsed = readFlow(join(dir, 'bpmdefs.flow.xml'));
          const nd = JSON.parse(readFileSync(join(dir, 'nodeDispose.json'), 'utf8'));
          console.log(renderNodes(parsed, nd));
        }
      } finally { rmSync(temp, { recursive: true, force: true }); }
      return;
    }

    case 'vars': {
      const envName = argEnv();
      const defKey = positional(1) || (() => { console.error('用法: ibpm vars <defKey>'); process.exit(1); })();
      const env = ensureAuth(envName);
      const def = await resolveDef(env, defKey);
      const buf = await exportZip(env, def.defId);
      const tmpZip = join(tmpdir(), `ibpm-${defKey}.zip`);
      writeFileSync(tmpZip, buf);
      const { dir, temp } = unzipToTemp(tmpZip);
      try {
        const bpmn = readFileSync(join(dir, 'bpmdefs.flow.xml'), 'utf8');
        const vars = parseVars(bpmn.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&'));
        console.log('变量key               类型     变量名');
        for (const v of vars) console.log(`${v.key.padEnd(22)} ${v.type.padEnd(8)} ${v.name}`);
        console.log(`\n共 ${vars.length} 个`);
      } finally { rmSync(temp, { recursive: true, force: true }); }
      return;
    }

    case 'export': {
      const env = ensureAuth(argEnv());
      const defKey = positional(1) || (() => { console.error('用法: ibpm export <defKey> [-o 文件]'); process.exit(1); })();
      const def = await resolveDef(env, defKey);
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
      const assigneeArgs = { spec: getFlag('--spec'), var: getFlag('--var'), hrScript: getFlag('--hrScript'), orgReport: getFlag('--orgReport') };
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

    case 'set-condition': {
      const envName = argEnv();
      const from = positional(1), to = positional(2);
      const defKey = getFlag('--flow', '-f') || (() => { console.error('缺少 --flow <defKey>'); process.exit(1); })();
      const ctx = loadEditable(defKey, envName);
      const msg = setCondition(ctx.flow, { from, to, expr: getFlag('--expr'), name: getFlag('--name') });
      ctx.save();
      console.log('✓', msg);
      return;
    }

    case 'set-assignee': {
      const envName = argEnv();
      const key = positional(1) || (() => { console.error('用法: ibpm set-assignee <key> --spec|--var|--hrScript|--orgReport ...'); process.exit(1); })();
      const defKey = getFlag('--flow', '-f') || (() => { console.error('缺少 --flow <defKey>'); process.exit(1); })();
      const ctx = loadEditable(defKey, envName);
      const assigneeArgs = { spec: getFlag('--spec'), var: getFlag('--var'), hrScript: getFlag('--hrScript'), orgReport: getFlag('--orgReport') };
      const msg = setAssignee(ctx.flow, ctx.nd, { key, assigneeArgs, logicCal: getFlag('--logicCal') });
      ctx.save();
      console.log('✓', msg);
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
      const defKey = getFlag('--flow', '-f') || (() => { console.error('缺少 --flow <defKey>'); process.exit(1); })();
      const ctx = loadEditable(defKey, envName);
      const msg = varAdd(ctx.flow, { key, name: getFlag('--name'), type: getFlag('--type') || 'string' });
      ctx.save();
      console.log('✓', msg);
      return;
    }

    case 'var-remove': {
      const envName = argEnv();
      const key = positional(1);
      const defKey = getFlag('--flow', '-f') || (() => { console.error('缺少 --flow <defKey>'); process.exit(1); })();
      const ctx = loadEditable(defKey, envName);
      const msg = varRemove(ctx.flow, { key });
      ctx.save();
      console.log('✓', msg);
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
      console.log('✓ 导入检查通过（新流程）: ibpm import-confirm 无需 cacheFileId，请走 create 流程');
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
      const def = await resolveDef(env, defKey);
      const nodesOpt = getFlag('--nodes');
      if (!nodesOpt) { await approvalQuery(env, def.defId); return; }
      await approvalSave(env, def.defId, {
        nodes: nodesOpt, value: getFlag('--value') || 'true',
        formValue: getFlag('--form-value'), mobileFormValue: getFlag('--mobile-form-value'),
        settingTemplate: getFlag('--setting-template'), force: hasFlag('--force'),
      });
      return;
    }

    case 'contract': {
      const env = ensureAuth(argEnv());
      const defKey = positional(1) || (() => { console.error('用法: ibpm contract <defKey>'); process.exit(1); })();
      const def = await resolveDef(env, defKey);
      await contract(env, def.defId);
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
