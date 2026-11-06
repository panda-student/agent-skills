#!/usr/bin/env node
// JMBOS Design System — 样式合规性扫描脚本 (Node.js 版，跨平台：macOS / Windows)
// 用法: node scripts/style-scan.mjs [--quiet] <html-or-js-file>
//   --quiet  精简模式：仅输出 FAIL/WARN 项，跳过 PASS/SKIP（默认全量输出）
//
// 功能：扫描HTML文件中的样式偏差，输出带行号的偏差报告
// 与 validate-design.mjs 的关系：
//   validate-design.mjs → 资源层检测（Token/Sprite/Logo 是否存在）
//   style-scan.mjs      → 样式层检测（CSS值是否符合规范）
// 两者配合使用：先 validate → 再 style-scan → 修复 → 重验
// 检测范围: 66项样式偏差（S01-S65 + S69），与 style-fix-cheatsheet.md 1:1 对应

import path from 'node:path';
import {
  checkNodeVersion, readLines, fileExists, classifyFile,
  grepLines, countLines, firstMatchLine,
  isKnownHex, classifyColorScene, contextAround,
} from './lib.mjs';

checkNodeVersion();

// 解析参数
let QUIET = 0;
let HTML_FILE = '';
for (const arg of process.argv.slice(2)) {
  if (arg === '--quiet' || arg === '-q') QUIET = 1;
  else if (arg.startsWith('-')) {
    console.log(`未知参数: ${arg}`);
    console.log('用法: node scripts/style-scan.mjs [--quiet] <html-or-js-file>');
    process.exit(1);
  } else HTML_FILE = arg;
}

if (!HTML_FILE) {
  console.log('用法: node scripts/style-scan.mjs [--quiet] <html-or-js-file>');
  process.exit(1);
}
if (!fileExists(HTML_FILE)) {
  console.log(`[ERR] 文件不存在: ${HTML_FILE}`);
  process.exit(1);
}

const lines = readLines(HTML_FILE);
const content = lines.join('\n');
const { isJsFile, isMpaPage, isNavShell, isCommonCss } = classifyFile(HTML_FILE, lines);

let PASS = 0, WARN = 0, FAIL = 0, SKIP = 0;

// ========== 通用函数 ==========
function failOutput(id, desc, detail, fix) {
  console.log(`[FAIL] ${id}: ${desc} | 偏差: ${detail} | 矫正: ${fix}`);
  FAIL++;
}
function warnOutput(id, desc, detail, fix) {
  console.log(`[WARN] ${id}: ${desc} | 提示: ${detail} | 建议: ${fix}`);
  WARN++;
}
function passOutput(id, desc) {
  PASS++;
  if (QUIET === 0) console.log(`[PASS] ${id}: ${desc}`);
}
function infoOutput(id, desc) {
  SKIP++;
  if (QUIET === 0) console.log(`[SKIP] ${id}: ${desc}`);
}

/** 输出匹配行列表为 "N: text" 格式（等价 grep -n 输出） */
function fmt(matches, n = matches.length) {
  return matches.slice(0, n).map((m) => `${m.no}: ${m.text}`).join('\n');
}

/** awk 状态机：跳过 JMBOS-SVG-SPRITE 块后匹配（返回带行号匹配列表） */
function grepSkipSprite(re) {
  const out = [];
  let inSprite = false;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.includes('<!-- JMBOS-SVG-SPRITE -->')) { inSprite = true; continue; }
    if (l.includes('<!-- /JMBOS-SVG-SPRITE -->')) { inSprite = false; continue; }
    if (inSprite) continue;
    if (re.test(l)) out.push({ no: i + 1, text: l });
  }
  return out;
}

/** 对每个匹配行取后 n 行上下文（等价 grep -A n），返回行数组 */
function afterLines(re, n) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (re.test(lines[i])) out.push(...lines.slice(i, i + n + 1));
  }
  return out;
}

// 头部信息（quiet 模式下精简为一行）
if (QUIET === 0) {
  console.log(`JMBOS 样式扫描 v2.0 | 文件: ${HTML_FILE}`);
  if (isMpaPage === 1) console.log('模式: MPA 页面 — S01/S02 跳过');
  else if (isNavShell === 1) console.log('模式: 导航壳 JS — S01 跳过, S02 检测 sprite');
  else if (isCommonCss === 1) console.log('模式: common.css — S01 检测 tokens');
  else if (isJsFile === 1) console.log('模式: JS 文件');
  console.log('范围: 66项 (S01-S65 + S69) | 参考: style-fix-cheatsheet.md');
  console.log('');
}

// ================================================
// 第一组：资源预置 (S01-S03)
// ================================================
if (QUIET === 0) console.log('--- 资源预置 (S01-S03) ---');

// S01: Design Tokens 内联检查
if (isMpaPage === 1) {
  infoOutput('S01', 'MPA 页面：tokens 在 common.css 中，请单独检测 common.css');
} else if (isNavShell === 1) {
  infoOutput('S01', '导航壳 common.js：tokens 在 common.css 中，请单独检测 common.css');
} else if (isCommonCss === 1) {
  const tokenVar = countLines(lines, /--color-primary\s*:/);
  if (tokenVar >= 1) {
    passOutput('S01', `common.css 含 Design Tokens（--color-primary 变量，${tokenVar} 处）`);
  } else {
    failOutput('S01', 'common.css 未引入 Design Tokens',
      '未找到 :root CSS 变量定义',
      "在 common.css 顶部 @import url('design-tokens.css'); 或内联 :root 变量");
  }
} else {
  infoOutput('S01', '非 SPA 架构文件：tokens 在 common.css 中');
}

