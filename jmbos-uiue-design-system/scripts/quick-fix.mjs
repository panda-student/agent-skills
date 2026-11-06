#!/usr/bin/env node
// JMBOS Design System — 一键快速修复脚本（Node.js 版，跨平台：macOS / Windows）
// 用法:
//   node scripts/quick-fix.mjs all <html-file>          # 执行所有资源修复（tokens+sprite+logo）
//   node scripts/quick-fix.mjs sprite <html-file>       # 注入 Sprite
//   node scripts/quick-fix.mjs logo <html-file>         # 内联 Logo SVG
//   node scripts/quick-fix.mjs tokens <html-file>       # 内联 Design Tokens CSS
//   node scripts/quick-fix.mjs pollution <html-file>    # 清洗污染：硬编码颜色→CSS变量 + 报告内联style/非标圆角
//   node scripts/quick-fix.mjs flatten <js-or-html-file># 提取 JS 模板字符串中的 HTML/CSS 为独立 .html 文件
//
// 用途：将外部独立 HTML 原型快速注入设计规范资源（Token/Sprite/Logo）+ 清洗外部原型污染
//       资源注入（all/sprite/logo/tokens）适用 index.html 首页 + 各 pages/*.html；污染清洗（pollution）同时适用 .html 和 .js（含 MPA js/pages/*.js）
//
// 前置依赖:
//   - Node.js v22.13.0 及以上版本（原 python3 依赖已移除，改用 Node 原生实现）

import fs from 'node:fs';
import path from 'node:path';
import {
  checkNodeVersion, SKILL_ROOT, readLines, readText, writeText,
  fileExists, extractInlineStyles,
} from './lib.mjs';

checkNodeVersion();

const SPRITE_FILE = path.join(SKILL_ROOT, 'ASSETS', 'icons', 'icons-sprite.svg');
const LOGO_FILE = path.join(SKILL_ROOT, 'ASSETS', 'brand', 'logo（支持替换颜色）.svg');
const TOKENS_FILE = path.join(SKILL_ROOT, 'ASSETS', 'design-tokens.css');

const ACTION = process.argv[2];
const HTML_FILE = process.argv[3];

if (!ACTION) {
  console.log('用法: node scripts/quick-fix.mjs <all|sprite|logo|tokens|pollution|flatten> <file>');
  process.exit(1);
}
if (!HTML_FILE) {
  console.log('[ERR] 缺少目标文件参数');
  process.exit(1);
}
if (!fileExists(HTML_FILE)) {
  console.log(`[ERR] 文件不存在: ${HTML_FILE}`);
  process.exit(1);
}

let fixCount = 0;

console.log(`JMBOS 修复工具 | 目标: ${HTML_FILE}`);

