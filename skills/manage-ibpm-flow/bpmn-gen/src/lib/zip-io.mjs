// 流程 ZIP 读写公共库：解包、bpmdefs.flow.xml 解析、重打包
// postprocess / vsdx-relayout 共用，保证解包-重组-打包行为一致
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, createWriteStream } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { ZipArchive } from 'archiver';

const decEntities = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const encEntities = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/**
 * 解压流程 ZIP 到临时目录
 * @returns {{workDir: string, innerDir: string, innerName: string}} 调用方负责 rmSync(workDir)
 */
export function extractFlowZip(zipPath) {
  const workDir = join(tmpdir(), 'flowzip-io-' + Date.now());
  mkdirSync(workDir, { recursive: true });
  execSync(`powershell -NoProfile -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('${zipPath.replace(/\\/g, '\\\\')}', '${workDir.replace(/\\/g, '\\\\')}')"`, { stdio: 'pipe' });
  const innerName = readdirSync(workDir, { withFileTypes: true }).find(d => d.isDirectory())?.name;
  if (!innerName) { rmSync(workDir, { recursive: true, force: true }); throw new Error('zip 内无流程目录'); }
  return { workDir, innerDir: join(workDir, innerName), innerName };
}

/**
 * 读取并解析 bpmdefs.flow.xml
 * @returns {{raw: string, dec: string, bpmnXml: string, defJson: object}}
 */
export function readBpmDefs(innerDir) {
  const raw = readFileSync(join(innerDir, 'bpmdefs.flow.xml'), 'utf8');
  const dec = decEntities(raw);
  const bpmnXml = dec.match(/<bpmnXml>([\s\S]*?)<\/bpmnXml>/)?.[1] || '';
  const defJson = JSON.parse(dec.match(/<defJson>([\s\S]*?)<\/defJson>/)?.[1] || '{}');
  return { raw, dec, bpmnXml, defJson };
}

/**
 * 把重写后的 bpmnXml/defJson 写回 bpmdefs.flow.xml
 */
export function writeBpmDefs(innerDir, bpmnXml, defJson) {
  const raw = readFileSync(join(innerDir, 'bpmdefs.flow.xml'), 'utf8');
  const dec = decEntities(raw);
  let out = dec;
  if (bpmnXml != null) out = out.replace(/<bpmnXml>[\s\S]*?<\/bpmnXml>/, () => `<bpmnXml>${encEntities(bpmnXml)}</bpmnXml>`);
  if (defJson != null) out = out.replace(/<defJson>[\s\S]*?<\/defJson>/, () => `<defJson>${encEntities(JSON.stringify(defJson))}</defJson>`);
  writeFileSync(join(innerDir, 'bpmdefs.flow.xml'), out, 'utf8');
}

/**
 * 把流程目录重打包为 ZIP（archiver 正斜杠条目，IBPM 导入要求）
 * @returns {Promise<string>} 新 zip 路径
 */
export async function repackFlowZip(innerDir, innerName, outZipPath) {
  rmSync(outZipPath, { force: true });
  await new Promise((resolve, reject) => {
    const output = createWriteStream(outZipPath);
    const archive = new ZipArchive({ zlib: { level: 9 } });
    output.on('close', resolve);
    output.on('error', reject);
    archive.on('error', reject);
    archive.pipe(output);
    for (const fname of readdirSync(innerDir)) {
      archive.append(readFileSync(join(innerDir, fname)), { name: `${innerName}/${fname}` });
    }
    archive.finalize();
  });
  return outZipPath;
}