// S02: SVG Sprite 检查
if (isMpaPage === 1) {
  infoOutput('S02', 'MPA 页面：sprite 在 common.js 中，请单独检测 common.js');
} else if (isCommonCss === 1) {
  infoOutput('S02', 'common.css：sprite 在 common.js 中，请单独检测 common.js');
} else if (isNavShell === 1) {
  const symbolCount = countLines(lines, /<symbol id="icon-/);
  if (symbolCount >= 100) {
    passOutput('S02', `common.js 已内联 SVG Sprite（${symbolCount} 个 symbol，≥113 为优）`);
  } else if (symbolCount >= 10) {
    warnOutput('S02', 'common.js SVG Sprite 图标数量偏少',
      `${symbolCount} 个 symbol（预期 ≥113 个）`,
      '确认 common.js 从 ASSETS 正确复制');
  } else {
    failOutput('S02', 'common.js SVG Sprite 缺失或严重不足',
      `${symbolCount} 个 symbol（预期 ≥113 个）`,
      '确认 common.js 从 ASSETS 正确复制');
  }
} else {
  infoOutput('S02', '非 SPA 架构文件：sprite 在 common.js 中');
}

// S03: Logo 规范检查
if (isNavShell === 1) {
  const logoHardcode = grepLines(lines, /fill="#0C328C"/);
  const logoInline = countLines(lines, /class="top-nav-logo".*<svg/);
  if (logoHardcode.length > 0) {
    failOutput('S03', 'Logo 存在硬编码颜色 #0C328C',
      fmt(logoHardcode),
      '全局替换 fill="#0C328C" → fill="var(--color-brand)"');
  } else if (logoInline > 0) {
    passOutput('S03', 'common.js 已内联 Logo SVG（class="top-nav-logo"）');
  } else if (content.includes('top-nav-logo')) {
    passOutput('S03', 'Logo 元素存在（已通过其他方式实现）');
  } else {
    passOutput('S03', '未检测到 Logo 元素');
  }
} else {
  infoOutput('S03', 'Logo 在 common.js 中，请单独检测 common.js');
}

// S03a: 文字Logo宽度检查
{
  const logoTextExists = countLines(lines, /top-nav-logo-text/);
  const logoTextWidth = grepLines(lines, /top-nav-logo-text.*width/);
  const has180 = logoTextWidth.some((m) => m.text.includes('180px'));
  if (logoTextExists > 0 && !has180) {
    warnOutput('S03a', '文字Logo (.top-nav-logo-text) 宽度非180px',
      fmt(logoTextWidth),
      '添加 .top-nav-logo-text { width: 180px; } 以保持Logo区域宽度稳定');
  } else if (logoTextExists > 0 && has180) {
    passOutput('S03a', '文字Logo宽度正确（180px）');
  }
}

if (QUIET === 0) console.log('');

// ================================================
// 第二组：图标合规 (S04-S12)
// ================================================
if (QUIET === 0) console.log('--- 图标合规 (S04-S12) ---');

// S04: 错误的图标引入方式
{
  const badIconObj = grepLines(lines, /<object/);
  const badIconImg = grepLines(lines, /<img.*\.svg"/).filter((m) => !/top-nav-logo|brand\/logo|brand.*logo/.test(m.text));
  const badIconPath = grepSkipSprite(/<path d=/);
  if (badIconObj.length > 0 || badIconImg.length > 0 || badIconPath.length > 0) {
    const allBad = [...badIconObj, ...badIconImg, ...badIconPath].slice(0, 5).map((m) => `${m.no}: ${m.text}`).join('\n');
    failOutput('S04', '存在错误的图标引入方式',
      allBad,
      '标准图标：<img src="edit.svg"> → <svg class="icon"><use href="#icon-edit"></use></svg>（文件名即图标名，保留命名）；自定义图标：在 Sprite 块中添加 <symbol id="icon-名称"> 后用 <use href="#icon-名称"> 引用。禁止内联 <path d=>（丢失命名且无法命中资源，见 style-fix-cheatsheet.md S04）');
  } else {
    passOutput('S04', '图标引入方式正确（均使用 Sprite <use> 方式）');
  }
}

// S05: 顶导图标尺寸（应为20px）
{
  const navIcon16 = grepLines(lines, /\.nav-icon-btn\s*\{[^}]*width:\s*16px/);
  const navIconRight16 = grepLines(lines, /top-nav-right[^}]*width:\s*16px/);
  if (navIcon16.length > 0 || navIconRight16.length > 0) {
    failOutput('S05', '顶部导航栏图标尺寸错误（应为20px）',
      fmt([...navIcon16, ...navIconRight16]),
      '.nav-icon-btn { width: 20px !important; height: 20px !important; }');
  } else {
    passOutput('S05', '顶部导航栏图标尺寸正确（20px）');
  }
}

// S06: 侧边菜单图标颜色（应为 #141b24）
{
  const faint = grepLines(lines, /sidebar-menu-item[^}]*color:\s*#7C8493|menu-icon[^}]*color:\s*#7C8493/);
  const faint2 = grepLines(lines, /\.sidebar-menu-item\s+\.icon[^{]*\{[^}]*#7C8493/);
  if (faint.length > 0 || faint2.length > 0) {
    failOutput('S06', '侧边菜单功能图标颜色过淡（#7C8493→#141b24）',
      fmt([...faint, ...faint2]),
      '.sidebar-menu-item .icon { color: var(--color-text-primary) !important; }');
  } else {
    passOutput('S06', '侧边菜单图标颜色正确（主文本色 #141b24）');
  }
}

// S07: 侧边菜单选中态图标颜色（应变为 #3685F2）
{
  const activeLines = grepLines(lines, /sidebar-menu-item.*active/).slice(0, 3);
  if (activeLines.length > 0) {
    // 检查 active 态是否定义了图标变色（每处 active 后 5 行内）
    const activeHasColor = activeLines.some((m) =>
      lines.slice(m.no, m.no + 5).some((l) => /color:.*#3685F2|color:.*var\(--color-primary\)/.test(l)));
    if (!activeHasColor) {
      warnOutput('S07', '侧边菜单选中态图标可能未变色',
        '检测到 active 定义但未发现图标颜色变更',
        '.sidebar-menu-item.active .icon { color: var(--color-primary) !important; }');
    } else {
      passOutput('S07', '侧边菜单选中态图标颜色正确（主题蓝 #3685F2）');
    }
  } else {
    passOutput('S07', '未检测到侧边菜单 active 态定义（无菜单或已合并处理）');
  }
}

// S08: 输入框/下拉箭头图标颜色（应为 #B9BFCB）
{
  const dark = grepLines(lines, /input-wrapper[^}]*icon[^}]*color:\s*#(141b24|7C8493)|select-arrow[^}]*color:\s*#(141b24|7C8493)|input-icon[^}]*color:\s*#(141b24)/);
  if (dark.length > 0) {
    warnOutput('S08', '输入框/下拉箭头图标颜色可能过深',
      fmt(dark),
      '.input-wrapper .icon, .select-arrow .icon { color: var(--color-text-tertiary); }');
  } else {
    passOutput('S08', '输入框/下拉箭头图标颜色合理');
  }
}

// S09: 排序图标颜色（应为 #7C8493）
{
  const sortDark = grepLines(lines, /sort-icon[^}]*arrow[^}]*border[^}]*solid[^}]*#141b24|sort-icon[^}]*arrow[^}]*border[^}]*solid[^}]*#B9BFCB|sortable[^}]*icon[^}]*color:\s*#141b24/);
  if (sortDark.length > 0) {
    warnOutput('S09', '表格排序图标颜色可能异常',
      fmt(sortDark),
      '.sort-icon .arrow-up, .sort-icon .arrow-down { border-color: var(--color-text-secondary); }');
  } else {
    passOutput('S09', '表格排序图标颜色合理');
  }
}

// S10: 分页器/更多操作箭头颜色
{
  const pagIcon = grepLines(lines, /pagination[^}]*icon[^}]*color:\s*#141b24|btn-more[^}]*icon[^}]*color:\s*#141b24/);
  if (pagIcon.length > 0) {
    warnOutput('S10', '分页器/更多操作箭头颜色可能过深',
      fmt(pagIcon),
      '.pagination .icon, .btn-more-text .icon { color: var(--color-text-secondary); }');
  } else {
    passOutput('S10', '分页器/更多操作箭头颜色合理');
  }
}

// S11: 展开箭头尺寸（应为16x16）
{
  const expandSmall = grepLines(lines, /sidebar-menu-expand[^}]*width:\s*1[0-3]px|expand[^}]*icon[^}]*width:\s*1[0-3]px/);
  if (expandSmall.length > 0) {
    failOutput('S11', '展开箭头尺寸错误（应为16×16）',
      fmt(expandSmall),
      '.sidebar-menu-expand .icon { width: 16px !important; height: 16px !important; }');
  } else {
    passOutput('S11', '展开箭头尺寸正确（16×16）');
  }
}

// S12: 左侧菜单展开箭头方向（应为 chevron-down，不是 chevron-right）
{
  let inExpand = false;
  const wrong = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/sidebar-menu-expand/.test(l)) inExpand = true;
    if (inExpand && /chevron-right/.test(l)) wrong.push(`${i + 1}: ${l}`);
    if (inExpand && /<\/svg>/.test(l)) inExpand = false;
  }
  if (wrong.length > 0) {
    failOutput('S12', '左侧菜单展开箭头使用了 chevron-right（应改为 chevron-down）',
      wrong.join('\n'),
      '将 .sidebar-menu-expand 内的 #icon-chevron-right 替换为 #icon-chevron-down；展开/收起状态由 CSS .sidebar-menu-item.expanded .sidebar-menu-expand { transform: rotate(-90deg); } 控制（分页器"下一页"/面包屑分隔等场景的 chevron-right 为合法使用，不在本项检测范围）');
  } else {
    passOutput('S12', '左侧菜单展开箭头方向正确（使用 chevron-down）');
  }
}

if (QUIET === 0) console.log('');

// ================================================
// 第三组：导航栏 (S13-S19)
// ================================================
if (QUIET === 0) console.log('--- 导航栏 (S13-S19) ---');

// S13: 顶导高度
{
  const heightMatches = [...content.matchAll(/\.(?:top-nav|header-nav|nav-bar)[^{]*height:\s*\d+px/g)].map((m) => m[0]);
  const heightBad = heightMatches.filter((s) => !s.includes('42px'));
  if (heightBad.length > 0) {
    failOutput('S13', '顶部导航栏高度非42px',
      heightBad.join('\n'),
      '.top-nav, .header-nav { height: 42px !important; }');
  } else {
    const heightOk = /(?:top-nav|header-nav|nav-bar)[^}]*height:\s*42px/.test(content);
    if (heightOk) {
      passOutput('S13', '顶部导航栏高度正确（42px）');
    } else {
      warnOutput('S13', '未明确检测到导航栏高度定义', '可能通过其他方式控制', '确认高度为42px');
    }
  }
}

// S14: 顶导菜单项高度控制
{
  const paddingOnly = grepLines(lines, /nav-menu-item[^}]*padding:[^}]*\}/)
    .filter((m) => !/height:\s*100%/.test(m.text))
    .slice(0, 2);
  if (paddingOnly.length > 0) {
    warnOutput('S14', '顶导菜单项可能仅用 padding 控制高度',
      fmt(paddingOnly),
      '.nav-menu-item { height: 100% !important; align-items: stretch !important; }');
  } else {
    passOutput('S14', '顶导菜单项高度控制方式正确');
  }
}

// S15: 顶导菜单项圆角
{
  const navRadius = grepLines(lines, /nav-menu-item[^}]*border-radius:\s*[1-9]/);
  if (navRadius.length > 0) {
    failOutput('S15', '顶导菜单项不应有圆角',
      fmt(navRadius),
      '.nav-menu-item { border-radius: 0 !important; }');
  } else {
    passOutput('S15', '顶导菜单项圆角正确（无圆角）');
  }
}

// S16: 顶导右侧功能区容器
{
  const hasTopNavRight = countLines(lines, /class="top-nav-right"/);
  const iconsOutside = grepLines(lines, /top-nav.*(user|notification|settings).*icon/)
    .filter((m) => !m.text.includes('top-nav-right'))
    .slice(0, 2);
  if (hasTopNavRight === 0 && iconsOutside.length > 0) {
    warnOutput('S16', '顶导右侧功能区未包裹在 top-nav-right 容器中',
      fmt(iconsOutside),
      '用 <div class="top-nav-right"> 包裹右侧图标元素');
  } else {
    passOutput('S16', '顶导右侧功能区结构正确');
  }
}