// ---------- Sprite 修复（优化版）----------
function fixSprite() {
  if (!fileExists(SPRITE_FILE)) {
    console.log(`[WARN] 跳过 Sprite: 文件不存在 ${SPRITE_FILE}`);
    return;
  }

  // 增强去重检查：通过唯一标识符判断是否已存在 Sprite
  let content = readText(HTML_FILE);
  if (content.includes('<!-- JMBOS-SVG-SPRITE -->')) {
    console.log('[INFO] Sprite 已存在（检测到标识符），跳过注入');
    return;
  }

  // 备用检查：通过 symbol 数量判断（兼容旧版本）
  let symbolCount = content.split('\n').filter((l) => l.includes('<symbol id="icon-')).length;
  if (symbolCount >= 10) {
    console.log(`[INFO] Sprite 已内联 (${symbolCount} 个图标），跳过`);
    return;
  }

  console.log('[FIX] 正在优化内联 SVG Sprite（仅提取 symbol 元素）...');

  // 优化提取策略：仅提取 <symbol>...</symbol> 元素列表（等价原 awk 状态机）
  // 丢弃：XML 声明、注释、外层 <svg> 标签、元数据
  const spriteLines = readLines(SPRITE_FILE);
  const symbols = [];
  let buf = null;
  for (const line of spriteLines) {
    if (/<symbol id="icon-/.test(line)) buf = [];
    if (buf !== null) buf.push(line);
    if (buf !== null && /<\/symbol>/.test(line)) {
      symbols.push(buf.join('\n'));
      buf = null;
    }
  }
  const symbolsContent = symbols.join('\n');

  // 构建精简的 Sprite 容器（添加唯一标识符用于去重）
  const spriteBlock = `<!-- JMBOS-SVG-SPRITE -->
<svg xmlns="http://www.w3.org/2000/svg" style="display:none">
${symbolsContent}
</svg>
<!-- /JMBOS-SVG-SPRITE -->`;

  const htmlLines = content.split('\n');
  // 去除 split 产生的末尾空元素（文件以换行结尾时）
  const trailingEmpty = htmlLines.length > 0 && htmlLines[htmlLines.length - 1] === '';
  if (trailingEmpty) htmlLines.pop();

  const blockLines = spriteBlock.split('\n');
  let newLines;
  if (htmlLines.some((l) => l.includes('<body>'))) {
    // 在 <body> 后立即插入精简 sprite
    const bodyIdx = htmlLines.findIndex((l) => l.includes('<body>'));
    newLines = [
      ...htmlLines.slice(0, bodyIdx + 1),
      '',
      ...blockLines,
      '',
      ...htmlLines.slice(bodyIdx + 1),
    ];
    const injectedCount = symbolsContent.split('\n').filter((l) => l.includes('<symbol id="icon-')).length;
    writeText(HTML_FILE, newLines.join('\n') + '\n');
    console.log(`[OK] Sprite 已优化注入（仅 ${injectedCount} 个 symbol，无 XML 声明和注释）`);
    fixCount++;
  } else {
    console.log('[WARN] 未找到 <body> 标签，手动注入到文件开头');
    newLines = [...blockLines, '', ...htmlLines];
    const injectedCount = symbolsContent.split('\n').filter((l) => l.includes('<symbol id="icon-')).length;
    writeText(HTML_FILE, newLines.join('\n') + '\n');
    console.log(`[OK] Sprite 已优化注入到文件开头（${injectedCount} 个 symbol）`);
    fixCount++;
  }
}

// ---------- Logo 修复（内联 SVG）—— 优化版 ----------
function fixLogo() {
  if (!fileExists(LOGO_FILE)) {
    console.log(`[WARN] 跳过 Logo: 文件不存在 ${LOGO_FILE}`);
    return;
  }

  console.log('[FIX] 正在内联 Logo SVG...');

  let content = readText(HTML_FILE);

  // 检查是否已经是正确的内联 SVG（通过标识符判断）
  if (content.includes('<!-- JMBOS-INLINE-LOGO -->')) {
    console.log('[INFO] Logo 已是正确内联 SVG（检测到标识符），跳过');
    return;
  }

  // 检查是否存在 logo 元素（img 或 svg 均可）
  if (!/class="top-nav-logo"/.test(content)) {
    console.log('[INFO] 未检测到 .top-nav-logo 元素，跳过');
    return;
  }

  // 提取 <svg ...viewBox...> 内部内容，丢弃 XML 声明、<svg> 开标签、</svg> 闭标签
  // （修正原 bash/awk 版会把 </svg> 一并纳入导致双闭标签的瑕疵）
  const logoLines = readLines(LOGO_FILE);
  const inner = [];
  let inSvg = false;
  for (const line of logoLines) {
    if (!inSvg && /<svg.*viewBox/.test(line)) {
      inSvg = true;
      continue;
    }
    if (inSvg && /<\/svg>/.test(line)) break;
    if (inSvg) inner.push(line);
  }
  const logoInner = inner.join('\n');

  // 将硬编码 fill 颜色替换为 currentColor（支持 CSS filter 变色）
  const logoCleaned = logoInner.replace(/fill="#[0-9A-Fa-f]{3,8}"/g, 'fill="currentColor"');

  // 构建标准内联 logo（带唯一标识符用于去重 + 拼缺检测）
  const newLogo = `<!-- JMBOS-INLINE-LOGO -->
        <svg class="top-nav-logo" width="180px" height="42px" viewBox="0 0 180 42" xmlns="http://www.w3.org/2000/svg">
${logoCleaned}
        </svg>
<!-- /JMBOS-INLINE-LOGO -->`;

  // 匹配并替换：img 标签形式 或 已有但残缺的 svg 标签形式（替换第一处）
  const re = /<(?:img|svg)[^>]*class=["']top-nav-logo["'][^>]*(?:\/>|>)/;
  if (re.test(content)) {
    // 使用函数形式替换，避免 newLogo 中含 $ 等特殊替换符被误解析
    content = content.replace(re, () => newLogo);
    writeText(HTML_FILE, content);
    console.log('[OK] Logo 已替换为内联 SVG（fill=currentColor，支持 CSS 变色）');
    fixCount++;
    return;
  }

  console.log('[ERR] Logo 替换失败：无法匹配 .top-nav-logo 元素或替换工具不可用');
}

// ---------- Design Tokens 修复（内联 CSS）----------
function fixTokens() {
  if (!fileExists(TOKENS_FILE)) {
    console.log(`[WARN] 跳过 Design Tokens: 文件不存在 ${TOKENS_FILE}`);
    return;
  }

  let content = readText(HTML_FILE);

  // 检查是否已经内联（检查是否有 :root 变量定义）
  if (content.includes('--color-primary:')) {
    console.log('[INFO] Design Tokens 已内联，跳过');
    return;
  }

  // 检查是否有旧的外链引用，如果有先删除
  if (content.includes('design-tokens.css')) {
    console.log('[FIX] 检测到旧的外链引用，替换为内联...');
    content = content
      .split('\n')
      .filter((l) => !/<link[^>]*design-tokens\.css/.test(l))
      .join('\n');
  }

  console.log('[FIX] 正在内联 Design Tokens CSS...');

  // 构建 style 标签内容（trimEnd 对齐 bash $(cat) 的去尾换行行为）
  const styleContent = `  <!-- Design Tokens (内联) -->
  <style>
${readText(TOKENS_FILE).trimEnd()}
  </style>`;

  const lines = content.split('\n');
  const trailingEmpty = lines.length > 0 && lines[lines.length - 1] === '';
  if (trailingEmpty) lines.pop();

  const headIdx = lines.findIndex((l) => l.includes('<head>'));
  if (headIdx >= 0) {
    // 在 <head> 后插入内联 CSS
    lines.splice(headIdx + 1, 0, ...styleContent.split('\n'));
    writeText(HTML_FILE, lines.join('\n') + '\n');
    console.log('[OK] Design Tokens 已内联到 <head>');
    fixCount++;
  } else if (content.includes('<!DOCTYPE') || content.includes('<html')) {
    // 在文件开头添加 head 和内联 CSS
    writeText(HTML_FILE, `<head>\n${styleContent}\n</head>\n${content}`);
    console.log('[OK] Design Tokens 已内联（新建 head 区块）');
    fixCount++;
  } else {
    console.log('[ERR] 无法识别 HTML 结构，请手动添加 Design Tokens');
  }
}

// ---------- 污染清洗（硬编码颜色 → CSS 变量，值级映射）----------
// ⚠️ var() 转换为可选优化：style-scan.mjs S40 已采用三级色值策略，
//    色值匹配 design-tokens 色板 → PASS（不需处理）
//    UI 组件场景非规范色值 → FAIL（需修正，可用 var() 或正确 hex）
//    图表/多数据场景非规范色值 → SKIP（允许保留，不强制映射）
//    模糊场景非规范色值 → WARN（提示用户确认）
//    本命令适用于：需要主题切换支持、或希望统一为变量形式的场景。
function fixPollution() {
  console.log('[FIX] 正在清洗硬编码颜色污染（映射到 design-tokens CSS 变量）...');
  console.log('[INFO] var() 转换为可选优化：色值正确即合规，图表场景色值允许保留');

  // 颜色映射表来源：ASSETS/design-tokens.css
  // 通用映射（属性无关）+ 上下文敏感映射（#FFFFFF/#D2D7E1 按属性区分）
  const GENERAL_MAP = {
    // 主题色：九牧蓝
    '#3685F2': '--color-primary',
    '#5E9DF5': '--color-primary-hover',
    '#2364CC': '--color-primary-active',
    '#AFCEFA': '--color-primary-disabled',
    '#DEEDFF': '--color-menu-selected-bg',
    '#F3F8FE': '--color-light-bg',
    // 主题色：乐石蓝
    '#2468F2': '--color-primary-leshi',
    '#4F90FF': '--color-primary-leshi-hover',
    '#144BCC': '--color-primary-leshi-active',
    '#78AEFF': '--color-primary-leshi-disabled',
    '#E8F5FF': '--color-menu-selected-bg-leshi',
    '#F0F7FF': '--color-light-bg-leshi',
    // 品牌色
    '#0C328C': '--color-brand',
    '#5086F5': '--color-brand-leshi-hover',
    '#E9EFFD': '--color-brand-leshi-light',
    // 文字颜色
    '#141b24': '--color-text-primary',
    '#7C8493': '--color-text-secondary',
    '#B9BFCB': '--color-text-tertiary',
    // 背景颜色
    '#EBF1F6': '--color-bg-page',
    '#F4F7F9': '--color-bg-header',
    '#EDF3FA': '--color-bg-hover',
    '#E4E7F0': '--color-bg-divider',
    // 功能色：成功
    '#04D999': '--color-success',
    '#5EE7BD': '--color-success-hover',
    '#00B780': '--color-success-active',
    '#A4F1DA': '--color-success-disabled',
    '#CDF7EB': '--color-success-bg',
    '#E6FBF5': '--color-success-light',
    // 功能色：警告
    '#FF813B': '--color-warning',
    '#FFAE81': '--color-warning-hover',
    '#D46B08': '--color-warning-active',
    '#FFCF8B': '--color-warning-disabled',
    '#FFE4BA': '--color-warning-bg',
    '#FFF7E8': '--color-warning-light',
    // 功能色：错误
    '#FF4D5D': '--color-error',
    '#FF717D': '--color-error-hover',
    '#D93649': '--color-error-active',
    '#FFA3AB': '--color-error-disabled',
    '#FFD1D4': '--color-error-bg',
    '#FFEDEF': '--color-error-light',
  };
  const CONTEXT_MAP = new Map([
    ['#ffffff|color', '--color-text-white'],
    ['#ffffff|background', '--color-bg-card'],
    ['#ffffff|border', '--color-bg-card'],
    ['#d2d7e1|color', '--color-text-disabled'],
    ['#d2d7e1|background', '--color-bg-border'],
    ['#d2d7e1|border', '--color-bg-border'],
  ]);

  let content = readText(HTML_FILE);
  let count = 0;

  function mapHex(hexVal, propRoot) {
    const hv = hexVal.toLowerCase();
    const ck = `${hv}|${propRoot}`;
    if (CONTEXT_MAP.has(ck)) return `var(${CONTEXT_MAP.get(ck)})`;
    const up = hexVal.toUpperCase();
    for (const [k, v] of Object.entries(GENERAL_MAP)) {
      if (k.toUpperCase() === up) return `var(${v})`;
    }
    return null;
  }

  const cssRe = /\b(color|background|background-color|border-color|border-top-color|border-right-color|border-bottom-color|border-left-color)\s*:\s*(#[0-9a-fA-F]{3,8})\b/g;
  content = content.replace(cssRe, (match, prop, hexv) => {
    const root = prop.split('-')[0];
    const v = mapHex(hexv, root);
    if (v) {
      count++;
      return `${prop}: ${v}`;
    }
    return match;
  });

  writeText(HTML_FILE, content);

  if (count > 0) {
    console.log(`[OK] 已映射 ${count} 处硬编码颜色 → CSS 变量（var() 形式便于主题切换，非必须）`);
    fixCount++;
  } else {
    console.log('[INFO] 未发现可映射的硬编码颜色（色值可能已正确或已用变量，var() 转换非必须）');
  }

  // 非标准圆角只报告（有歧义，不自动改；排除逻辑与原版一致：含 0/2/4/8/12/16px 子串即豁免）
  const badRadii = new Set();
  for (const m of content.matchAll(/border-radius:[ \t]*\d+px/g)) {
    if (!/(0|2|4|8|12|16)px/.test(m[0])) badRadii.add(m[0]);
  }
  if (badRadii.size > 0) {
    console.log(`[WARN] 非标准圆角值（需手动确认）: ${[...badRadii].join('\n')} | 规范值: 0/2/4/8/12/16px`);
  }

  // 内联 style 污染报告（结构性，需手动提取为 class）
  const inlineStyles = extractInlineStyles(content.split('\n'));
  if (inlineStyles.length > 0) {
    console.log(`[WARN] ${inlineStyles.length} 处内联 style（需提取为 class）:`);
    console.log(inlineStyles.slice(0, 10).join('\n'));
  }
}

// ---------- flatten：提取 JS 模板字符串中的 HTML/CSS 为独立 .html ----------
// 解决问题：外部原型导入后 HTML/CSS 全部藏在 JS 函数模板字符串中，
//   导致 style-scan 无法扫描、AI 实现需大量读 JS 才能理解页面结构
// 输出：与输入同目录下的 .flattened.html 文件
function fixFlatten() {
  console.log('[FIX] 正在提取 JS 模板字符串中的 HTML/CSS...');

  const content = readText(HTML_FILE);
  const ext = path.extname(HTML_FILE);
  const base = HTML_FILE.slice(0, HTML_FILE.length - ext.length);
  const outputFile = `${base}.flattened.html`;

  // 如果是 .html 文件，先提取 <script> 标签内的 JS 内容
  let jsContent = content;
  let existingHtml = '';
  if (ext.toLowerCase() === '.html') {
    const scriptBlocks = [...content.matchAll(/<script[^>]*>(.*?)<\/script>/gis)].map((m) => m[1]);
    const bodyMatch = content.match(/<body[^>]*>(.*?)<\/body>/is);
    if (bodyMatch) {
      // 移除 script 标签，保留已有 HTML
      existingHtml = bodyMatch[1].replace(/<script[^>]*>.*?<\/script>/gis, '').trim();
    }
    jsContent = scriptBlocks.join('\n');
  }

  // 提取所有模板字符串（反引号分隔，可含转义字符）
  const templates = [...jsContent.matchAll(/`((?:[^`\\]|\\.)*)`/gs)].map((m) => m[1]);

  const htmlTagRe = /<(div|table|span|ul|li|form|section|header|footer|nav|main|article|aside|button|input|select|textarea|p|h[1-6]|label|a|img|svg|tr|td|th|thead|tbody)\b/i;

  const htmlParts = [];
  const cssParts = [];

  for (const t of templates) {
    // 去除转义符
    const tClean = t
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\`/g, '`')
      .replace(/\\'/g, "'")
      .replace(/\\"/g, '"');

    // 检查是否含 HTML 结构标签
    if (htmlTagRe.test(tClean)) {
      // 提取 <style> 内容
      for (const m of tClean.matchAll(/<style[^>]*>(.*?)<\/style>/gis)) {
        cssParts.push(m[1].trim());
      }
      // 从 HTML 中移除 <style> 标签
      const tNoStyle = tClean.replace(/<style[^>]*>.*?<\/style>/gis, '');
      htmlParts.push(tNoStyle.trim());
    } else if (tClean.toLowerCase().includes('<style')) {
      // 纯 CSS 字符串（含 <style> 标签）
      const styleMatches = [...tClean.matchAll(/<style[^>]*>(.*?)<\/style>/gis)].map((m) => m[1].trim());
      if (styleMatches.length) cssParts.push(...styleMatches);
      else cssParts.push(tClean.trim());
    } else if (/^\s*[.#]?\w[\w-]*\s*\{[^}]*[:;]/.test(tClean)) {
      // 纯 CSS 规则字符串（如 `.card { color: red; }`）
      cssParts.push(tClean.trim());
    }
  }

  // 合并已有 HTML（来自 .html 文件的 body）
  if (existingHtml && htmlTagRe.test(existingHtml)) {
    htmlParts.unshift(existingHtml);
  }

  // 组装输出
  let htmlContent = '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n  <meta charset="UTF-8">\n';
  if (cssParts.length) {
    htmlContent += '  <style>\n';
    htmlContent += cssParts.join('\n');
    htmlContent += '\n  </style>\n';
  }
  htmlContent += '</head>\n<body>\n';
  if (htmlParts.length) htmlContent += htmlParts.join('\n');
  htmlContent += '\n</body>\n</html>\n';

  writeText(outputFile, htmlContent);

  if (htmlParts.length > 0 || cssParts.length > 0) {
    console.log(`[OK] 已提取 ${htmlParts.length} 段 HTML + ${cssParts.length} 段 CSS → ${outputFile}`);
    console.log('[INFO] 后续步骤：');
    console.log(`  1. node scripts/quick-fix.mjs pollution "${outputFile}"  # 清洗硬编码颜色`);
    console.log(`  2. node scripts/style-scan.mjs "${outputFile}"            # 样式扫描`);
    console.log('  3. 手动提取内联 style 为 class（结构性清洗）');
    fixCount++;
  } else {
    console.log('[INFO] 未检测到 JS 模板字符串中的 HTML/CSS（文件可能已是规范 HTML）');
  }
}

// ---------- 主逻辑 ----------
// 备份机制（依 SKILL.md §G2/G2.2：修改写入前必须先备份；flatten 仅生成新文件不改原文件，无需备份）
if (['all', 'sprite', 'logo', 'tokens', 'pollution'].includes(ACTION)) {
  fs.copyFileSync(HTML_FILE, `${HTML_FILE}.pre-fix.bak`);
  console.log(`[BACKUP] 原文件已备份 → ${HTML_FILE}.pre-fix.bak（覆盖式，回滚来源）`);
}

switch (ACTION) {
  case 'all':
    fixTokens();
    fixSprite();
    fixLogo();
    break;
  case 'sprite':
    fixSprite();
    break;
  case 'logo':
    fixLogo();
    break;
  case 'tokens':
    fixTokens();
    break;
  case 'pollution':
    fixPollution();
    break;
  case 'flatten':
    fixFlatten();
    break;
  default:
    console.log(`[ERR] 未知操作: ${ACTION}`);
    console.log('   支持的操作: all | sprite | logo | tokens | pollution | flatten');
    process.exit(1);
}

console.log('');
console.log(`修复完成: 共 ${fixCount} 项已处理 | 建议验证: node scripts/validate-design.mjs "${HTML_FILE}"`);
