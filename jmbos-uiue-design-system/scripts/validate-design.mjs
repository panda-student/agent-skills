#!/usr/bin/env node
// JMBOS Design System — 资源层合规性快速校验（Node.js 版，跨平台：macOS / Windows）
// 用法: node scripts/validate-design.mjs [--quiet] <html-or-js-file>
//   --quiet  精简模式：仅输出 FAIL/WARN 项（与 style-scan.mjs 一致）
//
// 检测项（E1-E6）:
//   E1. Design Tokens 引用/内联（common.css 检测）
//   E2. SVG Sprite 内联（common.js 检测）
//   E3. Logo 规范（common.js 检测）
//   E4. 预览缩放脚本（common.js 检测）
//   E5. 页面文件三部分组织（仅 MPA 页面 .html；重定向壳 index.html 豁免）
//   E6. 内联 style 污染（外部原型导入主要污染源；Sprite 容器行级白名单，见 lib.mjs extractInlineStyles）
//
// 样式层检测（硬编码颜色/圆角/SVG尺寸/hover/导航高度等）请使用 style-scan.mjs

import path from 'node:path';
import {
  checkNodeVersion, readLines, fileExists, classifyFile,
  extractInlineStyles, printPlainSummary, exitByFail,
} from './lib.mjs';

checkNodeVersion();

// 解析参数
let QUIET = 0;
let HTML_FILE = '';
for (const arg of process.argv.slice(2)) {
  if (arg === '--quiet' || arg === '-q') QUIET = 1;
  else if (arg.startsWith('-')) {
    console.log(`未知参数: ${arg}`);
    console.log('用法: node scripts/validate-design.mjs [--quiet] <html-or-js-file>');
    process.exit(1);
  } else HTML_FILE = arg;
}

if (!HTML_FILE) {
  console.log('用法: node scripts/validate-design.mjs [--quiet] <html-or-js-file>');
  process.exit(1);
}
if (!fileExists(HTML_FILE)) {
  console.log(`[ERR] 文件不存在: ${HTML_FILE}`);
  process.exit(1);
}

const lines = readLines(HTML_FILE);
const { isJsFile, isMpaPage, isNavShell, isCommonCss, isRedirectShell } = classifyFile(HTML_FILE, lines);

let PASS = 0, WARN = 0, FAIL = 0, SKIP = 0;

// 通用输出函数（与 bash 版输出格式一致）
function passOutput(id, desc) {
  PASS++;
  if (QUIET === 0) console.log(`[PASS] ${id}: ${desc}`);
}
function failOutput(id, desc, detail, fix) {
  console.log(`[FAIL] ${id}: ${desc} | 偏差: ${detail} | 修复: ${fix}`);
  FAIL++;
}
function warnOutput(id, desc, detail) {
  console.log(`[WARN] ${id}: ${desc} | 提示: ${detail}`);
  WARN++;
}
function skipOutput(id, desc) {
  SKIP++;
  if (QUIET === 0) console.log(`[SKIP] ${id}: ${desc}`);
}

// 头部信息
if (QUIET === 0) {
  console.log(`JMBOS 资源校验 | 文件: ${HTML_FILE}`);
  if (isMpaPage === 1) console.log('模式: MPA 页面 — tokens/sprite 跳过');
  else if (isNavShell === 1) console.log('模式: 导航壳 JS — 检测 sprite/缩放');
  else if (isCommonCss === 1) console.log('模式: common.css — 检测 tokens');
  else if (isJsFile === 1) console.log('模式: JS 文件');
  console.log('');
}

// E1. Design Tokens 引用/内联
if (isMpaPage === 1) {
  skipOutput('E1', 'MPA 页面，tokens 在 common.css 中');
} else if (isNavShell === 1) {
  skipOutput('E1', '导航壳 common.js，tokens 在 common.css 中');
} else if (isCommonCss === 1) {
  const tokensLink = lines.filter((l) => l.includes('design-tokens.css')).length;
  const tokensInline = lines.filter((l) => /--color-primary\s*:/.test(l)).length;
  if (tokensLink >= 1) {
    passOutput('E1', `common.css 已引用 design-tokens.css (${tokensLink} 处)`);
  } else if (tokensInline >= 1) {
    passOutput('E1', `common.css 内联 Design Tokens（${tokensInline} 处）`);
  } else {
    failOutput('E1', 'common.css 未引用 design-tokens.css 也未内联 :root 变量',
      '未找到 tokens 引用',
      "在 common.css 顶部 @import url('design-tokens.css'); 或内联 :root 变量");
  }
} else {
  skipOutput('E1', '非 SPA 架构文件，tokens 在 common.css 中');
}

// E2. SVG Sprite 内联检查
if (isMpaPage === 1) {
  skipOutput('E2', 'MPA 页面，sprite 在 common.js 中');
} else if (isCommonCss === 1) {
  skipOutput('E2', 'common.css，sprite 在 common.js 中');
} else if (isNavShell === 1) {
  const spriteSymbolCount = lines.filter((l) => l.includes('<symbol id="icon-')).length;
  if (spriteSymbolCount >= 10) {
    passOutput('E2', `common.js 已内联 SVG Sprite (${spriteSymbolCount} 个图标)`);
  } else if (spriteSymbolCount > 0) {
    warnOutput('E2', 'common.js SVG Sprite 图标数量不足', `${spriteSymbolCount} 个（预期 113 个）`);
  } else {
    failOutput('E2', 'common.js 未检测到 SVG Sprite 内联',
      '0 个 symbol',
      '确认 common.js 从 ASSETS 正确复制（含 SVG Sprite）');
  }
} else if (isJsFile === 1) {
  skipOutput('E2', '.js 文件，Sprite 在 common.js 中');
} else {
  skipOutput('E2', '非 SPA 架构文件');
}