// S17: 侧边宽度
{
  const widthMatches = [...content.matchAll(/\.sidebar[^{]*width:\s*\d+px/g)].map((m) => m[0]);
  const sidebarWidth = widthMatches[0] || '';
  if (!sidebarWidth.includes('180px')) {
    if (sidebarWidth) {
      failOutput('S17', '左侧菜单宽度非180px',
        sidebarWidth,
        '.sidebar { width: 180px !important; }');
    } else {
      warnOutput('S17', '未检测到明确的侧边宽度定义',
        '请确认 sidebar width = 180px',
        '.sidebar { width: 180px; }');
    }
  } else {
    passOutput('S17', '左侧菜单宽度正确（180px）');
  }
}

// S18: 侧边菜单内边距
{
  const pad16 = grepLines(lines, /sidebar-menu-item[^}]*padding:\s*0\s+16px|sidebar-menu-item[^}]*padding:\s*16px/);
  if (pad16.length > 0) {
    failOutput('S18', '侧边菜单项内边距为16px（应为12px）',
      fmt(pad16),
      '.sidebar-menu-item { padding: 0 12px !important; }');
  } else {
    passOutput('S18', '侧边菜单项内边距正确（0 12px）');
  }
}

// S19: 侧边菜单字重
{
  const weight600 = grepLines(lines, /sidebar-menu-item[^}]*font-weight:\s*600/);
  if (weight600.length > 0) {
    failOutput('S19', '侧边菜单项字重为600（应为400）',
      fmt(weight600),
      '.sidebar-menu-item { font-weight: 400 !important; }');
  } else {
    passOutput('S19', '侧边菜单项字重正确（400）');
  }
}

if (QUIET === 0) console.log('');

// ================================================
// 第四组：表格与操作列 (S20-S25)
// ================================================
if (QUIET === 0) console.log('--- 表格与操作列 (S20-S25) ---');

// S20: 操作列按钮形式（2选1：纯图标或纯文字，默认纯文字；禁止图标+文字混用）
{
  // 步骤1：action-col|action-links 行及后2行（带行号）
  const step1 = [];
  for (let i = 0; i < lines.length; i++) {
    if (/action-col|action-links/.test(lines[i])) {
      for (let j = i; j < Math.min(i + 3, lines.length); j++) step1.push({ no: j + 1, text: lines[j] });
    }
  }
  // 步骤2：其中 link-btn 行及后1行
  const step2 = [];
  for (let i = 0; i < step1.length; i++) {
    if (/class="[^"]*link-btn[^"]*"/.test(step1[i].text)) {
      step2.push(step1[i]);
      if (i + 1 < step1.length) step2.push(step1[i + 1]);
    }
  }
  // 步骤3/4：含 <use href= 且非 icon-more
  const mixed = step2.filter((m) => m.text.includes('<use href=') && !m.text.includes('icon-more')).slice(0, 3);
  if (mixed.length > 0) {
    failOutput('S20', '操作列按钮图标+文字混用（应为纯图标或纯文字，默认纯文字）',
      fmt(mixed),
      '删除 .link-btn 中的 <svg><use> 部分，仅保留文字；或改为纯图标（删除文字保留svg）');
  } else {
    passOutput('S20', '操作列按钮形式正确（纯图标或纯文字，默认纯文字；更多按钮允许 ··· 图标）');
  }
}

// S21: 操作列 Hover 背景
{
  const hoverCtx = afterLines(/link-btn:hover|action-links.*a:hover|\.link-btn:hover/, 3);
  const hoverBg = hoverCtx.filter((l) => /background/.test(l)).slice(0, 2);
  if (hoverBg.length > 0) {
    failOutput('S21', '操作列 hover 有背景色（应仅变色无背景）',
      hoverBg.join('\n'),
      '.link-btn:hover { background: none !important; color: var(--color-primary-hover) !important; }');
  } else {
    passOutput('S21', '操作列 hover 正确（仅变色无背景）');
  }
}

// S22: 操作列 Active 态
{
  const active = grepLines(lines, /link-btn:active/);
  if (active.length === 0) {
    warnOutput('S22', '操作列缺少 :active 态定义（三态不完整）',
      '仅找到 :hover 但未找到 :active',
      '.link-btn:active { color: var(--color-primary-active) !important; }');
  } else {
    passOutput('S22', '操作列 :active 态已定义（三态完整）');
  }
}

