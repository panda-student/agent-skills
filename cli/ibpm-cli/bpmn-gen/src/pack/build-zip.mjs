// 组装流程 ZIP 包（pack 层核心）：spec → 自动布局 → defJson/nodeDispose/activitiXml → bpmdefs.flow.xml → zip
//
// 生成的 zip 结构（对齐原 zip）:
//   <flowkey>_<date>_<time>.zip
//   └── <flowkey>_<date>_<time>/
//       ├── bpmdefs.flow.xml      ← 三层结构：bpmDefinition > bpmDefData{bpmnXml, defJson}
//       ├── nodeDispose.json      ← 节点审批人配置
//       ├── bo.xml                ← 占位
//       ├── form.xml              ← 占位
//       ├── formrights.xml        ← 占位
//       ├── formRightScript.json  ← 占位
//       └── nodeAutoSetting.json  ← 占位
//
// 用法（库）：
//   const { zipPath, folderName, defJson, nodeDispose } = await buildFlowZip(spec, { zipPath })

import { mkdirSync, createWriteStream } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ZipArchive } from 'archiver';
import { buildNoDiXml } from '../generate/build-xml.mjs';
import { bpmnToOryx } from '../generate/bpmn-to-oryx.mjs';
import { generateNodeDispose } from '../generate/generate-nodedispose.mjs';
import { buildActivitiXml } from '../generate/build-activiti-xml.mjs';
import { autoLayout } from '../layout/auto-layout.mjs';

// 输出目录基于调用方的当前工作目录（process.cwd()），而非脚本所在目录。
// 这样在哪个项目调用技能，产物就落到该项目的 out/ 下。
const PROJECT_ROOT = process.cwd();

// ============ 工具函数 ============

function pad(n) { return String(n).padStart(2, '0'); }

