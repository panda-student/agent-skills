// pipeline.mjs —— 转换链路统一组合入口
//
// 阶段（--stages 逗号分隔串联，上一阶段产物文件路径自动作为下一阶段输入）:
//   parse-vsdx    vsdx → 解析 JSON（节点/边/几何折点/粘附）
//   build         spec JSON → 流程 ZIP（布局→defJson/nodeDispose/activitiXml→bpmdefs→打包）
//   postprocess   ZIP → 边路由优化 + DI 重写 + 重打包（.fixed.zip）
//   relayout-vsdx ZIP + vsdx → 1:1 重排 ZIP（--vsdx 必填，可配 --scale/--preview）
//   verify-zip    ZIP → 解包跑 布局/defJson/extProcess 三项校验
//   verify-import 解包目录 → 导入回归校验（可带数量断言）
//   verify-golden 生成 nodeDispose vs golden nodeDispose 回归对比
//   compare-di    解包目录 → DI 与 defJson 坐标一致性对比
//
// 用法:
//   node pipeline.mjs <spec.json> [-o out/flow.zip]                        # 默认 build
//   echo '<spec json>' | node pipeline.mjs --stdin [-o out/flow.zip]        # spec 从 stdin
//   node pipeline.mjs --stages build,postprocess,verify-zip spec.json -o out/flow.zip
//   node pipeline.mjs --stages parse-vsdx flow.vsdx [-o flow.parsed.json]
//   node pipeline.mjs --stages verify-import <解包目录> --expect-nodes 85 --expect-edges 110
//   node pipeline.mjs --stages verify-golden <gen.json> --golden <golden.json>
//
// 模块亦为纯函数库（src/ 分层: lib/parse/layout/generate/pack/verify），可 ESM import 自由组合。

import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { parseVsdx, reportVsdx } from './src/parse/parse-vsdx.mjs';
import { buildFlowZip } from './src/pack/build-zip.mjs';
import { postprocessZip } from './src/pack/postprocess.mjs';
import { relayoutFromVsdx } from './src/layout/vsdx-relayout.mjs';
import { renderCompareSvg } from './src/preview/svg-preview.mjs';
import { verifyFlowZip } from './src/verify/verify-flow-zip.mjs';
import { verifyDefjson } from './src/verify/verify-defjson.mjs';
import { verifyExtprocess } from './src/verify/verify-extprocess.mjs';
import { verifyImport } from './src/verify/verify-import.mjs';
import { verifyGolden } from './src/verify/verify-golden.mjs';
import { compareDiDefjson } from './src/verify/compare-di-defjson.mjs';

// 解压 zip 到临时目录，返回内部流程目录路径（调用方负责删外层临时目录）
function extractZip(zipPath) {
  const workDir = join(tmpdir(), 'pipeline-verify-' + Date.now());
  mkdirSync(workDir, { recursive: true });
  execSync(`powershell -NoProfile -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory('${zipPath.replace(/\\/g, '\\\\')}', '${workDir.replace(/\\/g, '\\\\')}')"`, { stdio: 'pipe' });
  const inner = readdirSync(workDir, { withFileTypes: true }).find(d => d.isDirectory())?.name;
  if (!inner) { rmSync(workDir, { recursive: true, force: true }); throw new Error('zip 内无流程目录'); }
  return { workDir, innerDir: join(workDir, inner) };
}

const STAGES = {
  'parse-vsdx': {
    desc: 'vsdx → 解析 JSON（节点/边/几何折点/粘附）',
    run: async (input, opts) => {
      const parsed = parseVsdx(input);
      reportVsdx(parsed);
      const out = opts.output || input.replace(/\.vsdx$/i, '') + '.parsed.json';
      mkdirSync(dirname(resolve(out)), { recursive: true });
      writeFileSync(out, JSON.stringify(parsed, null, 2), 'utf8');
      console.log(`\n✅ 解析结果: ${out}`);
      return out;
    },
  },
  'build': {
    desc: 'spec JSON → 流程 ZIP',
    run: async (input, opts) => {
      const raw = opts.stdin ? opts.stdin : readFileSync(input, 'utf8');
      const spec = JSON.parse(raw);
      const { zipPath } = await buildFlowZip(spec, { zipPath: opts.output });
      return zipPath;
    },
  },
  'postprocess': {
    desc: 'ZIP → 边路由优化 + DI 重写 + 重打包',
    run: async (input, opts) => postprocessZip(input, { rowsPath: opts.rows, output: opts.output }),
  },
  'relayout-vsdx': {
    desc: 'ZIP + VSDX → 1:1 重排 ZIP（defJson/DI 坐标替换）',
    run: async (input, opts) => {
      if (!opts.vsdx) throw new Error('relayout-vsdx 需要 --vsdx <vsdx路径>');
      const result = await relayoutFromVsdx(input, opts.vsdx, { output: opts.output, scale: opts.scale });
      if (opts.preview) {
        await renderCompareSvg(opts.vsdx, result.zipPath, opts.preview, { nodeMap: result.nodeMap, scale: opts.scale });
      }
      return result.zipPath;
    },
  },
  'verify-zip': {
    desc: 'ZIP → 布局/defJson/extProcess 三项校验',
    run: async (input) => {
      const { workDir, innerDir } = extractZip(input);
      try {
        console.log('--- verify-flow-zip（bpmnXml DI 为准）---');
        const r1 = verifyFlowZip(innerDir);
        console.log('\n--- verify-defjson（defJson 为准）---');
        const r2 = verifyDefjson(innerDir);
        console.log('\n--- verify-extprocess ---');
        const r3 = verifyExtprocess(innerDir);
        if (!r1.ok || !r2.ok || !r3.ok) throw new Error('校验失败（详见上方输出）');
        console.log('\n✅ ZIP 校验全部通过');
      } finally {
        rmSync(workDir, { recursive: true, force: true });
      }
      return null;
    },
  },
  'verify-import': {
    desc: '解包目录 → 导入回归校验（可带数量断言）',
    run: async (input, opts) => {
      const expect = {};
      for (const [k, opt] of [['nodes', 'expectNodes'], ['edges', 'expectEdges'], ['userTasks', 'expectUserTasks'], ['vars', 'expectVars'], ['extUser', 'expectExtUser'], ['extBase', 'expectExtBase']]) {
        if (opts[opt] != null) expect[k] = opts[opt];
      }
      const { ok } = verifyImport(input, { expect });
      if (!ok) throw new Error('导入回归校验失败（详见上方输出）');
      return null;
    },
  },
  'verify-golden': {
    desc: '生成 nodeDispose vs golden nodeDispose 回归对比',
    run: async (input, opts) => {
      if (!opts.golden) throw new Error('verify-golden 需要 --golden <golden/nodeDispose.json>');
      const { ok } = verifyGolden(input, opts.golden);
      if (!ok) throw new Error('golden 回归对比失败（详见上方输出）');
      return null;
    },
  },
  'compare-di': {
    desc: '解包目录 → DI 与 defJson 坐标一致性对比',
    run: async (input) => {
      const { ok } = compareDiDefjson(input);
      if (!ok) throw new Error('DI 与 defJson 存在不一致（详见上方输出）');
      return null;
    },
  },
};