// S23: 操作列 Padding
{
  const padding = grepLines(lines, /link-btn[^{]*padding:\s*[1-9]/).slice(0, 2);
  if (padding.length > 0) {
    failOutput('S23', '操作列按钮有内边距（应为 padding: 0）',
      fmt(padding),
      '.link-btn { padding: 0 !important; }');
  } else {
    passOutput('S23', '操作列按钮 padding 正确（0）');
  }
}

// S24: 操作列间距
{
  const gapMatches = [...content.matchAll(/action-links[^{]*gap:\s*\d+px/g)].map((m) => m[0]);
  const actionGap = gapMatches[0] || '';
  if (actionGap) {
    if (!/gap:\s*12px/.test(actionGap)) {
      failOutput('S24', '操作列间距非12px',
        actionGap,
        '.action-links { gap: 12px !important; }');
    } else {
      passOutput('S24', '操作列间距正确（12px）');
    }
  } else {
    const margin = grepLines(lines, /action-links.*margin|link-btn.*margin/).slice(0, 2);
    if (margin.length > 0) {
      warnOutput('S24', '操作列使用 margin 控制间距（建议改用 gap: 12px）',
        fmt(margin),
        '.action-links { display: flex; gap: 12px !important; }');
    } else {
      passOutput('S24', '操作列间距正确（gap: 12px 或等效值）');
    }
  }
}

// S25: 排序图标尺寸（CSS border三角形，底4px高5px）
{
  const sortBad = grepLines(lines, /arrow-up[^{]*border-bottom:\s*[6-9]px|arrow-up[^{]*border-bottom:\s*\d{2}px|arrow-down[^{]*border-top:\s*[6-9]px|arrow-down[^{]*border-top:\s*\d{2}px|arrow-up[^{]*border-left:\s*[5-9]px|arrow-up[^{]*border-right:\s*[5-9]px|arrow-down[^{]*border-left:\s*[5-9]px|arrow-down[^{]*border-right:\s*[5-9]px/);
  if (sortBad.length > 0) {
    failOutput('S25', '排序箭头尺寸非标准值（应为底4px高5px）',
      fmt(sortBad),
      '.sort-icon .arrow-up, .sort-icon .arrow-down { border-left: 4px solid transparent; border-right: 4px solid transparent; } .sort-icon .arrow-up { border-bottom: 5px solid var(--color-text-secondary); } .sort-icon .arrow-down { border-top: 5px solid var(--color-text-secondary); }');
  } else {
    passOutput('S25', '排序箭头尺寸正确（底4px高5px CSS border三角形）');
  }
}

if (QUIET === 0) console.log('');

// ================================================
// 第五组：查询栏与表单 (S26-S31)
// ================================================
if (QUIET === 0) console.log('--- 查询栏与表单 (S26-S31) ---');

// S26: 查询栏背景色
{
  const queryBg = grepLines(lines, /query-bar[^}]*background[^}]*#F4F7F9|query-bar[^}]*background[^}]*bg-header/);
  const queryBgVar = grepLines(lines, /query-bar[^}]*background:\s*var\(--color-bg-header\)/);
  if (queryBg.length > 0 || queryBgVar.length > 0) {
    failOutput('S26', '查询栏背景色错误（用了表头色 #F4F7F9，应为白色）',
      fmt([...queryBg, ...queryBgVar]),
      '.query-bar { background: #FFFFFF !important; }');
  } else {
    passOutput('S26', '查询栏背景色正确（#FFFFFF 白色）');
  }
}

// S27: 查询标签宽度
{
  const widthBad = grepLines(lines, /query-item[^}]*label[^}]*width:\s*(auto|80|100)[^0-9px]|query-item\s*>\s*label[^}]*width:\s*(auto|80|100)[^0-9px]/);
  const widthEm = grepLines(lines, /query-item.*label.*width:\s*\d*em/);
  if (widthBad.length > 0 || widthEm.length > 0) {
    failOutput('S27', '查询标签宽度非72px',
      fmt([...widthBad, ...widthEm]),
      '.query-item > label { width: 72px !important; min-width: 72px !important; }');
  } else {
    passOutput('S27', '查询标签宽度正确（72px）');
  }
}

// S28: 下拉选择器箭头实现
{
  const cssTriangle = grepLines(lines, /select.*arrow.*border.*solid.*transparent|\.select-arrow.*border-width/);
  if (cssTriangle.length > 0) {
    failOutput('S28', '下拉选择器使用 CSS border 三角（应改为 SVG chevron-down）',
      fmt(cssTriangle),
      '删除 CSS border 三角代码，替换为: <svg class="icon"><use href="#icon-chevron-down"></use></svg>');
  } else {
    passOutput('S28', '下拉选择器箭头实现正确（SVG chevron-down）');
  }
}

// S29: Tab 关闭图标
{
  const tabClose = grepLines(lines, /tab-close.*circle-remove|tab.*close.*<use.*remove/);
  if (tabClose.length > 0) {
    failOutput('S29', 'Tab关闭图标使用 SVG circle-remove（应改为 CSS 伪元素 X）',
      fmt(tabClose),
      '.tab-close::after { content: "×"; font-size: 14px; line-height: 1; }');
  } else {
    passOutput('S29', 'Tab关闭图标实现正确（CSS 伪元素）');
  }
}

// S30: 输入框边框色
{
  const borderBad = grepLines(lines, /input-field[^}]*border.*:(\s*1px\s+)?(solid\s+)?#(ccc|e0e0e0|ddd|[0-9a-fA-F]{3,6})/)
    .filter((m) => !/D2D7E1|var\(/.test(m.text))
    .slice(0, 2);
  if (borderBad.length > 0) {
    warnOutput('S30', '输入框边框色可能非规范值 #D2D7E1',
      fmt(borderBad),
      '.input-field { border: 1px solid var(--color-bg-border) !important; }');
  } else {
    passOutput('S30', '输入框边框色正确（#D2D7E1）');
  }
}

// S31: 输入框高度
{
  const heightBad = grepLines(lines, /input-field[^}]*height:\s*(32|36|40|48)px/);
  if (heightBad.length > 0) {
    failOutput('S31', '输入框高度非28px',
      fmt(heightBad),
      '.input-field { height: 28px !important; }');
  } else {
    passOutput('S31', '输入框高度正确（28px）');
  }
}

// S42: 查询栏换行间距（QB-6: row-gap: 12px + flex-wrap: wrap）
{
  const queryWrap = grepLines(lines, /\.query-bar[^{]*\{[^}]*flex-wrap:\s*wrap/);
  const queryRowGap = grepLines(lines, /\.query-bar[^{]*\{[^}]*row-gap:\s*12px/);
  if (queryWrap.length === 0 && queryRowGap.length === 0) {
    if (content.includes('query-bar')) {
      failOutput('S42', '查询栏缺少换行间距设置（需 flex-wrap: wrap + row-gap: 12px）',
        '未检测到 flex-wrap: wrap 或 row-gap: 12px',
        '.query-bar { flex-wrap: wrap; row-gap: 12px; }');
    } else {
      passOutput('S42', '未检测到查询栏（非列表页可忽略）');
    }
  } else if (queryWrap.length === 0) {
    failOutput('S42', '查询栏缺少 flex-wrap: wrap（无法换行）',
      fmt(queryRowGap),
      '.query-bar { flex-wrap: wrap; }');
  } else if (queryRowGap.length === 0) {
    failOutput('S42', '查询栏换行间距非12px（缺少 row-gap 定义）',
      fmt(queryWrap),
      '.query-bar { row-gap: 12px; }');
  } else {
    passOutput('S42', '查询栏换行间距正确（flex-wrap: wrap + row-gap: 12px）');
  }
}

// S43: 查询栏按钮区等分布局（QB-5: flex:1 而非 margin-left:auto）
{
  const marginAuto = grepLines(lines, /\.query-actions[^{]*\{[^}]*margin-left:\s*auto/);
  const flexOne = grepLines(lines, /\.query-actions[^{]*\{[^}]*flex:\s*1/);
  if (marginAuto.length > 0) {
    failOutput('S43', '查询栏按钮区使用 margin-left:auto（应改为 flex:1 等分布局）',
      fmt(marginAuto),
      '.query-actions { flex: 1; justify-content: flex-end; }（删除 margin-left: auto）');
  } else if (flexOne.length > 0) {
    passOutput('S43', '查询栏按钮区等分布局正确（flex:1）');
  } else if (content.includes('query-actions')) {
    warnOutput('S43', '查询栏按钮区未明确使用 flex:1 等分布局',
      '未检测到 flex:1 或 margin-left:auto',
      '.query-actions { flex: 1; justify-content: flex-end; }');
  } else {
    passOutput('S43', '未检测到查询栏按钮区（非列表页可忽略）');
  }
}

// S44: 查询栏按钮区右对齐（QB-7: justify-content: flex-end）
{
  const jc = grepLines(lines, /\.query-actions[^{]*\{[^}]*justify-content:\s*flex-end/);
  if (jc.length > 0) {
    passOutput('S44', '查询栏按钮区右对齐正确（justify-content: flex-end）');
  } else if (content.includes('query-actions')) {
    failOutput('S44', '查询栏按钮区未右对齐（缺少 justify-content: flex-end）',
      '未检测到 justify-content: flex-end',
      '.query-actions { justify-content: flex-end; }');
  } else {
    passOutput('S44', '未检测到查询栏按钮区（非列表页可忽略）');
  }
}

// S45: 查询栏布局注释含按钮区（QB-4: 注释格式 (N查询条件 + M按钮区)）
{
  const comment = grepLines(lines, /<!--.*查询栏.*-->/);
  const hasBtn = comment.some((m) => /按钮区|按钮/.test(m.text));
  if (comment.length > 0) {
    if (hasBtn) {
      passOutput('S45', '查询栏布局注释含按钮区说明');
    } else {
      warnOutput('S45', '查询栏布局注释未包含按钮区说明',
        fmt(comment),
        '注释格式应为: <!-- 查询栏 - N列模式：M查询条件 + 1按钮区 -->');
    }
  } else {
    passOutput('S45', '未检测到查询栏注释（无查询栏可忽略）');
  }
}

// S46: 查询栏全行统一列数 + 多行结构检测（QB-8/QB-9）
{
  const layout3 = countLines(lines, /<!--.*3\s*列|<!--.*3列/);
  const layout4 = countLines(lines, /<!--.*4\s*列|<!--.*4列/);
  let s46Detail = '';
  let s46Fix = '';
  let colsPerRow = 4;

  // 检测1：注释混用
  if (layout3 > 0 && layout4 > 0) {
    s46Detail = '同时检测到3列和4列布局注释';
    s46Fix = '统一为相同列数模式（全部3列或全部4列）';
  }

  // 检测2 & 3：.query-row 多行结构检测
  const rowCount = countLines(lines, /class="query-row"/);
  if (rowCount > 1) {
    colsPerRow = layout3 > 0 && layout4 === 0 ? 3 : 4;
    const itemCount = countLines(lines, /class="query-item"/);
    const actionsCount = countLines(lines, /class="query-actions"/);
    const totalChildren = itemCount + actionsCount;
    const expectedChildren = rowCount * colsPerRow;
    if (totalChildren !== expectedChildren) {
      const d = `共 ${rowCount} 行，子元素总数 ${totalChildren}（预期 ${expectedChildren}：${itemCount} query-item + ${actionsCount} actions，${colsPerRow}列模式）`;
      s46Detail = s46Detail ? `${s46Detail}; ${d}` : d;
      const f = `确保每个 .query-row 有${colsPerRow}个子元素（末行不足用 visibility:hidden 占位补齐至${colsPerRow - 1}个 + 按钮区1个）`;
      s46Fix = s46Fix ? `${s46Fix}; ${f}` : f;
    }
    // 检测3：.query-actions 是否在最后一个 .query-row 内（行号比较）
    const rowLineNos = grepLines(lines, /class="query-row"/).map((m) => m.no);
    const actionsLineNos = grepLines(lines, /class="query-actions"/).map((m) => m.no);
    const lastRowLine = rowLineNos[rowLineNos.length - 1];
    const actionsLine = actionsLineNos[0];
    if (actionsLine != null && lastRowLine != null && actionsLine < lastRowLine) {
      const d = `.query-actions 在第 ${actionsLine} 行，最后一个 .query-row 在第 ${lastRowLine} 行（按钮区应在末行内）`;
      s46Detail = s46Detail ? `${s46Detail}; ${d}` : d;
      const f = '将 .query-actions 移至最后一个 .query-row 内的末尾位置';
      s46Fix = s46Fix ? `${s46Fix}; ${f}` : f;
    }
  }

  if (s46Detail) {
    failOutput('S46', '查询栏布局不一致（QB-8/QB-9）', s46Detail, s46Fix);
  } else if (rowCount > 1) {
    passOutput('S46', `查询栏多行结构一致（${rowCount} 行，每行${colsPerRow}列，按钮区在末行）`);
  } else if (content.includes('query-bar')) {
    passOutput('S46', '查询栏列数统一（未发现混用）');
  } else {
    passOutput('S46', '未检测到查询栏（非列表页可忽略）');
  }
}

if (QUIET === 0) console.log('');

// ================================================
// 第六组：按钮与交互 (S32-S36)
// ================================================
if (QUIET === 0) console.log('--- 按钮与交互 (S32-S36) ---');

// S32: 按钮 hover 图标不变色问题（检测是否有 !important 覆盖）
{
  const hoverCtx = afterLines(/:hover/, 2);
  const noImportant = hoverCtx
    .filter((l) => /btn-(primary|secondary|danger|link):hover/.test(l))
    .filter((l) => l.includes('svg'))
    .filter((l) => !l.includes('!important'))
    .slice(0, 2);
  if (noImportant.length > 0) {
    warnOutput('S32', '按钮 hover 规则可能缺少 !important（图标可能不变色）',
      noImportant.join('\n'),
      '在所有 btn-*:hover svg 规则中添加 !important');
  } else {
    passOutput('S32', '按钮 hover 图标覆盖规则正确（含 !important）');
  }
}

// S33: 设置按钮边框
{
  const b1 = grepLines(lines, /settings.*btn[^}]*border:\s*(none|0)?\s*[^}]+/)
    .filter((m) => !/border:\s*none|border:\s*0/.test(m.text))
    .slice(0, 2);
  const b2 = grepLines(lines, /btn-settings[^}]*border:\s*[1-9]/);
  if (b1.length > 0 || b2.length > 0) {
    failOutput('S33', '设置按钮有边框（应无边框）',
      fmt([...b1, ...b2]),
      '.btn-settings, .card-header .settings-btn { border: none !important; }');
  } else {
    passOutput('S33', '设置按钮无边框（符合规范）');
  }
}

// S34: fill 硬编码色（三级色值策略，与 S40 一致）
{
  const fillHc = grepLines(lines, /fill="#/)
    .filter((m) => !/currentColor|var\(--/.test(m.text))
    .slice(0, 10);
  if (fillHc.length > 0) {
    const unknown = fillHc.filter((m) => {
      const hexMatch = m.text.match(/#[0-9A-Fa-f]{3,8}/);
      return !hexMatch || !isKnownHex(hexMatch[0].slice(1));
    });
    if (unknown.length > 0) {
      const classified = unknown.map((m) => ({ scene: classifyColorScene(`${m.no}: ${m.text}`, contextAround(lines, m.no)), m }));
      const clear = classified.filter((x) => x.scene === 'clear').map((x) => x.m);
      const amb = classified.filter((x) => x.scene === 'ambiguous').map((x) => x.m);
      const chart = classified.filter((x) => x.scene === 'chart').map((x) => x.m);
      if (clear.length > 0) {
        failOutput('S34', `存在 ${clear.length} 处非规范 fill 色值（Logo/UI 场景，必须修正）`,
          fmt(clear, 3),
          '这些 fill 颜色用于 Logo/UI 组件，需替换为 design-tokens.css 中定义的色值');
      } else if (amb.length > 0) {
        warnOutput('S34', `存在 ${amb.length} 处非规范 fill 色值（场景模糊，请确认）`,
          fmt(amb, 3),
          '如为图表/多数据场景可保留；如为 UI 组件需替换为 design-tokens 色值');
      } else if (chart.length > 0) {
        infoOutput('S34', `图表/多数据场景使用 ${chart.length} 处非规范 fill 色值（允许，多色区分需求）`);
      }
    } else {
      passOutput('S34', 'fill 硬编码色值全部匹配 design-tokens 色板（色值正确，var() 形式可选）');
    }
  } else {
    passOutput('S34', '无 fill 硬编码颜色残留');
  }
}

// S35: 复选框 accent-color
{
  const accent = grepLines(lines, /accent-color/);
  if (accent.length > 0) {
    failOutput('S35', '使用 accent-color 实现复选框（应使用自定义 checkbox）',
      fmt(accent),
      '移除 accent-color，使用 design-tokens.css 中预定义的自定义 checkbox 样式');
  } else {
    passOutput('S35', '复选框实现方式正确（自定义样式）');
  }
}

// S36: 弹窗关闭按钮
{
  const modalClose = grepLines(lines, /modal-close|modal.*close/).slice(0, 2);
  if (modalClose.length > 0) {
    // 对 modal-close 匹配行取前1后3行，检查定位样式
    const closeNos = grepLines(lines, /modal-close/).map((m) => m.no);
    let posOk = false;
    for (const no of closeNos) {
      const ctx = lines.slice(Math.max(0, no - 2), no + 3);
      if (ctx.some((l) => /position:\s*absolute|right:\s*|top:\s*/.test(l))) { posOk = true; break; }
    }
    if (!posOk) {
      warnOutput('S36', '弹窗关闭按钮位置可能非右上角',
        fmt(modalClose),
        '确保关闭按钮 position: absolute; right: 12px; top: 12px;');
    } else {
      passOutput('S36', '弹窗关闭按钮位置正确（右上角）');
    }
  } else {
    passOutput('S36', '未检测到弹窗关闭按钮（无弹窗可忽略）');
  }
}

if (QUIET === 0) console.log('');

// ================================================
// 第七组：布局与技术原则 (S37-S41)
// ================================================
if (QUIET === 0) console.log('--- 布局与技术原则 (S37-S41) ---');

// S37: transform scale 布局
{
  const scale = grepLines(lines, /transform:\s*scale/);
  if (scale.length > 0) {
    failOutput('S37', '使用 transform: scale() 做布局（应改用 fixed + margin）',
      fmt(scale),
      '删除 transform: scale()，改用 position: fixed + margin-left/margin-top 偏移方案');
  } else {
    passOutput('S37', '布局方式正确（未使用 transform: scale）');
  }
}

// S38: overflow-x hidden
{
  const overflow = grepLines(lines, /(body|html)[^{]*overflow-x:\s*hidden/);
  if (overflow.length > 0) {
    failOutput('S38', 'body/html 设置了 overflow-x: hidden（会导致横向滚动失效）',
      fmt(overflow),
      '删除 body/html 上的 overflow-x: hidden；确保 .table-container { overflow-x: auto; }');
  } else {
    passOutput('S38', 'overflow 设置正确（body/html 无 overflow-x: hidden）');
  }
}

// S39: 非标准圆角
{
  const radii = new Set();
  for (const m of content.matchAll(/border-radius:\s*\d+px/g)) {
    if (!/(0|2|4|8|12|16)px/.test(m[0])) radii.add(m[0]);
  }
  const badRadii = [...radii].slice(0, 5);
  if (badRadii.length > 0) {
    warnOutput('S39', '发现非标准圆角值（规范值: 0/2/4/8/12/16px 或变量）',
      badRadii.join('\n'),
      '将非常规值替换为最近的规范值或 var(--radius-rX)');
  } else {
    passOutput('S39', '圆角值全部符合规范');
  }
}

// S40: 高频颜色硬编码（三级色值策略）
{
  const hardcoded = grepLines(lines, /(color|background(-color)?|fill|stroke):\s*#[0-9a-fA-F]{3,8}\s*;/)
    .filter((m) => !/var\(--|currentColor|\/\*|\*\//.test(m.text))
    .slice(0, 15);
  if (hardcoded.length > 0) {
    const unknown = hardcoded.filter((m) => {
      const hexMatch = m.text.match(/#[0-9a-fA-F]{3,8}/);
      return !hexMatch || !isKnownHex(hexMatch[0].slice(1));
    });
    const knownCount = hardcoded.length - unknown.length;
    if (unknown.length > 0) {
      const classified = unknown.map((m) => {
        const isCssRuleLine = /^\s*\d+:\s*\./.test(`${m.no}: ${m.text}`);
        return { scene: classifyColorScene(`${m.no}: ${m.text}`, contextAround(lines, m.no), isCssRuleLine), m };
      });
      const clear = classified.filter((x) => x.scene === 'clear').map((x) => x.m);
      const amb = classified.filter((x) => x.scene === 'ambiguous').map((x) => x.m);
      const chart = classified.filter((x) => x.scene === 'chart').map((x) => x.m);

      if (clear.length > 0) {
        failOutput('S40', `发现 ${clear.length} 处非规范色值（主题色/文字色/中性色场景，必须修正）`,
          fmt(clear, 3),
          '这些颜色用于 UI 组件（按钮/文字/背景等），需替换为 design-tokens.css 中定义的色值');
      } else if (amb.length > 0) {
        warnOutput('S40', `发现 ${amb.length} 处非规范色值（场景模糊，请确认是否需要修正）`,
          fmt(amb, 3),
          '如为多数据/多图表场景可保留；如为 UI 组件色值需替换为 design-tokens 色值');
      } else if (chart.length > 0) {
        infoOutput('S40', `图表/多数据场景使用 ${chart.length} 处非规范色值（允许，多色区分需求）`);
      }

      // 补充输出图表/模糊场景的详情（quiet 模式下也输出 WARN/FAIL）
      if (QUIET === 0 && chart.length > 0) {
        console.log('  [INFO] 图表场景非规范色值（允许保留）:');
        chart.slice(0, 3).forEach((m) => console.log(`    ${m.no}: ${m.text}`));
      }
      if (QUIET === 0 && amb.length > 0 && clear.length === 0) {
        console.log('  [INFO] 模糊场景非规范色值（请确认）:');
        amb.slice(0, 3).forEach((m) => console.log(`    ${m.no}: ${m.text}`));
      }
    } else if (knownCount > 0) {
      passOutput('S40', `硬编码色值全部匹配 design-tokens 色板（${knownCount} 处色值正确，var() 形式可选）`);
    }
  } else {
    passOutput('S40', '颜色值均使用 CSS 变量（无硬编码）');
  }
}

// S41: 非标准类名（抽样检测）
{
  const customClasses = new Set();
  for (const m of content.matchAll(/class="(toolbar-left|my-|custom-|tmp-)[^"]*"/g)) customClasses.add(m[0]);
  const custom = [...customClasses].slice(0, 5);
  if (custom.length > 0) {
    warnOutput('S41', '发现疑似非标准自定义类名',
      custom.join('\n'),
      '对照 components/*.md 确认是否需替换为标准类名');
  } else {
    passOutput('S41', '类名命名符合规范（未发现明显违规）');
  }
}

if (QUIET === 0) console.log('');

// ================================================
// 第七组：内容区大卡片合规 (S47-S49) — cards.md v5.0
// ================================================
if (QUIET === 0) console.log('--- 内容区大卡片 (S47-S49) ---');

// 收集 .page-card 规则块（匹配行 + 后 20 行，等价 grep -A 20）
const pageCardBlock = [];
for (let i = 0; i < lines.length; i++) {
  if (/\.page-card\s*\{/.test(lines[i])) pageCardBlock.push(...lines.slice(i, i + 21));
}

// S47: 内容区大卡片(.page-card)禁用阴影
{
  const shadowBad = [];
  pageCardBlock.forEach((l, idx) => {
    if (/box-shadow\s*:\s*(var\(--shadow|0 \d|rgba\(|#[0-9a-fA-F]{3,8})/.test(l)) shadowBad.push(`${idx + 1}: ${l}`);
  });
  if (shadowBad.length > 0) {
    failOutput('S47', '内容区大卡片(.page-card)使用了阴影（禁止）',
      shadowBad.join('\n'),
      '.page-card { box-shadow: none !important; }（详见 cards.md v5.0 场景一）');
  } else {
    passOutput('S47', '内容区大卡片(.page-card)未使用阴影（符合规范）');
  }
}

// S48: 内容区大卡片(.page-card)禁用边框
{
  const borderBad = [];
  pageCardBlock.forEach((l, idx) => {
    if (/border\s*:\s*\d+px|border\s*:\s*solid|border\s*:\s*1px/.test(l)) borderBad.push(`${idx + 1}: ${l}`);
  });
  if (borderBad.length > 0) {
    failOutput('S48', '内容区大卡片(.page-card)使用了边框（禁止）',
      borderBad.join('\n'),
      '.page-card { border: none !important; }（详见 cards.md v5.0 场景一）');
  } else {
    passOutput('S48', '内容区大卡片(.page-card)未使用边框（符合规范）');
  }
}

// S49: 禁止使用 .content-card / .detail-card 等废弃类名变体
{
  const deprecated = grepLines(lines, /class="[^"]*(content-card|detail-card|panel-card)[^"]*"/).slice(0, 5);
  if (deprecated.length > 0) {
    failOutput('S49', '使用了废弃的大卡片类名变体（应统一为 .page-card）',
      fmt(deprecated),
      '将 class="content-card/detail-card/panel-card" 全局替换为 class="page-card"（详见 cards.md v5.0）');
  } else {
    passOutput('S49', '未使用废弃的大卡片类名变体（符合规范）');
  }
}

// S50: 页面标题栏必须在 .page-card 内部（v5.1 内容包裹规则）
{
  const pageCardLine = firstMatchLine(lines, /class="page-card"|class="[^"]*page-card[^"]*"/);
  const titleLine = firstMatchLine(lines, /class="page-title-bar"|class="[^"]*page-title-bar[^"]*"|class="page-title"|class="[^"]*page-title[^"]*"/);
  if (pageCardLine != null && titleLine != null) {
    if (titleLine < pageCardLine) {
      failOutput('S50', '页面标题栏写在了 .page-card 外面（违反内容包裹规则）',
        `标题出现在第 ${titleLine} 行，.page-card 出现在第 ${pageCardLine} 行（标题应在卡片之后）`,
        '将 .page-title-bar 整体移入 <div class="page-card"> 内部作为第一个子元素（详见 cards.md v5.1 内容包裹规则）');
    } else {
      passOutput('S50', '页面标题栏位于 .page-card 内部（符合内容包裹规则）');
    }
  } else {
    passOutput('S50', '未检测到标题栏/卡片容器组合（本项不适用）');
  }
}

if (QUIET === 0) console.log('');

// ================================================
// 第八组：弹窗与操作列合规 (S51-S53)
// ================================================
if (QUIET === 0) console.log('--- 弹窗与操作列 (S51-S53) ---');

// S51: .modal 最小高度检查
{
  if (/\.modal\s*\{/.test(content)) {
    // 提取 .modal 规则块（匹配行 + 后30行，到第一个 ^\s*} 为止，不含 } 行）
    const block = [];
    for (let i = 0; i < lines.length; i++) {
      if (/\.modal\s*\{/.test(lines[i])) {
        for (let j = i; j < Math.min(i + 31, lines.length); j++) {
          if (j > i && /^\s*\}/.test(lines[j])) break;
          block.push(lines[j]);
        }
        break;
      }
    }
    const blockText = block.join('\n');
    const minheightOk = /min-height\s*:\s*(calc\()?36vh/.test(blockText);
    if (minheightOk) {
      passOutput('S51', '.modal 最小高度符合规范（min-height: 36vh）');
    } else {
      const minheightOther = block.filter((l) => /min-height\s*:/.test(l));
      if (minheightOther.length > 0) {
        failOutput('S51', '.modal 最小高度非 36vh',
          minheightOther.join('\n'),
          '.modal { min-height: 36vh; }（若需抵消 zoom 放大：min-height: calc(36vh / var(--zoom-value, 1));）');
      } else {
        failOutput('S51', '.modal 缺少 min-height: 36vh 定义',
          '未在 .modal 规则块中找到 min-height',
          '.modal { min-height: 36vh; }（若需抵消 zoom 放大：min-height: calc(36vh / var(--zoom-value, 1));）');
      }
    }
  } else {
    passOutput('S51', '未检测到 .modal（无弹窗可忽略）');
  }
}

// S52: 列表页 .action-bar 内不应出现 .btn-primary
{
  const primaryCss = grepLines(lines, /\.action-bar\s+\.btn-primary|\.action-bar\s*>\s*\.btn-primary|action-bar.*\.btn-primary\s*[{:.,]/).slice(0, 5);
  const actionBarLine = firstMatchLine(lines, /class="[^"]*action-bar[^"]*"/);
  let actionBarEndLine = '';
  if (actionBarLine != null) {
    let end = null;
    for (let i = actionBarLine; i < lines.length; i++) {
      if (i >= actionBarLine && /^ {4}<\/div>/.test(lines[i])) { end = i + 1; break; }
    }
    actionBarEndLine = end != null ? String(end) : String(actionBarLine + 80);
  }
  let primaryHtml = '';
  if (actionBarLine != null && actionBarEndLine) {
    const end = Number(actionBarEndLine);
    const found = [];
    for (let i = actionBarLine - 1; i < Math.min(end, lines.length); i++) {
      if (/class="[^"]*btn-primary[^"]*"/.test(lines[i])) found.push(`${i + 1}: ${lines[i]}`);
      if (found.length >= 5) break;
    }
    primaryHtml = found.join('\n');
  }

  if (primaryCss.length > 0 || primaryHtml) {
    let detail = '';
    if (primaryCss.length > 0) detail += `CSS规则: ${fmt(primaryCss)}; `;
    if (primaryHtml) detail += `HTML使用: ${primaryHtml}`;
    failOutput('S52', '列表页 .action-bar 内出现 .btn-primary（应统一用 .btn-default）',
      detail,
      '删除 .action-bar .btn-primary CSS 规则；将 .action-bar 内的按钮全部改为 .btn-default（新增/删除/编辑/导出等列表操作均为普通按钮）');
  } else if (actionBarLine != null) {
    passOutput('S52', '.action-bar 内未使用 .btn-primary（符合列表页操作按钮规范）');
  } else {
    passOutput('S52', '未检测到 .action-bar（非列表页可忽略）');
  }
}

// S53: .action-col 内"更多"按钮须含 #icon-more
{
  const moreBtnLines = grepLines(lines, /class="[^"]*more-action-btn[^"]*"/);
  if (moreBtnLines.length > 0) {
    const missing = [];
    for (const m of moreBtnLines) {
      const nearby = lines.slice(m.no - 1, m.no + 5).join('\n');
      if (!nearby.includes('#icon-more')) {
        missing.push(`第 ${m.no} 行: .more-action-btn 元素附近未找到 #icon-more`);
      }
      if (missing.length >= 5) break;
    }
    if (missing.length > 0) {
      failOutput('S53', '.action-col 内更多按钮未使用 #icon-more',
        missing.join('\n'),
        '将 .more-action-btn 内的图标替换为 <svg class="icon"><use href="#icon-more"></use></svg>（规范见 tables.md）');
    } else {
      passOutput('S53', '.action-col 内更多按钮含 #icon-more（符合规范）');
    }
  } else {
    passOutput('S53', '未检测到更多按钮 .more-action-btn（无操作列或操作项 ≤3 可忽略）');
  }
}

if (QUIET === 0) console.log('');

// ================================================
// 第九组：zoom 缩放与高度计算 (S54-S55)
// ================================================
if (QUIET === 0) console.log('--- zoom 缩放与高度计算 (S54-S55) ---');

// S54: 基于视口的高度计算须除以 zoom-value
{
  const wrong = grepLines(lines, /(height|min-height)\s*:\s*calc\([^)]*100vh/)
    .filter((m) => !m.text.includes('zoom-value'))
    .filter((m) => !/^\s*\/\//.test(m.text))
    .filter((m) => !m.text.includes('/*'));
  if (wrong.length > 0) {
    failOutput('S54', '基于视口的高度计算未除以 zoom-value',
      fmt(wrong),
      '将 calc(100vh - Xpx) 改为 calc(100vh / var(--zoom-value, 1) - Xpx - 1px)（100vh 除以 zoom，Xpx 不除，-1px 容差防止放大后底部截断）。注意：margin-top 等 px 偏移量不除以 zoom-value。详见 page-layout.md §2.4');
  } else {
    passOutput('S54', '基于视口的高度计算已正确除以 zoom-value（或未使用 100vh 计算）');
  }
}

// S55: flex 子元素 min-height:0 检测
if (isMpaPage === 1) {
  infoOutput('S55', 'MPA 页面：flex 布局在 common.css 中，请单独检测 common.css');
} else {
  const flexOneCount = countLines(lines, /flex\s*:\s*1/);
  const minHeightZeroCount = countLines(lines, /min-height\s*:\s*0/);
  if (flexOneCount === 0) {
    passOutput('S55', '未使用 flex:1 布局（本项不适用）');
  } else if (minHeightZeroCount >= 3) {
    passOutput('S55', `flex 子元素 min-height:0 设置充足（${minHeightZeroCount} 处）`);
  } else if (minHeightZeroCount >= 1) {
    warnOutput('S55', 'flex 子元素 min-height:0 设置偏少',
      `检测到 ${flexOneCount} 处 flex:1，但仅 ${minHeightZeroCount} 处 min-height:0（建议 ≥3 处）`,
      '为每个 flex:1 的子元素添加 min-height: 0；特别是 .main-content / #page-content / .page-card');
  } else {
    failOutput('S55', 'flex 子元素缺少 min-height:0（可能导致内容撑高）',
      `检测到 ${flexOneCount} 处 flex:1，但 0 处 min-height:0`,
      '为每个 flex:1 的子元素添加 min-height: 0；特别是 .main-content / #page-content / .page-card');
  }
}

if (QUIET === 0) console.log('');

// ================================================
// 第十组：分页组件样式 (S56)
// ================================================
if (QUIET === 0) console.log('--- 分页组件样式 (S56) ---');

// S56: 分页组件样式合规检测
{
  const paginationExists = countLines(lines, /\.page-btn|\.pagination-bar|\.pagination-wrapper/);
  if (paginationExists === 0) {
    passOutput('S56', '未检测到分页组件（非列表页/弹窗可忽略）');
  } else {
    let s56Fails = '';
    // 子检测1: 页码按钮高度应为 24px
    const btnHeight = lines.filter((l) => /\.page-btn\s*\{[^}]*height\s*:\s*\d+px/.test(l)).filter((l) => !l.includes('24px'));
    if (btnHeight.length > 0) s56Fails += '页码按钮高度非24px（规范：height: 24px）; ';

    // 子检测2: active 态应有主色背景
    const activeBlock = afterLines(/page-btn.*\.active/, 5);
    const activeBg = activeBlock.some((l) => /background-color\s*:\s*var\(--color-primary\)|background-color\s*:\s*#3685F2/.test(l));
    const activeExists = countLines(lines, /page-btn.*\.active/);
    if (activeExists > 0 && !activeBg) s56Fails += 'active 态未使用主色背景（规范：background-color: var(--color-primary)）; ';

    // 子检测3: 按钮间距应为 gap: 4px
    const pagGap = lines.filter((l) => /\.pagination(-controls)?\s*\{[^}]*gap\s*:\s*\d+px/.test(l)).filter((l) => !l.includes('4px'));
    if (pagGap.length > 0) s56Fails += '分页按钮间距非4px（规范：gap: 4px）; ';

    // 子检测4: 字号应为 12px (var(--font-size-sm))
    const btnFont = lines.filter((l) => /\.page-btn\s*\{[^}]*font-size\s*:\s*\d+px/.test(l)).filter((l) => !l.includes('12px'));
    if (btnFont.length > 0) s56Fails += '页码按钮字号非12px（规范：font-size: 12px 或 var(--font-size-sm)）; ';

    // 子检测5: disabled 态应有禁用样式
    const hasDisabled = lines.some((l) => /\.page-btn:disabled|\.page-btn.*:disabled/.test(l));
    if (!hasDisabled) s56Fails += '缺少 disabled 态样式（上一页/下一页首页末页时需要）; ';

    if (!s56Fails) {
      passOutput('S56', '分页组件样式符合规范（24px/主色active/gap:4px/12px/disabled）');
    } else {
      failOutput('S56', '分页组件样式存在偏差',
        s56Fails,
        '详见 REFERENCES/components/Pagination.md 第七节 CSS 样式');
    }
  }
}

if (QUIET === 0) console.log('');

// ================================================
// 第十一组：内容区大卡片外边距 (S57)
// ================================================
if (QUIET === 0) console.log('--- 内容区大卡片外边距 (S57) ---');

// S57: .page-card 禁止外边距检测（awk 状态机等价实现）
{
  const marginWrong = [];
  let inBlock = false;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/\.page-card\s*\{/.test(l)) inBlock = true;
    if (inBlock) {
      if (/margin\s*:\s*[1-9]|margin\s*:\s*calc|margin\s*:\s*var|margin\s*:\s*auto|margin-(top|bottom|left|right)\s*:\s*[1-9]|margin-(top|bottom|left|right)\s*:\s*calc|margin-(top|bottom|left|right)\s*:\s*var|margin-(top|bottom|left|right)\s*:\s*auto/.test(l)) {
        marginWrong.push(`${i + 1}: ${l}`);
      }
      if (/^\s*\}/.test(l)) inBlock = false;
    }
  }
  if (marginWrong.length > 0) {
    failOutput('S57', '.page-card 设置了外边距（应撑满 main-content，禁止 margin）',
      marginWrong.join('\n'),
      '删除 .page-card 规则块内的 margin / margin-bottom / margin-top 等属性（margin: 0 除外）。.page-card 作为 flex:1 子元素撑满 main-content，外边距会破坏高度链');
  } else {
    passOutput('S57', '.page-card 无外边距（撑满 main-content）');
  }
}

if (QUIET === 0) console.log('');

// ================================================
// 第十二组：选项卡/标签页 Tabs (S58-S62) — 对应 tabs.md v1.2.0
// ================================================
if (QUIET === 0) console.log('--- 选项卡/标签页 Tabs (S58-S62) ---');

const HAS_TABS = /class="tabs"|\.tabs[^-a-zA-Z]/.test(content) ? 1 : 0;
const HAS_TABS_NAV = /class="tabs-nav"|\.tabs-nav[^a-zA-Z]/.test(content) ? 1 : 0;
const HAS_TABS_FILTER = /class="tabs-filter"|\.tabs-filter[^a-zA-Z]/.test(content) ? 1 : 0;

// S58: .tabs 标准样式选中态必须有底部2px指示线
if (HAS_TABS === 1) {
  const activeBlock = afterLines(/\.tab-item\.is-active/, 8).join('\n');
  if (/border-bottom-color:\s*var\(--color-primary\)|border-bottom:\s*2px\s+solid\s+var\(--color-primary\)/.test(activeBlock)) {
    passOutput('S58', '.tabs 选中态含底部2px指示线（border-bottom 主题色）');
  } else {
    failOutput('S58', '.tabs 选中态缺少底部2px指示线（高频漏实现项）',
      '.tab-item.is-active 规则块未检测到 border-bottom-color: var(--color-primary) 或 border-bottom: 2px solid var(--color-primary)',
      '.tabs .tab-item { border-bottom: 2px solid transparent; } .tabs .tab-item.is-active { border-bottom-color: var(--color-primary); } （默认透明占位防跳动，选中时变色，与文字等宽）');
  }
} else {
  passOutput('S58', '未使用 .tabs 标准样式（可忽略）');
}

// S59: .tabs-nav 容器禁止设置背景色
if (HAS_TABS_NAV === 1) {
  const bgLines = [];
  let inBlock = false;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/\.tabs-nav\s*\{/.test(l)) { inBlock = true; continue; }
    if (inBlock && /background\s*:/.test(l)) bgLines.push(`${i + 1}: ${l}`);
    if (inBlock && l.includes('}')) inBlock = false;
  }
  if (bgLines.length > 0) {
    failOutput('S59', '.tabs-nav 容器设置了背景色（应透明，由 .nav-item 各自背景决定）',
      bgLines.join('\n'),
      '删除 .tabs-nav 规则块内的 background 属性。选中 .nav-item 背景=#FFFFFF（与下方 .page-card 白色卡片自然衔接），未选中=#F4F7F9，容器透明');
  } else {
    passOutput('S59', '.tabs-nav 容器无背景色（符合规范）');
  }
} else {
  passOutput('S59', '未使用 .tabs-nav 页签样式（可忽略）');
}

// S60: .tabs-nav 选中项必须有 1px 白色边框占位（防跳动）
if (HAS_TABS_NAV === 1) {
  const activeBlock = afterLines(/\.nav-item\.is-active/, 10).join('\n');
  if (/border:\s*1px\s+solid\s+var\(--color-bg-card\)|border:\s*1px\s+solid\s+#FFFFFF|border:\s*1px\s+solid\s+#FFF[^0-9A-Fa-f]/.test(activeBlock)) {
    passOutput('S60', '.tabs-nav 选中项含 1px 白色边框占位（防跳动）');
  } else {
    failOutput('S60', '.tabs-nav 选中项缺少 1px 白色边框占位（切换时会跳动）',
      '.nav-item.is-active 规则未检测到 border: 1px solid var(--color-bg-card) 或 border: 1px solid #FFFFFF',
      '.tabs-nav .nav-item.is-active { border: 1px solid var(--color-bg-card); border-bottom: none; } （白色边框占位，确保与未选中项宽度一致，底部无边框与下方卡片衔接）');
  }
} else {
  passOutput('S60', '未使用 .tabs-nav 页签样式（可忽略）');
}

// S61: .tabs-filter 选中项必须有 1px 主题色边框占位（防跳动）
if (HAS_TABS_FILTER === 1) {
  const activeBlock = afterLines(/\.filter-item\.is-active/, 10).join('\n');
  if (/border:\s*1px\s+solid\s+var\(--color-primary\)|border:\s*1px\s+solid\s+#3685F2/.test(activeBlock)) {
    passOutput('S61', '.tabs-filter 选中项含 1px 主题色边框占位（防跳动）');
  } else {
    failOutput('S61', '.tabs-filter 选中项缺少 1px 主题色边框占位（切换时会跳动）',
      '.filter-item.is-active 规则未检测到 border: 1px solid var(--color-primary) 或 border: 1px solid #3685F2',
      '.tabs-filter .filter-item.is-active { border: 1px solid var(--color-primary); } （主题色边框占位，确保与未选中项宽度一致）');
  }
} else {
  passOutput('S61', '未使用 .tabs-filter 分类标签（可忽略）');
}

// S62: .tabs 溢出箭头必须使用标准图标
if (HAS_TABS === 1) {
  if (content.includes('tabs-arrow')) {
    if (/icon-chevron-right|icon-chevron-left/.test(content)) {
      passOutput('S62', '.tabs 溢出箭头使用标准 chevron 图标');
    } else {
      failOutput('S62', '.tabs 溢出箭头未使用标准 chevron 图标（禁止自行绘制 path）',
        '检测到 .tabs-arrow 但未引用 #icon-chevron-right / #icon-chevron-left',
        '使用项目标准 chevron-right.svg / chevron-left.svg 的 path（#icon-chevron-right / #icon-chevron-left），禁止自行绘制 path（会导致方向画反或粗细不一致）');
    }
  } else {
    passOutput('S62', '.tabs 未使用溢出箭头（可忽略）');
  }
} else {
  passOutput('S62', '未使用 .tabs 标准样式（可忽略）');
}

if (QUIET === 0) console.log('');

// ================================================
// 第十三组：系统级页签合规 (S63-S65) — 对应 tabs.md 系统级页签
// ================================================
if (QUIET === 0) console.log('--- 系统级页签 (S63-S65) ---');

// S63: .tabs-nav 容器必须 padding:0
if (HAS_TABS_NAV === 1) {
  const padLines = [];
  let inBlock = false;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/\.tabs-nav\s*\{/.test(l)) { inBlock = true; continue; }
    if (inBlock) {
      if (/padding\s*:\s*[1-9]|padding-left\s*:\s*[1-9]/.test(l)) padLines.push(`${i + 1}: ${l}`);
      if (l.includes('}')) inBlock = false;
    }
  }
  if (padLines.length > 0) {
    failOutput('S63', '.tabs-nav 容器有内边距（应 padding:0 与卡片左对齐）',
      padLines.join('\n'),
      '.tabs-nav { padding: 0; }（页签直接与下方 .page-card 左对齐，禁止左边距留白）');
  } else {
    passOutput('S63', '.tabs-nav 容器无内边距（与卡片左对齐）');
  }
} else {
  passOutput('S63', '未使用 .tabs-nav 页签样式（可忽略）');
}

// S64: 有页签时 .page-card 左上角圆角必须为0（.has-tabs 类）
if (HAS_TABS_NAV === 1) {
  const radiusRule = countLines(lines, /has-tabs.*page-card.*border-top-left-radius:\s*0/);
  if (radiusRule > 0) {
    passOutput('S64', '有页签时 .page-card 左上角圆角为0（.has-tabs 规则已定义）');
  } else {
    failOutput('S64', '缺少有页签时卡片左上角圆角为0的规则',
      '未检测到 .main-content.has-tabs .page-card { border-top-left-radius: 0; }',
      '添加 .main-content.has-tabs .page-card { border-top-left-radius: 0; }（有页签时卡片左上角与页签无缝衔接）');
  }
} else {
  passOutput('S64', '未使用 .tabs-nav 页签样式（可忽略）');
}

// S65: 页签关闭图标显示规则（1个不显示，≥2个显示）— JS 逻辑检测
if (isNavShell === 1) {
  const closeLogic = countLines(lines, /showClose.*openTabs\.length.*>=.*2|openTabs\.length.*>=.*2.*showClose/);
  if (closeLogic > 0) {
    passOutput('S65', '页签关闭图标显示逻辑正确（≥2个才显示）');
  } else {
    failOutput('S65', '缺少页签关闭图标显示逻辑（1个不显示，≥2个显示）',
      'renderTabs 函数未检测到 openTabs.length >= 2 判断逻辑',
      '在 renderTabs 函数中添加: var showClose = openTabs.length >= 2; 仅当 showClose 为 true 时渲染关闭图标');
  }
} else {
  passOutput('S65', '非 common.js 文件（页签关闭逻辑在 common.js 中检测）');
}

if (QUIET === 0) console.log('');

// ================================================
// 第十四组：JS 模板字符串内嵌 HTML 结构检测 (S69)
// ================================================
if (QUIET === 0) console.log('--- JS 模板字符串内嵌 HTML (S69) ---');

if (isJsFile === 1 && isNavShell === 0) {
  // awk 状态机：进入模板字符串后检测 HTML 结构标签
  let inTpl = false;
  const embedded = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!inTpl && (/var.*=.*`/.test(l) || /return.*`/.test(l) || /innerHTML.*=.*`/.test(l))) {
      inTpl = true;
      continue;
    }
    if (inTpl && /<(div|table|span|ul|li|form|section|header|footer|nav|main|article|aside|button|input|select|textarea|tr|td|th|thead|tbody|p|h[1-6]|label)/.test(l)) {
      embedded.push(`${i + 1}: ${l}`);
      inTpl = false;
    } else if (inTpl && l.includes('`')) {
      inTpl = false;
    }
    if (embedded.length >= 5) break;
  }

  if (embedded.length > 0) {
    failOutput('S69', `HTML 结构嵌在 JS 模板字符串中（${embedded.length} 处，style-scan 无法有效扫描）`,
      embedded.slice(0, 3).join('\n'),
      '执行 node scripts/quick-fix.mjs flatten <文件> 自动提取 JS 模板字符串中的 HTML/CSS 为独立 .html 文件；本项 FAIL 即深度改造硬信号，按 external-html-workflow.md §0.1 强制走完整 7 步（flatten+三部分分离，内容搬运禁止重写），禁止判轻量');
  } else {
    passOutput('S69', '未检测到 JS 模板字符串内嵌 HTML 结构（或为 common.js 导航壳）');
  }
} else if (isJsFile === 0) {
  // .html 文件：body 内是否仅有 JS 挂载点无实际 HTML 结构
  const bodyHtmlTags = countLines(lines, /<(div|table|span|ul|li|form|section|header|footer|nav|main|article|aside|button)\b/);
  const scriptTags = countLines(lines, /<script\b/);
  if (bodyHtmlTags < 3 && scriptTags >= 1) {
    warnOutput('S69', `HTML 结构标签偏少（${bodyHtmlTags} 个），可能为 JS 渲染型页面`,
      `检测到 ${scriptTags} 个 <script> 标签但仅 ${bodyHtmlTags} 个 HTML 结构标签`,
      '确认页面结构是否藏在 JS 模板字符串中；若是，执行 node scripts/quick-fix.mjs flatten <文件> 提取');
  } else {
    passOutput('S69', 'HTML 结构正常（非 JS 模板字符串渲染型）');
  }
} else {
  passOutput('S69', 'common.js 导航壳（模板字符串为正常模式，跳过）');
}

if (QUIET === 0) console.log('');
const TOTAL = PASS + WARN + FAIL + SKIP;
if (QUIET === 1) {
  console.log(`汇总: PASS=${PASS} WARN=${WARN} FAIL=${FAIL} SKIP=${SKIP} (共${TOTAL}/66项)`);
} else {
  console.log('============================================');
  console.log('📊 样式扫描结果汇总');
  console.log('============================================');
  console.log(`  ✅ 通过: ${PASS}`);
  console.log(`  ⚠️  警告: ${WARN}`);
  console.log(`  ❌ 失败: ${FAIL}`);
  if (SKIP > 0) console.log(`  ⏭️  跳过: ${SKIP}（分流检测：MPA 页面/common.js 不适用项）`);
  console.log(`  📋 总计: ${TOTAL}/66 项`);
  console.log('');
}

if (FAIL > 0) {
  if (QUIET === 0) {
    console.log(`🔴 发现 ${FAIL} 项必须修复的样式偏差`);
    console.log('   📖 详细矫正方法见: REFERENCES/style-fix-cheatsheet.md');
    console.log('   🔧 资源类问题：检查 common.css/common.js 是否从 ASSETS 正确复制');
    console.log('');
    console.log('   📌 典型修复流程:');
    console.log('      1. 查看上方 FAIL 项的「矫正」字段');
    console.log('      2. 在 style-fix-cheatsheet.md 中查找对应编号获取完整修复代码');
    console.log('      3. 应用修复后重新运行本脚本验证');
  }
  process.exit(1);
} else if (WARN > 0) {
  if (QUIET === 0) {
    console.log(`🟡 存在 ${WARN} 项建议优化项（不阻断交付，但建议修复）`);
    console.log('   📖 详细矫正方法见: REFERENCES/style-fix-cheatsheet.md');
  }
  process.exit(0);
} else {
  if (QUIET === 0) console.log('🟢 全部通过！样式完全符合 JMBOS 设计规范 ✓');
  process.exit(0);
}