function timestamp() {
  const d = new Date();
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

// XML 属性值转义（bpmDefinition 的 name/defKey/typeId 等属性）
function escapeXml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// XML 元素文本转义（嵌套 bpmnXml/defJson 等元素内容）
// 对齐平台导出：只转义 & < >，保留 " '（元素文本里引号无需转义，
// 条件表达式/脚本/JSON 里大量引号，转义会让文件膨胀 30%+）
function escapeXmlText(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ============ 生成各文件 ============

/**
 * 生成占位文件内容（5个）
 */
function placeholderFiles(processKey) {
  return {
    'bo.xml': '<?xml version="1.0" encoding="utf-8" standalone="yes"?>\n<bodefs/>',
    'form.xml': '<?xml version="1.0" encoding="utf-8" standalone="yes"?>\n<bpmFormImport/>',
    'formrights.xml': '<?xml version="1.0" encoding="utf-8" standalone="yes"?>\n<bpmFormRights/>',
    'formRightScript.json': '[]',
    'nodeAutoSetting.json': JSON.stringify({ [processKey]: { messageScheduleList: [], messageTemplateList: [], messageSettingsList: [] } }),
  };
}

/**
 * 生成完整的 bpmdefs.flow.xml（三层结构）
 */
function buildBpmDefsFlowXml(spec, defJson, nodeDispose, laidOutXml) {
  const { name, processKey } = spec;
  const bpmnXmlContent = escapeXmlText(laidOutXml);
  const defJsonContent = JSON.stringify(defJson);

  // bpmDefinition 的元数据属性
  const defAttrs = [
    `name="${escapeXml(name)}"`,
    `defKey="${escapeXml(processKey)}"`,
    `desc=""`,
    `status="deploy"`,
    `testStatus="test"`,
    `designer="WEB"`,
    `supportMobile="0"`,
    `rev="0"`,
    `showUrgentState="0"`,
    `showModifyRecord="0"`,
    `isReadRevoke="false"`,
    `typeId="${escapeXml(spec.typeId || '')}"`,
    `type_name_="${escapeXml(spec.typeName || '')}"`,
    `system="${escapeXml(spec.sysName || '')}"`,
  ].join(' ');

  return `<?xml version="1.0" encoding="utf-8" standalone="yes"?>
<bpmlist>
    <bpmDef>
        <bpmDefinition ${defAttrs}>
            <createBy>${escapeXmlText(spec.createBy || '')}</createBy>
            <createOrgId>${escapeXmlText(spec.createOrgId || '')}</createOrgId>
            <updateBy>${escapeXmlText(spec.updateBy || '')}</updateBy>
            <bpmDefData>
                <defXml></defXml>
                <bpmnXml>${bpmnXmlContent}</bpmnXml>
                <defJson>${escapeXmlText(defJsonContent)}</defJson>
            </bpmDefData>
        </bpmDefinition>
    </bpmDef>
</bpmlist>`;
}

/**
 * 组装完整流程 ZIP 包
 * @param {object} spec - 流程描述（见 SKILL.md 最终 schema）
 * @param {object} [options]
 * @param {string} [options.zipPath] - 输出 zip 路径（默认 out/<processKey>_<timestamp>.zip，基于 cwd）
 * @returns {Promise<{zipPath: string, folderName: string, defJson: object, nodeDispose: object}>}
 */
export async function buildFlowZip(spec, options = {}) {
  console.log(`▶ 流程: ${spec.name} (${spec.processKey})`);
  console.log(`  节点: ${spec.nodes?.length || 0}, 边: ${spec.edges?.length || 0}`);

  const folderName = `${spec.processKey}_${timestamp()}`;
  const zipPath = resolve(options.zipPath || join(PROJECT_ROOT, 'out', `${folderName}.zip`));

  // 0. 预处理：把所有边的 id 规范化成 sid-<UUID> 格式（Activiti 引擎期望的格式）
  // 原版 zip 里 sequenceFlow id 都是 sid-UUID，简单名(如 flow1)可能导致 POJO 解析失败
  // 注意：这一步要在所有生成之前做，让 defJson 和 bpmnXml 用同一个新 id
  if (Array.isArray(spec.edges)) {
    for (const e of spec.edges) {
      if (!e.id || !e.id.startsWith('sid-')) {
        e.id = 'sid-' + randomUUID().toUpperCase();
      }
    }
  }

  // 1. 生成无坐标 BPMN XML
  const noDiXml = await buildNoDiXml(spec);
  console.log('✓ 构建无坐标 BPMN XML');

  // 2. 自动布局（含环流程降级到 BFS 分层）
  const laidOutXml = await autoLayout(noDiXml, spec);
  console.log('✓ 自动布局');

  // 3. 转 Oryx defJson
  const defJson = await bpmnToOryx(laidOutXml, spec);
  defJson.properties.process_id = spec.processKey;
  console.log('✓ 转换 Oryx defJson');

  // 4. 生成 nodeDispose.json
  const nodeDispose = generateNodeDispose(spec);
  console.log('✓ 生成 nodeDispose.json');

  // 5. 生成 Activiti 风格的 bpmnXml（系统 XML→POJO 要求此风格，含 extProcess 段）
  const activitiXml = await buildActivitiXml(laidOutXml, spec, nodeDispose);
  console.log('✓ 生成 Activiti 风格 bpmnXml（含 extProcess）');

  // 6. 生成 bpmdefs.flow.xml（三层结构，嵌入 activitiXml 和 defJson）
  const bpmDefsXml = buildBpmDefsFlowXml(spec, defJson, nodeDispose, activitiXml);
  console.log('✓ 生成 bpmdefs.flow.xml');

  // 7. 占位文件
  const placeholders = placeholderFiles(spec.processKey);
  console.log('✓ 生成占位文件');

  // 8. 打包 zip
  mkdirSync(dirname(zipPath), { recursive: true });
  await new Promise((resolve, reject) => {
    const output = createWriteStream(zipPath);
    const archive = new ZipArchive({ zlib: { level: 9 } });
    output.on('close', resolve);
    output.on('error', reject);
    archive.on('error', reject);
    archive.pipe(output);

    // 所有文件放在 folderName/ 目录下
    archive.append(Buffer.from(bpmDefsXml, 'utf8'), { name: `${folderName}/bpmdefs.flow.xml` });
    archive.append(Buffer.from(JSON.stringify(nodeDispose), 'utf8'), { name: `${folderName}/nodeDispose.json` });
    for (const [fname, content] of Object.entries(placeholders)) {
      archive.append(Buffer.from(content, 'utf8'), { name: `${folderName}/${fname}` });
    }

    archive.finalize();
  });

  console.log(`\n✅ 打包成功: ${zipPath}`);
  console.log(`   包内目录: ${folderName}/`);
  console.log(`   文件数: 7 (bpmdefs.flow.xml + nodeDispose.json + 5个占位文件)`);
  return { zipPath, folderName, defJson, nodeDispose };
}
