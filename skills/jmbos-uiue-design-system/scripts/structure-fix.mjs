#!/usr/bin/env node
// JMBOS Design System — 结构合规自动检测与纠正脚本 (Structure Fix, Node.js 版，跨平台：macOS / Windows)
// 用法:
//   node scripts/structure-fix.mjs <html-file-or-directory>     # 检测+纠正（全量 M1-M12 + M13/M14 工程结构审计）
//   node scripts/structure-fix.mjs --detect <html-file>        # 仅检测不纠正
//   node scripts/structure-fix.mjs --fix <html-file>           # 强制纠正（默认已是检测+纠正）
//   node scripts/structure-fix.mjs --basic <html-file>         # 仅基础必要项（跳过骨架导航项 M5/M6/M10，用于路径C 全自定义页）
//
// 分级纠正规约（按 SKILL.md §3.7 页面类型判定）:
//   基础必要项（所有页面强制）: M1 SPA→MPA / M2 元信息头 / M3 __pageId / M4 文件命名(仅报告) / M7 common引用 / M8 废弃类名 / M9 内联JS / M12 四部分组织
//   骨架导航项（--basic 跳过）: M5 导航壳挂载点 / M6 布局骨架 / M10 .page-card 容器
//   仅报告项: M4 文件命名 / M11 SPA注入式挂载 / M14 页面拆分
//   工程结构项（不受 --basic 影响，始终执行）: M13 JS存放位置 / M14 页面拆分
//
// 检测项（M1-M14）:
//   —— 文件内容级（逐文件检测）——
//   M1.  SPA → MPA 结构（window.__renderPage / JS模板字符串内嵌HTML）
//   M2.  缺失元信息头（产物编号 D-XXX 注释）
//   M3.  缺失 __pageId 声明
//   M4.  文件命名不符（非 D-XXX_{名称} 格式）
//   M5.  缺失导航壳挂载点（#header / #sidebar）
//   M6.  缺失布局骨架（.main-wrapper / .main-content）
//   M7.  缺失 common.css / common.js 引用
//   M8.  废弃类名（.content-card → .page-card）
//   M9.  内联业务 JS（<body> 内 <script> 含业务逻辑）
//   M10. 缺失 .page-card 内容容器
//   M11. SPA 注入式挂载（mountPage / renderApp）
//   M12. 缺失四部分组织（元信息头+CSS+HTML+JS引用）
//   —— 工程结构级（文件树布局审计，目录级执行一次，补内容级检测盲区）——
//   M13. 配套 JS 存放位置错误（G3）：pages/ 下出现 .js —— pages/ 只放 .html，JS 必须在 js/pages/；自动纠正=移动文件+修正全项目引用
//   M14. 命名子页未独立成子页 HTML（G1 MPA）：js/pages/D-XXX_*.js 无对应 pages/D-XXX_*.html，或任意 HTML 引用 pages/*.js，
//        或非重定向壳的 index.html 搭载业务内容（main-wrapper/page-card/#page-content —— G1：index 一律为重定向壳）
//        —— 页面内容滞留在 index.html 等文件；仅报告，须按 G11 搬运式拆分（禁止脚本/模型重写内容）
//
// 重定向壳页豁免（G1：index.html 一律为重定向壳，单页面/多页面统一）：index.html 仅作重定向入口
//   （location.replace/assign/href 或 meta refresh 指向 pages/*.html）时，M3/M5/M6/M9/M10/M12 自动 SKIP（壳页无业务 DOM）；
//   M2 元信息头（接受 INDEX 编号）/ M7 common 引用仍照常检测。
//
// 与其他脚本关系:
//   validate-design.mjs → 资源层检测（E1-E6）
//   style-scan.mjs      → 样式层检测（S01-S69）
//   layout-scan.mjs     → 布局骨架检测（L1-L12）
//   structure-fix.mjs   → 结构合规检测+自动纠正（M1-M14）← 本脚本
//
// 详细映射文档: REFERENCES/external-html-workflow.md §1.3（速查表）+ §2.5（纠正流程）
//
// v1.1: 更名 structure-migrate.sh → structure-fix.sh，语义从"旧结构迁移"调整为"结构合规纠正"
// v1.2: 新增 M13/M14 工程结构级审计（文件树布局），修复"四道内容级脚本全 PASS 但工程结构违规"盲区

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  checkNodeVersion, readLines, fileExists, SKILL_ROOT, toPosix,
} from './lib.mjs';

checkNodeVersion();

// 解析参数
let DETECT_ONLY = 0;
let FORCE_FIX = 0;
let BASIC_ONLY = 0;
let TARGET = '';

for (const arg of process.argv.slice(2)) {
  if (arg === '--detect' || arg === '-d') DETECT_ONLY = 1;
  else if (arg === '--fix' || arg === '-m') FORCE_FIX = 1;
  else if (arg === '--basic' || arg === '-b') BASIC_ONLY = 1;
  else if (arg.startsWith('-')) {
    console.log(`未知参数: ${arg}`);
    console.log('用法: node scripts/structure-fix.mjs [--detect|--fix|--basic] <html-file-or-directory>');
    process.exit(1);
  } else TARGET = arg;
}

if (!TARGET) {
  console.log('用法: node scripts/structure-fix.mjs [--detect|--fix|--basic] <html-file-or-directory>');
  console.log('  --basic  仅基础必要项（M1-M4/M7-M9/M12），跳过骨架导航项 M5/M6/M10（用于路径C 全自定义页）');
  process.exit(1);
}

// 收集所有 HTML 文件 + JS 文件（JS 仅检测 M1/M11 SPA 特征）
// 排除规范配套 JS：js/pages/（页面配套逻辑）、js/lib/、common.js（导航壳）
function collectFiles(target) {
  if (fileExists(target)) return [target];
  try {
    if (fs.statSync(target).isDirectory()) return walkDir(target);
  } catch { /* fallthrough */ }
  console.log(`[ERR] 目标不存在: ${target}`);
  process.exit(1);
}