// E3. Logo 规范检查
if (isNavShell === 1) {
  const logoInlineSvg = lines.filter((l) => /class="top-nav-logo".*<svg/.test(l)).length;
  if (logoInlineSvg > 0) {
    passOutput('E3', 'common.js 已内联 Logo SVG');
  } else if (lines.some((l) => l.includes('top-nav-logo'))) {
    warnOutput('E3', 'Logo 元素存在但可能不符合规范', '检查 fill="var(--color-brand)"');
  } else {
    passOutput('E3', '未检测到 Logo 元素');
  }
} else {
  skipOutput('E3', 'Logo 在 common.js 中');
}

// E4. 预览缩放脚本检查
if (isMpaPage === 1) {
  skipOutput('E4', 'MPA 页面，zoom 逻辑在 common.js 中');
} else if (isCommonCss === 1) {
  skipOutput('E4', 'common.css，缩放脚本在 common.js 中');
} else if (isNavShell === 1) {
  const zoomInline = lines.filter((l) => l.includes('applyResponsiveZoom')).length;
  if (zoomInline >= 1) {
    passOutput('E4', 'common.js 包含预览缩放脚本（applyResponsiveZoom）');
  } else {
    failOutput('E4', 'common.js 未检测到 applyResponsiveZoom 函数',
      '未找到 applyResponsiveZoom',
      '在 common.js 中添加 applyResponsiveZoom 缩放逻辑');
  }
} else {
  skipOutput('E4', '缩放脚本在 common.js 中');
}

// E5. 页面文件三部分组织检查（仅 MPA 页面 .html；重定向壳 index.html 豁免——壳页仅跳转，业务页面在 pages/ 中）
if (isRedirectShell === 1 && isJsFile === 0) {
  skipOutput('E5', '重定向壳 index.html — 三部分组织不适用（G1：壳页仅跳转，业务页面在 pages/ 中）');
} else if (isMpaPage === 1 && isJsFile === 0) {
  if (QUIET === 0) console.log('--- E5: 页面文件三部分组织 ---');
  const partStyle = lines.filter((l) => /<style>/.test(l)).length;
  const partBodyDom = lines.filter((l) => /class="main-wrapper"|<main[\s>]/.test(l)).length;
  const partCommonJs = lines.filter((l) => /src="(\.\.\/)?js\/common\.js"/.test(l)).length;
  const partPageId = lines.filter((l) => /window\.__pageId\s*=/.test(l)).length;

  if (partStyle > 0 && partBodyDom > 0 && partCommonJs > 0 && partPageId > 0) {
    passOutput('E5', '三部分组织完整（<style> CSS → <body> HTML → <script> JS引用 + 路由ID）');
  } else {
    let localMissing = '';
    if (partStyle === 0) localMissing += '<style>块 ';
    if (partBodyDom === 0) localMissing += '业务DOM ';
    if (partCommonJs === 0) localMissing += 'common.js引用 ';
    if (partPageId === 0) localMissing += '__pageId声明 ';
    failOutput('E5', '页面文件缺少三部分组织锚点',
      `缺少: ${localMissing}`,
      '按 ASSETS/page-shells/index.html 模板组织为 <style>/<body>/<script> 三部分');
  }
}

// E6. 内联 style 污染检测（官方 common.js 已于 v5.1.3 修正子菜单折叠/页签图标 2 处过时内联样式；
//     Sprite 容器 display:none 为官方固有模式，由 lib.mjs extractInlineStyles 行级白名单豁免，
//     其余内联 style 仍正常检出——导航壳不做整文件豁免）
if (QUIET === 0) console.log('--- E6: 内联 style 污染检测 ---');
const inlineStyleList = extractInlineStyles(lines);
if (inlineStyleList.length === 0) {
  passOutput('E6', '未发现内联 style 污染');
} else {
  const inlineCount = inlineStyleList.length;
  console.log(`[FAIL] E6: 发现 ${inlineCount} 处内联 style 污染 | 偏差: ${inlineStyleList.slice(0, 5).join('; ')} | 修复: 见 external-html-workflow.md §0（先按脚本硬信号判定改造深度）+ 步骤三; node scripts/quick-fix.mjs pollution "${HTML_FILE}"`);
  FAIL++;
}

// 汇总
if (QUIET === 0) console.log('');
const TOTAL = PASS + WARN + FAIL + SKIP;
printPlainSummary({ kind: 6, total: TOTAL, pass: PASS, warn: WARN, fail: FAIL, skip: SKIP, quiet: QUIET });

if (FAIL > 0) {
  exitByFail(FAIL, { quiet: QUIET, kind: 6 });
} else if (WARN > 0) {
  if (QUIET === 0) console.log('存在建议优化的项');
  process.exit(0);
} else {
  exitByFail(0, { quiet: QUIET, kind: 6 });
}