function printUsage() {
  console.log(`用法:
  node pipeline.mjs <spec.json> [-o out/flow.zip]                       # 默认 build：spec → zip
  echo '<spec json>' | node pipeline.mjs --stdin [-o out/flow.zip]       # spec 从 stdin
  node pipeline.mjs --stages build,postprocess,verify-zip spec.json -o out/flow.zip
  node pipeline.mjs --stages parse-vsdx flow.vsdx [-o flow.parsed.json]
  node pipeline.mjs --stages relayout-vsdx flow.zip --vsdx flow.vsdx [--scale 100] [--preview out/compare.svg]
  node pipeline.mjs --stages verify-import <解包目录> --expect-nodes 85 --expect-edges 110
  node pipeline.mjs --stages verify-golden <gen.json> --golden <golden.json>
  node pipeline.mjs --stages compare-di <解包目录>

可选阶段: ${Object.keys(STAGES).join(', ')}

阶段间数据以文件路径衔接：产物阶段（parse-vsdx/build/postprocess）的输出自动作为下一阶段输入；
校验阶段（verify-*/compare-di）只出报告不产出文件。

通用选项:
  --stages <a,b,c>   逗号分隔的阶段名（默认 build）
  --stdin            spec 从 stdin 读（build 阶段）
  -o/--output <路径>  产物输出路径
  --rows <rows.json> postprocess 可选行布局（{rowGap, gapX, rows:[[nodeId,...],...]}）
  --golden <路径>    verify-golden 的对照文件
  --expect-* <n>     verify-import 数量断言（nodes/edges/userTasks/vars/extUser/extBase）

relayout-vsdx 专属选项:
  --vsdx <路径>      原始 vsdx（必填）
  --scale <n>        px/英寸，默认 100
  --preview <svg路径> 生成 vsdx vs 重排结果并排对比 SVG`);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = { stages: 'build', input: null, output: null, stdin: null };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-h' || a === '--help') { printUsage(); process.exit(0); }
    else if (a === '--stages') opts.stages = args[++i];
    else if (a === '--stdin') { opts.useStdin = true; }
    else if (a === '-o' || a === '--output') opts.output = args[++i];
    else if (a === '--rows') opts.rows = args[++i];
    else if (a === '--golden') opts.golden = args[++i];
    else if (a === '--vsdx') opts.vsdx = args[++i];
    else if (a === '--scale') opts.scale = Number(args[++i]);
    else if (a === '--preview') opts.preview = args[++i];
    else if (a.startsWith('--expect-')) {
      const optName = a.slice('--expect-'.length).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      opts['expect' + optName.charAt(0).toUpperCase() + optName.slice(1)] = Number(args[++i]);
    }
    else if (!opts.input) opts.input = a;
  }
  return opts;
}

function readStdin() {
  return new Promise((res, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => { data += chunk; });
    process.stdin.on('end', () => res(data));
    process.stdin.on('error', reject);
  });
}

async function main() {
  const opts = parseArgs(process.argv);
  const stageNames = opts.stages.split(',').map(s => s.trim()).filter(Boolean);
  for (const name of stageNames) {
    if (!STAGES[name]) { console.error(`❌ 未知阶段: ${name}（可选: ${Object.keys(STAGES).join(', ')}）`); process.exit(1); }
  }

  if (opts.useStdin) {
    opts.stdin = await readStdin();
  } else if (!opts.input) {
    printUsage();
    process.exit(1);
  }

  let currentInput = opts.input;
  for (const name of stageNames) {
    const stage = STAGES[name];
    console.log(`\n========== [${name}] ${stage.desc} ==========`);
    if (!currentInput && !opts.stdin) throw new Error(`阶段 ${name} 缺少输入文件`);
    const produced = await stage.run(currentInput, opts);
    if (produced) currentInput = produced;
  }
}

main().catch(e => {
  console.error('❌ 错误:', e.message || e);
  process.exit(1);
});