function walkDir(dir) {
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...walkDir(full));
    } else if (e.isFile()) {
      const posix = toPosix(full);
      const base = e.name;
      const ext = path.extname(base).toLowerCase();
      if (ext !== '.html' && ext !== '.js') continue;
      if (/\/tmp\//.test(posix)) continue;
      if (/\/\.autosave\//.test(posix)) continue;
      if (/\/js\/pages\//.test(posix)) continue;
      if (/\/js\/lib\//.test(posix)) continue;
      if (base === 'common.js') continue;
      out.push(full);
    }
  }
  return out;
}

// 工程结构级审计（M13/M14）：先于逐文件内容检测执行。
// M13 纠正会移动 pages/*.js → js/pages/，因此审计必须在文件收集前完成，
// 保证收集阶段不再把放错位置的 JS 当作待检文件。
let AUDIT_FAIL = 0;
let AUDIT_FIXD = 0;
const auditRoot = (() => {
  try {
    if (fs.statSync(TARGET).isDirectory()) return TARGET;
    // 单文件模式：文件位于 pages/ 下时，审计根必须取 pages/ 的父目录（项目根），
    // 否则 pagesDir/jsPagesDir 相对根解析后错位，M13/M14 漏检
    const abs = path.resolve(TARGET);
    const m = toPosix(abs).match(/^(.*)\/pages\/[^/]+$/);
    if (m) return m[1];
    return path.dirname(abs);
  } catch {
    console.log(`[ERR] 目标不存在: ${TARGET}`);
    process.exit(1);
  }
})();
auditProjectStructure(auditRoot);

// M13 纠正可能移动了传入的单文件（pages/X.js），同步更新 TARGET 指向新位置
if (!fileExists(TARGET)) {
  const moved = path.join(auditRoot, 'js', 'pages', path.basename(TARGET));
  if (fileExists(moved)) TARGET = moved;
}

const HTML_FILES = collectFiles(TARGET);

if (HTML_FILES.length === 0) {
  console.log('[INFO] 未找到 HTML 文件');
  process.exit(0);
}

// ========== 通用函数 ==========
function passOutput(id, desc) {
  PASS++;
  console.log(`  [PASS] ${id}: ${desc}`);
}
function failOutput(id, desc, detail, fix) {
  console.log(`  [FAIL] ${id}: ${desc}`);
  console.log(`     偏差: ${detail}`);
  console.log(`     矫正: ${fix}`);
  FAIL++;
}
function warnOutput(id, desc, detail) {
  console.log(`  [WARN] ${id}: ${desc}`);
  console.log(`     提示: ${detail}`);
  WARN++;
}
function skipOutput(id, desc) {
  SKIP++;
  console.log(`  [SKIP] ${id}: ${desc}（--basic 模式，保留自定义结构，仅报告）`);
}
function fixOutput(id, desc) {
  FIXD++;
  console.log(`  [FIXD] ${id}: ${desc}`);
}

// grep -c 安全包装：确保返回纯数字
function safeCount(lines, re) {
  let n = 0;
  for (const l of lines) if (re.test(l)) n++;
  return n;
}

// ========== 行级编辑辅助（等价 bash awk 注入逻辑） ==========

/** 在每个匹配 re 的行之后插入 insertLines（等价 awk '/re/{print; print INSERT; next}1'） */
function insertAfterEach(lines, re, insertLines) {
  const out = [];
  for (const l of lines) {
    out.push(l);
    if (re.test(l)) out.push(...insertLines);
  }
  return out;
}

/** 在每个匹配 re 的行之前插入 insertLines（等价 awk '/re/{print INSERT; print; next}1'） */
function insertBeforeEach(lines, re, insertLines) {
  const out = [];
  for (const l of lines) {
    if (re.test(l)) out.push(...insertLines);
    out.push(l);
  }
  return out;
}

/** 日期 YYYY-MM-DD（等价 date +%Y-%m-%d） */
function todayStr() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}

// ========== 纠正辅助函数 ==========

// 注入元信息头模板
function injectMetadataHeader(file) {
  let lines = readLines(file);

  // 尝试从 <title> 提取页面名称
  let pageName = '';
  for (const l of lines) {
    const m = l.match(/<title>([^<]+)<\/title>/);
    if (m) { pageName = m[1].replace(/ - JOMOO.*$/, ''); break; }
  }
  if (!pageName) pageName = '未命名页面';

  // 尝试推断页面类型
  const content = lines.join('\n');
  let pageType;
  if (/query-bar|data-table|pagination/.test(content)) pageType = '列表页';
  else if (/detail-grid|detail-section/.test(content)) pageType = '详情页';
  else if (/form-body|form-footer/.test(content)) pageType = '表单页';
  else if (/modal-overlay|modal-header/.test(content)) pageType = '弹窗';
  else pageType = '其他';

  const basename = path.basename(file, '.html');
  const metadata = [
    '  <!--',
    '    ============================================================',
    '    JMBOS UI/UE 设计产物',
    '    ============================================================',
    '    产物编号: D-XXX',
    `    页面名称: ${pageName}`,
    `    页面类型: ${pageType}`,
    '    所属模块: 待补充',
    `    路由ID: ${basename}`,
    '    需求来源: 待补充',
    '    所属迭代: 待补充',
    `    最后更新: ${todayStr()}`,
    '    ============================================================',
    '  -->',
  ];

  // 在 <head> 后注入
  if (lines.some((l) => l.includes('<head>'))) {
    lines = insertAfterEach(lines, /<head>/, metadata);
    fs.writeFileSync(file, lines.join('\n') + '\n', 'utf8');
  }
}

// 注入 __pageId 声明
function injectPageId(file) {
  let lines = readLines(file);
  const basename = path.basename(file, '.html');
  // 转为 kebab-case
  const pageId = basename.replace(/[_ ]/g, '-').toLowerCase();
  const pageIdScript = `<script>window.__pageId='${pageId}';</script>`;

  if (lines.some((l) => l.includes('<body>'))) {
    lines = insertAfterEach(lines, /<body>/, [pageIdScript]);
    fs.writeFileSync(file, lines.join('\n') + '\n', 'utf8');
  }
}

// 注入导航壳挂载点
function injectNavMounts(file) {
  let lines = readLines(file);
  const mounts = [
    '  <!-- 导航壳挂载点 -->',
    '  <div id="header"></div>',
    '  <aside id="sidebar" class="sidebar"></aside>',
    '',
    '  <!-- 页面内容容器 -->',
    '  <div class="main-wrapper">',
    '    <main class="main-content">',
    '      <div id="tabs-nav-container"></div>',
    '      <div id="page-content">',
  ];
  const closing = [
    '      </div>',
    '    </main>',
    '  </div>',
  ];

  // 检查是否已有挂载点
  if (!lines.some((l) => l.includes('id="header"'))) {
    // 在 <body> 后注入挂载点 + 内容容器开头
    if (lines.some((l) => l.includes('<body>'))) {
      lines = insertAfterEach(lines, /<body>/, mounts);
      // 在 </body> 前注入闭合标签
      lines = insertBeforeEach(lines, /<\/body>/, closing);
      fs.writeFileSync(file, lines.join('\n') + '\n', 'utf8');
    }
  }
}

// 注入 common.css / common.js 引用
// 注：检测精确匹配 <link>/<script> 引用形式，避免 design-tokens 注释中的
//     "common.js" 字样干扰判断（原 bash 版 grep 'common\.js' 的误判缺陷已修复）
function injectCommonRefs(file) {
  let lines = readLines(file);
  let isSubpage = 0;
  // 判断是否为子页面（在 pages/ 目录下）
  if (/\/pages\//.test(toPosix(file))) isSubpage = 1;

  let cssPath = 'css/common.css';
  let jsPath = 'js/common.js';
  if (isSubpage === 1) { cssPath = '../css/common.css'; jsPath = '../js/common.js'; }

  let changed = false;

  // 注入 common.css
  if (!lines.some((l) => /<link[^>]*common\.css/.test(l))) {
    if (lines.some((l) => l.includes('<head>'))) {
      lines = insertAfterEach(lines, /<head>/, [`  <link rel="stylesheet" href="${cssPath}">`]);
      changed = true;
    }
  }

  // 注入 common.js（在 </body> 之前）
  if (!lines.some((l) => /<script[^>]*common\.js/.test(l))) {
    lines = insertBeforeEach(lines, /<\/body>/, [`  <script src="${jsPath}"></script>`]);
    changed = true;
  }

  if (changed) fs.writeFileSync(file, lines.join('\n') + '\n', 'utf8');
}

// 替换旧卡片类名
function replaceOldCardClass(file) {
  let lines = readLines(file);
  const content = lines.join('\n');
  if (content.includes('content-card')) {
    lines = lines.map((l) => l.replace(/content-card/g, 'page-card'));
    fs.writeFileSync(file, lines.join('\n') + '\n', 'utf8');
  }
}

// M9 共用状态机：<body> 内非排除条件的 <script> 块（等价 bash awk 状态机）
// 排除：window.__pageId / common.js / src= 引用
// mode: 'count' 返回块数量 | 'extract' 返回 JS 内容 | 'remove' 返回移除后的行数组
function processInlineScripts(lines, mode) {
  let inBody = false, inScript = false, count = 0;
  const jsParts = [];
  const kept = [];
  for (const l of lines) {
    if (/<body>/.test(l)) inBody = true;
    if (inBody && /<script>/.test(l) && !/window\.__pageId/.test(l) && !/common\.js/.test(l) && !/src=/.test(l)) {
      inScript = true;
      count++;
      continue;
    }
    if (inScript && /<\/script>/.test(l)) { inScript = false; continue; }
    if (inScript) {
      if (mode === 'extract') jsParts.push(l);
      continue;
    }
    kept.push(l);
  }
  if (mode === 'count') return count;
  if (mode === 'extract') return jsParts.join('\n');
  return kept;
}

// 提取内联业务 JS 到独立文件
function extractInlineJs(file) {
  let lines = readLines(file);
  const basename = path.basename(file, '.html');

  // 检测 <body> 内的 <script> 块（排除 __pageId 和 common.js 引用）
  const blockCount = processInlineScripts(lines, 'count');
  if (blockCount === 0) return;

  // 判断文件位置
  const fileDir = path.dirname(file);
  const jsDir = /\/pages\//.test(toPosix(file)) ? path.join(fileDir, '..', 'js', 'pages') : path.join(fileDir, 'js', 'pages');
  try { fs.mkdirSync(jsDir, { recursive: true }); } catch { /* ignore */ }
  const jsFile = path.join(jsDir, `${basename}.js`);

  // 提取 JS 内容
  const jsContent = processInlineScripts(lines, 'extract');
  fs.writeFileSync(jsFile, jsContent.endsWith('\n') ? jsContent : jsContent + '\n', 'utf8');

  // 从 HTML 中移除内联 JS 块
  lines = processInlineScripts(lines, 'remove');

  // 注入 JS 文件引用
  const jsRefPath = /\/pages\//.test(toPosix(file)) ? `../js/pages/${basename}.js` : `js/pages/${basename}.js`;

  if (!lines.join('\n').includes(`${basename}.js`)) {
    const updated = insertBeforeEach(lines, /<\/body>/, [`  <script src="${jsRefPath}"></script>`]);
    fs.writeFileSync(file, updated.join('\n') + '\n', 'utf8');
  } else {
    fs.writeFileSync(file, lines.join('\n') + '\n', 'utf8');
  }
}

// 注入 .page-card 容器
function injectPageCard(file) {
  let lines = readLines(file);
  const content = lines.join('\n');
  // 检查是否已有 page-card
  if (content.includes('page-card')) return;

  // 检查是否有 page-content 容器
  if (content.includes('page-content')) {
    // 在 page-content 后注入 page-card
    const out = [];
    let inPc = false;
    for (const l of lines) {
      if (/id="page-content"/.test(l)) {
        out.push(l);
        out.push('        <div class="page-card">');
        inPc = true;
        continue;
      }
      if (inPc && /<\/div>/.test(l) && !/page-card/.test(l)) {
        out.push('        </div>');
        out.push(l);
        inPc = false;
        continue;
      }
      out.push(l);
    }
    fs.writeFileSync(file, out.join('\n') + '\n', 'utf8');
  }
}

// ========== M13/M14: 工程结构级审计（文件树布局，补文件内容级检测盲区） ==========
// 背景: M1-M12 均为"文件内容级"检测器，而 G1/G3 违规常发生在"工程结构级"（文件树布局），
//       例如页面内容全部堆在 index.html、配套 JS 被放进 pages/ —— 内容级检测全部 PASS 但工程违规。
// 依规: G1 MPA 结构（index.html 首页 + pages/D-XXX_*.html 子页）+ G3 JS 存储（配套 JS → js/pages/）

/** 遍历 root 树内所有 .html（跳过 tmp/.autosave/node_modules），回调 (file, lines) */
function forEachHtml(root, cb) {
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (e.name === 'tmp' || e.name === '.autosave' || e.name === 'node_modules') continue;
        walk(path.join(dir, e.name));
      } else if (e.isFile() && e.name.toLowerCase().endsWith('.html')) {
        const full = path.join(dir, e.name);
        let lines;
        try {
          lines = readLines(full);
        } catch {
          continue;
        }
        cb(full, lines);
      }
    }
  };
  walk(root);
}

/** 正则元字符转义（文件名含中文/括号等时用于 new RegExp） */
function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** M13 纠正辅助：全项目修正 pages/<jsName> 引用 → 指向 js/pages/<jsName> 的正确相对路径 */
function fixPageJsRefs(root, jsName) {
  forEachHtml(root, (file, lines) => {
    const relTarget = toPosix(path.relative(path.dirname(file), path.join(root, 'js', 'pages', jsName)));
    const re = new RegExp(`(<script[^>]*src=["'])([^"']*pages/${escapeRe(jsName)})(["'])`);
    let changed = false;
    const out = lines.map((l) => {
      if (re.test(l)) {
        changed = true;
        return l.replace(re, `$1${relTarget}$3`);
      }
      return l;
    });
    if (changed) fs.writeFileSync(file, out.join('\n') + '\n', 'utf8');
  });
}

function auditProjectStructure(root) {
  console.log('');
  console.log('============================================');
  console.log('M13/M14: 工程结构级审计（G1/G3 文件树布局）');
  console.log(`审计根: ${root}`);
  console.log('============================================');

  const pagesDir = path.join(root, 'pages');
  const jsPagesDir = path.join(root, 'js', 'pages');

  // ---- M13: pages/ 下不允许出现 .js（G3 JS 存储：pages/ 只放 .html）----
  console.log('');
  console.log('--- M13: 配套JS存放位置检测（G3）---');
  const misplacedJs = [];
  try {
    for (const e of fs.readdirSync(pagesDir, { withFileTypes: true })) {
      if (e.isFile() && e.name.toLowerCase().endsWith('.js')) misplacedJs.push(e.name);
    }
  } catch { /* pages/ 不存在视为合规 */ }

  if (misplacedJs.length === 0) {
    console.log('  [PASS] M13: 配套 JS 存放位置正确（pages/ 下无 .js，符合 js/pages/ 约定）');
  } else {
    console.log('  [FAIL] M13: 配套 JS 存放位置错误（违反 G3）');
    for (const name of misplacedJs) console.log(`     偏差: pages/${name}（pages/ 目录只放 .html）`);
    console.log('     矫正: 移动至 js/pages/，并同步修正引用方 HTML 的 src 路径');
    AUDIT_FAIL++;
    if (DETECT_ONLY === 0) {
      try { fs.mkdirSync(jsPagesDir, { recursive: true }); } catch { /* ignore */ }
      for (const name of misplacedJs) {
        try {
          fs.renameSync(path.join(pagesDir, name), path.join(jsPagesDir, name));
          fixPageJsRefs(root, name);
          console.log(`  [FIXD] M13: pages/${name} → js/pages/${name}（全项目引用路径已修正）`);
          AUDIT_FIXD++;
        } catch { /* ignore */ }
      }
    }
  }

  // ---- M14: 命名子页未独立成 pages/D-XXX_*.html（G1 MPA）----
  console.log('');
  console.log('--- M14: MPA 页面拆分检测（G1）---');
  // 信号1: 任意 HTML 引用 pages/*.js（页面内容滞留在该 HTML、未拆分的直接特征）
  //        排除 ../js/pages/（正确引用），仅匹配 src 值直接以 pages/ 开头的引用
  const refHits = [];
  forEachHtml(root, (file, lines) => {
    lines.forEach((l, i) => {
      if (/<script[^>]*src=["'](?:\.{1,2}\/)?pages\/[^"']+\.js["']/.test(l)) {
        refHits.push(`${toPosix(file)}#L${i + 1}`);
      }
    });
  });
  // 信号2: js/pages/D-NNN_*.js 存在但 pages/ 无对应 D-NNN_*.html（页面内容堆在 index.html 等）
  //        仅针对带 D-XXX 编号的命名子页；不带编号的首页配套 JS（如 list.js）不判孤儿
  const orphanJs = [];
  try {
    for (const e of fs.readdirSync(jsPagesDir, { withFileTypes: true })) {
      if (!e.isFile() || !/^D-\d{3}_.+\.js$/i.test(e.name)) continue;
      const htmlName = e.name.replace(/\.js$/i, '.html');
      if (!fs.existsSync(path.join(pagesDir, htmlName))) orphanJs.push(e.name);
    }
  } catch { /* js/pages/ 不存在视为无孤儿 */ }

  // 信号3: index.html 搭载业务内容（G1：index 一律为重定向壳，禁止搭载业务 DOM）
  //        判定：非重定向壳的 index.html 含 main-wrapper / page-card / #page-content
  const bloatedIndex = [];
  forEachHtml(root, (file, lines) => {
    if (path.basename(file).toLowerCase() !== 'index.html') return;
    const c = lines.join('\n');
    const isShell = /location\.(?:replace|assign)\s*\(\s*['"`][^'"`]*pages\/[^'"`]+\.html['"`]/.test(c) ||
      /location\.href\s*=\s*['"`][^'"`]*pages\/[^'"`]+\.html['"`]/.test(c) ||
      /http-equiv=["']?refresh["']?[^>]*url=[^"'>]*pages\/[^"'>]+\.html/i.test(c);
    if (isShell) return;
    const domHits = [];
    if (/main-wrapper/.test(c)) domHits.push('.main-wrapper');
    if (/page-card/.test(c)) domHits.push('.page-card');
    if (/id="page-content"/.test(c)) domHits.push('#page-content');
    if (domHits.length > 0) bloatedIndex.push(`${toPosix(file)}（${domHits.join(' / ')}）`);
  });

  if (refHits.length === 0 && orphanJs.length === 0 && bloatedIndex.length === 0) {
    console.log('  [PASS] M14: MPA 页面拆分正确（命名子页均有独立 pages/D-XXX_*.html，index 未搭载业务内容）');
  } else {
    console.log('  [FAIL] M14: 命名子页未独立成子页 HTML（违反 G1 MPA）');
    for (const h of refHits) console.log(`     偏差: ${h} 引用 pages/*.js —— 页面内容滞留在该 HTML`);
    for (const j of orphanJs) console.log(`     偏差: js/pages/${j} 无对应 pages/${j.replace(/\.js$/i, '.html')}`);
    for (const b of bloatedIndex) console.log(`     偏差: ${b} —— index.html 搭载了业务内容（G1：index 一律为重定向壳）`);
    console.log('     矫正: 将页面内容（元信息头+CSS+DOM）从滞留文件搬运拆分为独立 pages/D-XXX_*.html（依 G11 搬运式拆分，禁止重写），index.html 改为重定向壳（元信息头 INDEX + common 引用 + location.replace 到默认首页）');
    AUDIT_FAIL++;
    // M14 不自动纠正：页面内容拆分属搬运式重构，须由模型执行（G11），脚本仅报告
  }

  console.log('');
  console.log(`  审计小计: FAIL=${AUDIT_FAIL} 已纠正=${AUDIT_FIXD}`);
}

// ========== 主检测+纠正逻辑 ==========

let PASS = 0, WARN = 0, FAIL = 0, FIXD = 0, SKIP = 0;
let totalFixedAll = 0;

function scanAndFixFile(file) {
  const doFix = DETECT_ONLY === 0 ? 1 : 0;

  // 备份机制（依 SKILL.md §G2/G2.2：纠正属重大修改，写入前必须先备份）
  if (doFix === 1 && fileExists(file)) {
    fs.copyFileSync(file, `${file}.pre-fix.bak`);
    console.log(`  [BACKUP] 原文件已备份 → ${file}.pre-fix.bak（覆盖式，回滚来源）`);
  }

  console.log('');
  console.log('============================================');
  console.log('JMBOS 结构合规检测与纠正 v1.2');
  console.log(`文件: ${file}`);
  if (doFix === 1) {
    if (BASIC_ONLY === 1) console.log('模式: 检测 + 自动纠正（--basic 基础必要项，跳过骨架导航项 M5/M6/M10）');
    else console.log('模式: 检测 + 自动纠正（全量 M1-M12 + M13/M14 工程结构审计）');
  } else {
    if (BASIC_ONLY === 1) console.log('模式: 仅检测（--basic 基础必要项）');
    else console.log('模式: 仅检测（全量 M1-M12 + M13/M14 工程结构审计）');
  }
  console.log('============================================');
  console.log('');

  // 重置计数
  PASS = 0; WARN = 0; FAIL = 0; FIXD = 0; SKIP = 0;

  let lines = readLines(file);

  // ---- M1: SPA → MPA 结构检测 ----
  console.log('--- M1: SPA → MPA 结构检测 ---');
  // 泛化模式：render*Page 变体（含 __renderPage/renderSubAgentPage/renderPage）、pageMarkup 函数、
  // 模板字符串内嵌 HTML（赋值/return 后反引号紧跟标签，或反引号直接跟标签）
  const SPA_PATTERN = safeCount(lines, /window\.__renderPage|render[A-Za-z]*Page|pageMarkup/);
  const TEMPLATE_HTML = safeCount(lines, /var html.*=`|let html.*=`|const html.*=`|return `<|= `<|`<div|`<table|`<section|`<form|`<ul|`<header|`<main|`<nav/);
  if (SPA_PATTERN > 0 || TEMPLATE_HTML > 0) {
    failOutput('M1', '检测到 SPA 结构（render*Page 挂载 / pageMarkup / JS 模板字符串内嵌 HTML）',
      `SPA 模式: render*Page=${SPA_PATTERN}, 模板HTML=${TEMPLATE_HTML}`,
      '走深度改造（external §0）：quick-fix.mjs flatten 提取 HTML/CSS 为独立文件 + 三部分分离；依 SKILL.md §G11 属搬运式拆分，内容从源文件搬运禁止重写');
    if (doFix === 1) {
      // 触发 flatten（子调用 quick-fix.mjs）
      const qf = path.join(SKILL_ROOT, 'scripts', 'quick-fix.mjs');
      if (fileExists(qf)) {
        const r = spawnSync(process.execPath, [qf, 'flatten', file], { stdio: ['ignore', 'ignore', 'ignore'] });
        if (r.status === 0) fixOutput('M1', '已执行 flatten，生成 .flattened.html 文件');
      }
    }
  } else {
    passOutput('M1', '非 SPA 结构（MPA 独立 HTML）');
  }

  // JS 文件仅适用 M1/M11 结构检测，跳过 HTML 专属项（元信息头/骨架/common引用等）
  if (path.extname(file).toLowerCase() === '.js') {
    console.log('');
    console.log('--- M11: SPA 挂载检测（JS 文件简版）---');
    lines = readLines(file); // M1 flatten 可能修改了文件，重读
    const SPA_MOUNT = safeCount(lines, /mountPage|renderApp|mountApp|app\.mount|createApp|render[A-Za-z]*Page|pageMarkup/);
    if (SPA_MOUNT > 0) {
      failOutput('M11', `JS 文件含 SPA 挂载/页面渲染逻辑（${SPA_MOUNT} 处）`,
        `挂载模式: ${SPA_MOUNT}`,
        '走深度改造（external §0）：flatten + 三部分分离，HTML 从 JS 搬运为独立 .html');
    } else {
      passOutput('M11', '无 SPA 挂载模式');
    }
    console.log('');
    console.log('[DONE] JS 文件检测完成（仅 M1/M11 适用）。M1/M11 任一 FAIL → external-html-workflow.md §0 强制深度改造');
    return;
  }

  // ---- 重定向壳页识别（G1 单页面场景）----
  // 规范：单页面同样强制 MPA——唯一业务页独立为 pages/D-XXX_*.html + js/pages/D-XXX_*.js，
  //       index.html 仅作重定向壳（common 引用 + 自动跳转），自身不含业务内容。
  // 豁免：重定向壳无业务 DOM，M3 __pageId / M5 导航壳挂载点 / M6 布局骨架 / M9 内联JS（跳转脚本）/ M10 page-card / M12 四部分组织 → SKIP；
  //       M2 元信息头 / M7 common 引用仍照常检测。
  lines = readLines(file);
  const contentAll = lines.join('\n');
  const isRedirectShell = path.basename(file).toLowerCase() === 'index.html' && (
    /location\.(?:replace|assign)\s*\(\s*['"`][^'"`]*pages\/[^'"`]+\.html['"`]/.test(contentAll) ||
    /location\.href\s*=\s*['"`][^'"`]*pages\/[^'"`]+\.html['"`]/.test(contentAll) ||
    /http-equiv=["']?refresh["']?[^>]*url=[^"'>]*pages\/[^"'>]+\.html/i.test(contentAll)
  );
  const skipRedirectShell = (id, desc) => skipOutput(id, `${desc}——index.html 为重定向壳页（G1 单页面场景），本项豁免`);

  // ---- M2: 元信息头检测 ----
  console.log('');
  console.log('--- M2: 元信息头检测 ---');
  lines = readLines(file);
  // index.html 按模板形态接受 INDEX 编号（ASSETS/page-shells/index.html），子页要求 D-XXX
  if (lines.some((l) => /产物编号:\s*(D-|INDEX)/.test(l))) {
    passOutput('M2', '元信息头已存在');
  } else {
    failOutput('M2', '缺失元信息头（产物编号 D-XXX 注释）',
      '<head> 内未找到 JMBOS 设计产物元信息注释',
      '在 <head> 第一行注入元信息头模板（产物编号/页面名称/页面类型/所属模块/路由ID/需求来源/所属迭代/最后更新）');
    if (doFix === 1) {
      try { injectMetadataHeader(file); fixOutput('M2', '已注入元信息头模板'); } catch { /* ignore */ }
    }
  }

  // ---- M3: __pageId 声明检测 ----
  console.log('');
  console.log('--- M3: __pageId 声明检测 ---');
  lines = readLines(file);
  if (lines.some((l) => /window\.__pageId\s*=/.test(l))) {
    passOutput('M3', '__pageId 声明已存在');
  } else if (isRedirectShell) {
    skipRedirectShell('M3', '缺失 __pageId 声明');
  } else {
    failOutput('M3', '缺失 __pageId 声明',
      '未找到 window.__pageId 路由ID声明',
      "在 <body> 开头注入 <script>window.__pageId='路由ID';</script>");
    if (doFix === 1) {
      try { injectPageId(file); fixOutput('M3', '已注入 __pageId 声明'); } catch { /* ignore */ }
    }
  }

  // ---- M4: 文件命名规范检测 ----
  console.log('');
  console.log('--- M4: 文件命名规范检测 ---');
  const BASENAME = path.basename(file, '.html');
  if (/^D-[0-9]+_/.test(BASENAME)) {
    passOutput('M4', '文件命名符合 D-XXX_{名称} 规范');
  } else if (BASENAME === 'index') {
    passOutput('M4', '首页文件（index.html 豁免）');
  } else {
    warnOutput('M4', '文件命名不符合 D-XXX_{名称} 规范',
      `当前: ${BASENAME}.html，建议: D-XXX_{页面功能名称}.html`);
    // 文件重命名需要用户确认，不自动执行
  }

  // ---- M5: 导航壳挂载点检测 ----
  console.log('');
  console.log('--- M5: 导航壳挂载点检测 ---');
  lines = readLines(file);
  const HAS_HEADER = safeCount(lines, /id="header"/);
  const HAS_SIDEBAR = safeCount(lines, /id="sidebar"/);
  if (BASIC_ONLY === 1) {
    // --basic 模式（路径C 全自定义页）：仅报告不纠正，保留自定义结构
    if (HAS_HEADER > 0 && HAS_SIDEBAR > 0) {
      passOutput('M5', '导航壳挂载点已存在（#header + #sidebar）');
    } else {
      skipOutput('M5', '缺失导航壳挂载点（#header/#sidebar）——全自定义页不强求标准导航壳');
    }
  } else if (HAS_HEADER > 0 && HAS_SIDEBAR > 0) {
    passOutput('M5', '导航壳挂载点已存在（#header + #sidebar）');
  } else if (isRedirectShell) {
    skipRedirectShell('M5', '缺失导航壳挂载点');
  } else {
    let missingMounts = '';
    if (HAS_HEADER === 0) missingMounts += '#header ';
    if (HAS_SIDEBAR === 0) missingMounts += '#sidebar ';
    failOutput('M5', '缺失导航壳挂载点',
      `缺少: ${missingMounts}`,
      '在 <body> 开头注入 <div id="header"></div> + <aside id="sidebar" class="sidebar"></aside>');
    if (doFix === 1) {
      try { injectNavMounts(file); fixOutput('M5', '已注入导航壳挂载点'); } catch { /* ignore */ }
    }
  }

  // ---- M6: 布局骨架检测 ----
  console.log('');
  console.log('--- M6: 布局骨架检测 ---');
  lines = readLines(file);
  const HAS_MAIN_WRAPPER = safeCount(lines, /main-wrapper/);
  const HAS_MAIN_CONTENT = safeCount(lines, /main-content/);
  if (BASIC_ONLY === 1) {
    if (HAS_MAIN_WRAPPER > 0 && HAS_MAIN_CONTENT > 0) {
      passOutput('M6', '布局骨架已存在（.main-wrapper + .main-content）');
    } else {
      skipOutput('M6', '缺失布局骨架（.main-wrapper/.main-content）——全自定义页不强求标准骨架');
    }
  } else if (HAS_MAIN_WRAPPER > 0 && HAS_MAIN_CONTENT > 0) {
    passOutput('M6', '布局骨架已存在（.main-wrapper + .main-content）');
  } else if (isRedirectShell) {
    skipRedirectShell('M6', '缺失布局骨架');
  } else {
    let missingLayout = '';
    if (HAS_MAIN_WRAPPER === 0) missingLayout += '.main-wrapper ';
    if (HAS_MAIN_CONTENT === 0) missingLayout += '.main-content ';
    failOutput('M6', '缺失布局骨架',
      `缺少: ${missingLayout}`,
      '注入标准布局骨架：<div class="main-wrapper"><main class="main-content">...');
    // M6 的注入与 M5 联动，M5 已注入时 M6 自动满足
    if (doFix === 1 && HAS_HEADER === 0) {
      fixOutput('M6', '已随 M5 导航壳挂载点注入布局骨架');
    }
  }

  // ---- M7: common.css / common.js 引用检测 ----
  // （精确匹配引用标签，避免 tokens 注释中的 "common.js" 字样误判）
  console.log('');
  console.log('--- M7: common.css / common.js 引用检测 ---');
  lines = readLines(file);
  const HAS_COMMON_CSS = safeCount(lines, /<link[^>]*common\.css/);
  const HAS_COMMON_JS = safeCount(lines, /<script[^>]*common\.js/);
  if (HAS_COMMON_CSS > 0 && HAS_COMMON_JS > 0) {
    passOutput('M7', 'common.css + common.js 引用已存在');
  } else {
    let missingRef = '';
    if (HAS_COMMON_CSS === 0) missingRef += 'common.css ';
    if (HAS_COMMON_JS === 0) missingRef += 'common.js ';
    failOutput('M7', '缺失公共资源引用',
      `缺少: ${missingRef}`,
      '在 <head> 注入 <link rel="stylesheet" href="css/common.css">；在 </body> 前注入 <script src="js/common.js"></script>');
    if (doFix === 1) {
      try { injectCommonRefs(file); fixOutput('M7', '已注入 common.css / common.js 引用'); } catch { /* ignore */ }
    }
  }

  // ---- M8: 旧卡片类名检测 ----
  console.log('');
  console.log('--- M8: 旧卡片类名检测 ---');
  lines = readLines(file);
  const OLD_CARD = safeCount(lines, /content-card/);
  if (OLD_CARD === 0) {
    passOutput('M8', '未使用旧卡片类名');
  } else {
    failOutput('M8', '检测到旧卡片类名 .content-card',
      `${OLD_CARD} 处使用 .content-card（已废弃）`,
      '替换为 .page-card（统一内容区大卡片容器类名）');
    if (doFix === 1) {
      try { replaceOldCardClass(file); fixOutput('M8', '已替换 .content-card → .page-card'); } catch { /* ignore */ }
    }
  }

  // ---- M9: 内联业务 JS 检测 ----
  console.log('');
  console.log('--- M9: 内联业务 JS 检测 ---');
  lines = readLines(file);
  const INLINE_JS = processInlineScripts(lines, 'count');
  if (INLINE_JS === 0) {
    passOutput('M9', '无内联业务 JS');
  } else if (isRedirectShell) {
    skipRedirectShell('M9', `检测到内联 JS（${INLINE_JS} 处，重定向跳转脚本属壳页职责）`);
  } else {
    failOutput('M9', `检测到内联业务 JS（${INLINE_JS} 处）`,
      `<body> 内有 ${INLINE_JS} 个 <script> 块含业务逻辑`,
      '提取为独立 js/pages/D-XXX_{名称}.js 文件，HTML 中仅保留引用');
    if (doFix === 1) {
      try { extractInlineJs(file); fixOutput('M9', '已提取内联 JS 为独立文件'); } catch { /* ignore */ }
    }
  }

  // ---- M10: .page-card 内容容器检测 ----
  console.log('');
  console.log('--- M10: .page-card 内容容器检测 ---');
  lines = readLines(file);
  const HAS_PAGE_CARD = safeCount(lines, /page-card/);
  if (BASIC_ONLY === 1) {
    if (HAS_PAGE_CARD > 0) {
      passOutput('M10', '.page-card 内容容器已存在');
    } else {
      skipOutput('M10', '缺失 .page-card 内容容器——全自定义页不强求标准容器');
    }
  } else if (HAS_PAGE_CARD > 0) {
    passOutput('M10', '.page-card 内容容器已存在');
  } else if (isRedirectShell) {
    skipRedirectShell('M10', '缺失 .page-card 内容容器');
  } else {
    failOutput('M10', '缺失 .page-card 内容容器',
      '未找到 .page-card 类（内容区大卡片容器）',
      '在 #page-content 内注入 <div class="page-card"> 包裹页面内容');
    if (doFix === 1) {
      try { injectPageCard(file); fixOutput('M10', '已注入 .page-card 容器'); } catch { /* ignore */ }
    }
  }

  // ---- M11: SPA 注入式挂载检测 ----
  console.log('');
  console.log('--- M11: SPA 注入式挂载检测 ---');
  lines = readLines(file);
  const SPA_MOUNT = safeCount(lines, /mountPage|renderApp|mountApp|app\.mount|createApp|render[A-Za-z]*Page|pageMarkup/);
  if (SPA_MOUNT === 0) {
    passOutput('M11', '非 SPA 注入式挂载');
  } else {
    failOutput('M11', '检测到 SPA 注入式挂载',
      `${SPA_MOUNT} 处使用 mountPage/renderApp/createApp 等 SPA 挂载方法`,
      '改为 MPA location.href 跳转 + sessionStorage 持久化（见 common.js switchPage）');
    // SPA 挂载纠正需要手动重构，不自动执行
  }

  // ---- M12: 四部分组织完整性检测 ----
  console.log('');
  console.log('--- M12: 四部分组织完整性检测 ---');
  lines = readLines(file);
  const HAS_META = safeCount(lines, /产物编号: D-/);
  const HAS_STYLE = safeCount(lines, /<style>/);
  const HAS_BODY_DOM = safeCount(lines, /main-wrapper|<main/);
  const HAS_JS_REF = safeCount(lines, /common\.js/);
  const HAS_PAGE_ID = safeCount(lines, /window\.__pageId/);

  if (HAS_META > 0 && HAS_STYLE > 0 && HAS_BODY_DOM > 0 && HAS_JS_REF > 0 && HAS_PAGE_ID > 0) {
    passOutput('M12', '四部分组织完整（元信息头+CSS+HTML+JS引用+路由ID）');
  } else if (isRedirectShell) {
    skipRedirectShell('M12', '四部分组织不完整');
  } else {
    let missingPart = '';
    if (HAS_META === 0) missingPart += '元信息头 ';
    if (HAS_STYLE === 0) missingPart += '<style>块 ';
    if (HAS_BODY_DOM === 0) missingPart += '业务DOM ';
    if (HAS_JS_REF === 0) missingPart += 'common.js引用 ';
    if (HAS_PAGE_ID === 0) missingPart += '__pageId声明 ';
    failOutput('M12', '页面文件缺少四部分组织锚点',
      `缺少: ${missingPart}`,
      '按 ASSETS/page-shells/index.html 模板组织为 元信息头+<style>+<body>+<script> 四部分');
    // M12 是 M2-M7 的汇总，前面已逐项纠正
  }

  // ---- 汇总 ----
  console.log('');
  console.log('============================================');
  console.log('结构合规检测与纠正结果汇总');
  console.log('============================================');
  console.log(`  通过: ${PASS}`);
  console.log(`  警告: ${WARN}`);
  console.log(`  失败: ${FAIL}`);
  if (SKIP > 0) console.log(`  跳过: ${SKIP}（--basic 模式，保留自定义结构）`);
  if (FIXD > 0) console.log(`  已纠正: ${FIXD}`);
  const TOTAL = PASS + WARN + FAIL + SKIP;
  console.log(`  总计: ${TOTAL}/12 项`);
  console.log('');

  if (FAIL > 0 && doFix === 1 && FIXD > 0) {
    console.log('📌 已执行自动纠正，建议重新检测确认：');
    console.log(`   node scripts/structure-fix.mjs --detect "${file}"`);
  } else if (FAIL > 0 && doFix === 0) {
    console.log('📌 检测到结构不符合规范，建议执行自动纠正：');
    console.log(`   node scripts/structure-fix.mjs "${file}"`);
  } else if (FAIL === 0) {
    console.log('🟢 全部通过！文件符合当前 JMBOS 设计系统标准结构');
  }
}

// ========== 主逻辑 ==========

for (const file of HTML_FILES) {
  scanAndFixFile(file);
  totalFixedAll += FIXD;
}
totalFixedAll += AUDIT_FIXD;

console.log('');
console.log('============================================');
console.log('全局汇总');
console.log('============================================');
console.log(`  扫描文件数: ${HTML_FILES.length}`);
console.log(`  工程结构审计: FAIL=${AUDIT_FAIL}（M13/M14，见上方审计小节）`);
if (totalFixedAll > 0) {
  console.log(`  自动纠正项: ${totalFixedAll}`);
  console.log('');
  console.log('  ⚠️ 纠正后建议：');
  console.log('  1. 逐文件检查纠正结果（元信息头需补充 D-XXX 编号和模块信息）');
  console.log('  2. 运行 validate-design.mjs 资源层校验');
  console.log('  3. 运行 layout-scan.mjs 布局骨架校验');
  console.log('  4. 运行 style-scan.mjs 样式层校验');
  console.log('  5. 如有 SPA 结构（M1 FAIL），需手动完成 flatten 后的重构');
}
