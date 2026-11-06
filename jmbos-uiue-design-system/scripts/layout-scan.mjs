#!/usr/bin/env node
// JMBOS Design System — 布局骨架结构扫描 (Layout Scan, Node.js 版，跨平台：macOS / Windows)
// 用法: node scripts/layout-scan.mjs <html-or-js-file>
//
// 检测项:
//   L1-L4:  页面骨架锚点 (top-nav/sidebar/main-content/核心容器)
//   L5-L8:  页面类型功能区块 (列表四件套/详情描述列表/表单区块/弹窗四件套)
//   L9-L12: 布局规则 (box-sizing/transform/overflow/flex)
//
// 与其他脚本关系:
//   validate-design.mjs → 资源层 (Token/Sprite/Logo/Zoom)
//   style-scan.mjs      → 样式层 (颜色/圆角/字号/图标值)
//   layout-scan.mjs     → 结构层 (骨架/功能区块/布局规则) ← 本脚本
//   三者配合：validate → style-scan → layout-scan → 修复 → 重验
//
// v1.1: L1-L4 分流检测 — MPA 页面 .html（自带完整骨架）检测核心容器，
//        js/pages/*.js 仅含交互逻辑（核心容器在对应 .html 中检测），common.js（renderHeader/renderSidebar）仅检测 L1/L2

import path from 'node:path';
import {
  checkNodeVersion, readLines, fileExists, classifyFile,
} from './lib.mjs';

checkNodeVersion();

// 解析参数
let HTML_FILE = '';
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('-')) {
    console.log(`未知参数: ${arg}`);
    console.log('用法: node scripts/layout-scan.mjs <html-or-js-file>');
    process.exit(1);
  } else HTML_FILE = arg;
}

if (!HTML_FILE) {
  console.log('用法: node scripts/layout-scan.mjs <html-or-js-file>');
  process.exit(1);
}
if (!fileExists(HTML_FILE)) {
  console.log(`[ERR] 文件不存在: ${HTML_FILE}`);
  process.exit(1);
}

const lines = readLines(HTML_FILE);
const { isJsFile, isMpaPage, isNavShell } = classifyFile(HTML_FILE, lines);

let PASS = 0, WARN = 0, FAIL = 0, SKIP = 0;

// 通用输出函数（与 bash 版输出格式一致）
function passOutput(id, desc) {
  PASS++;
  console.log(`[PASS] ${id}: ${desc}`);
}
function failOutput(id, desc, detail, fix) {
  console.log(`[FAIL] ${id}: ${desc}`);
  console.log(`   偏差: ${detail}`);
  console.log(`   矫正: ${fix}`);
  FAIL++;
}
function warnOutput(id, desc, detail, fix) {
  console.log(`[WARN] ${id}: ${desc}`);
  console.log(`   提示: ${detail}`);
  console.log(`   建议: ${fix}`);
  WARN++;
}
// SKIP 输出（不计入 PASS/WARN/FAIL，仅作分流提示）
function infoOutput(id, desc) {
  SKIP++;
  console.log(`[SKIP] ${id}: ${desc}`);
}

// 头部信息
console.log('============================================');
console.log('JMBOS 布局骨架结构扫描 v1.1');
console.log(`文件: ${HTML_FILE}`);
if (isMpaPage === 1) console.log('模式: MPA 页面（.html 自带完整骨架 / js/pages/*.js 仅含交互逻辑）— L1/L2 在 common.js，核心容器在各自 .html 文件内');
else if (isNavShell === 1) console.log('模式: 导航壳 JS（common.js）— 仅检测 L1/L2（导航锚点），L3/L4 跳过');
else if (isJsFile === 1) console.log('模式: 其他 JS 文件');
console.log('============================================');
console.log('');

// ================================================
// 第一组：骨架锚点 (L1-L4)
// ================================================
console.log('--- 骨架锚点 (L1-L4) ---');

// L1: top-nav 锚点
// 分流：MPA 页面跳过（顶导在 common.js）；common.js 检测 renderHeader 函数；其他跳过
if (isMpaPage === 1) {
  infoOutput('L1', 'MPA 页面：顶导锚点在 common.js 中，请单独检测 common.js');
} else if (isNavShell === 1) {
  if (lines.some((l) => l.includes('function renderHeader'))) {
    passOutput('L1', '导航壳含 renderHeader 函数（顶导骨架来源）');
  } else {
    failOutput('L1', '导航壳缺少 renderHeader 函数',
      'common.js 未定义 function renderHeader',
      '在 common.js 中实现 renderHeader() 函数，生成 <header class="top-nav"> 结构');
  }
} else {
  infoOutput('L1', '顶导锚点在 common.js 中，请单独检测 common.js');
}

// L2: sidebar 锚点
// 分流：MPA 页面跳过（侧边栏在 common.js）；common.js 检测 renderSidebar 函数；其他跳过
if (isMpaPage === 1) {
  infoOutput('L2', 'MPA 页面：侧边栏锚点在 common.js 中，请单独检测 common.js');
} else if (isNavShell === 1) {
  if (lines.some((l) => l.includes('function renderSidebar'))) {
    passOutput('L2', '导航壳含 renderSidebar 函数（侧边栏骨架来源）');
  } else {
    failOutput('L2', '导航壳缺少 renderSidebar 函数',
      'common.js 未定义 function renderSidebar',
      '在 common.js 中实现 renderSidebar() 函数，生成 <aside class="sidebar"> 结构');
  }
} else {
  infoOutput('L2', '侧边栏锚点在 common.js 中，请单独检测 common.js');
}

// L3: main-content 锚点
// 分流：MPA .html 页面检测本文件 main-content；js/pages/*.js 提示在对应 .html 中检测；common.js 跳过
if (isMpaPage === 1 && isJsFile === 0) {
  if (lines.some((l) => /class="main-content"|class="[^"]*main-wrapper[^"]*"|<main[\s>]/.test(l))) {
    passOutput('L3', 'MPA 页面 .html 含 main-content 主内容区');
  } else {
    failOutput('L3', '缺少 main-content 主内容区',
      'MPA .html 文件未检测到 main-content / main-wrapper / <main>',
      '在 .html <body> 内添加 <main class="main-content"> 或对应 .main-wrapper 结构');
  }
} else if (isMpaPage === 1) {
  infoOutput('L3', 'MPA 配套JS仅含交互逻辑，main-content 在对应 .html 文件内检测');
} else if (isNavShell === 1) {
  infoOutput('L3', '导航壳 common.js 不含页面内容，主内容区锚点请在对应 .html 中检测');
} else {
  infoOutput('L3', 'MPA 各页面 .html 自带完整骨架，main-content 在各自 .html 文件内');
}

// L4: 核心容器锚点（page-card / detail-grid / modal-overlay）
// 分流：common.js（导航壳）跳过（不含页面内容）；
//       MPA .html 页面检测核心容器 class（page-card/detail-grid/modal-overlay/form-body）；
//       js/pages/*.js 提示核心容器在对应 .html 中检测（JS 仅含交互逻辑）；其他跳过
let L4_FOUND = '';
if (isNavShell === 1) {
  infoOutput('L4', '导航壳 common.js 不含页面内容，核心容器锚点请在对应 .html 中检测');
} else if (isMpaPage === 1 && isJsFile === 0) {
  // MPA .html 页面：检测核心容器 class（模板用 class 而非 STRUCT 注释）
  if (lines.some((l) => /class="[^"]*page-card[^"]*"/.test(l))) {
    passOutput('L4', '核心容器已存在 (page-card)');
    L4_FOUND = 'page-card';
  } else if (lines.some((l) => /class="[^"]*detail-grid[^"]*"/.test(l))) {
    passOutput('L4', '核心容器已存在 (detail-grid)');
    L4_FOUND = 'detail-grid';
  } else if (lines.some((l) => /class="[^"]*modal-overlay[^"]*"/.test(l))) {
    passOutput('L4', '核心容器已存在 (modal-overlay)');
    L4_FOUND = 'modal-overlay';
  } else if (lines.some((l) => /class="[^"]*form-body[^"]*"/.test(l))) {
    passOutput('L4', '核心容器已存在 (form-body)');
    L4_FOUND = 'form-body';
  } else {
    failOutput('L4', '缺少核心容器',
      '未找到 page-card / detail-grid / modal-overlay / form-body 任一 class',
      'MPA 各页面 .html 自带完整骨架，核心容器在各自 .html 文件内；用 Grep 从 ASSETS/page-shells/ 对应模板仅提取所需容器片段（#header/.main-wrapper/.page-card 等，禁止整文件阅读，单模板45KB+），禁止从零写');
  }
} else if (isMpaPage === 1) {
  infoOutput('L4', 'MPA 配套JS仅含交互逻辑，核心容器在对应 .html 文件内检测');
} else {
  infoOutput('L4', 'MPA 各页面 .html 自带完整骨架，核心容器在各自 .html 文件内');
}

console.log('');

// ================================================
// 第二组：功能区块 (L5-L8)
// ================================================
console.log('--- 功能区块 (L5-L8) ---');

// 预扫描 class 存在性（等价 bash grep -c 'xxx' 的宽松匹配）
const HAS_QUERY_BAR = lines.filter((l) => l.includes('query-bar')).length;
const HAS_ACTION_BAR = lines.filter((l) => l.includes('action-bar')).length;
const HAS_TABLE = lines.filter((l) => l.includes('data-table')).length;
const HAS_PAGINATION = lines.filter((l) => /pagination-wrapper|class="pagination"/.test(l)).length;
const HAS_DETAIL_GRID = lines.filter((l) => l.includes('detail-grid')).length;
const HAS_FORM_BODY = lines.filter((l) => l.includes('form-body')).length;
const HAS_FORM_FOOTER = lines.filter((l) => l.includes('form-footer')).length;
const HAS_MODAL_OVERLAY = lines.filter((l) => l.includes('modal-overlay')).length;
const HAS_MODAL_HEADER = lines.filter((l) => l.includes('modal-header')).length;
const HAS_MODAL_BODY = lines.filter((l) => l.includes('modal-body')).length;
const HAS_MODAL_FOOTER = lines.filter((l) => l.includes('modal-footer')).length;

// L5: 列表页四件套（查询栏+操作按钮+表格+分页）— 仅在检测到 query-bar 时触发
if (HAS_QUERY_BAR > 0) {
  let MISSING_LIST = '';
  if (HAS_QUERY_BAR === 0) MISSING_LIST += 'query-bar(查询栏) ';
  if (HAS_ACTION_BAR === 0) MISSING_LIST += 'action-bar(操作按钮区) ';
  if (HAS_TABLE === 0) MISSING_LIST += 'data-table(数据表格) ';
  if (HAS_PAGINATION === 0) MISSING_LIST += 'pagination(分页) ';
  if (MISSING_LIST === '') {
    passOutput('L5', '列表页四件套齐全（查询栏+操作按钮+表格+分页）');
  } else {
    failOutput('L5', '列表页功能区块缺失',
      `缺少: ${MISSING_LIST}`,
      '从 page-shells/js/pages/list.js 复制对应区块结构，确保四件套齐全');
  }
} else {
  passOutput('L5', '非列表页（跳过四件套检测）');
}

// L6: 详情页描述列表
if (HAS_DETAIL_GRID > 0 || L4_FOUND === 'detail-card') {
  if (HAS_DETAIL_GRID > 0) {
    passOutput('L6', '详情页描述列表已存在 (detail-grid)');
  } else {
    failOutput('L6', '详情页缺少描述列表',
      '未找到 detail-grid 类',
      '从 page-shells/js/pages/detail.js 复制 detail-grid 结构');
  }
} else {
  passOutput('L6', '非详情页（跳过描述列表检测）');
}

// L7: 表单页区块（form-body + form-footer）— 仅在检测到 form-body 时触发
if (HAS_FORM_BODY > 0) {
  let MISSING_FORM = '';
  if (HAS_FORM_BODY === 0) MISSING_FORM += 'form-body(表单主体) ';
  if (HAS_FORM_FOOTER === 0) MISSING_FORM += 'form-footer(底部按钮) ';
  if (MISSING_FORM === '') {
    passOutput('L7', '表单页区块齐全（form-body + form-footer）');
  } else {
    failOutput('L7', '表单页功能区块缺失',
      `缺少: ${MISSING_FORM}`,
      '从 page-shells/js/pages/form.js 复制对应区块结构');
  }
} else {
  passOutput('L7', '非表单页（跳过表单区块检测）');
}

// L8: 弹窗四件套（overlay+header+body+footer）
if (HAS_MODAL_OVERLAY > 0 || L4_FOUND === 'modal-overlay') {
  let MISSING_MODAL = '';
  if (HAS_MODAL_OVERLAY === 0) MISSING_MODAL += 'modal-overlay(遮罩层) ';
  if (HAS_MODAL_HEADER === 0) MISSING_MODAL += 'modal-header(标题区) ';
  if (HAS_MODAL_BODY === 0) MISSING_MODAL += 'modal-body(内容区) ';
  if (HAS_MODAL_FOOTER === 0) MISSING_MODAL += 'modal-footer(底部按钮) ';
  if (MISSING_MODAL === '') {
    passOutput('L8', '弹窗四件套齐全（overlay+header+body+footer）');
  } else {
    failOutput('L8', '弹窗功能区块缺失',
      `缺少: ${MISSING_MODAL}`,
      '从 page-shells/js/pages/modal.js 复制完整弹窗结构');
  }
} else {
  passOutput('L8', '无弹窗（跳过弹窗检测）');
}

console.log('');

// ================================================
// 第三组：布局规则 (L9-L12)
// ================================================
console.log('--- 布局规则 (L9-L12) ---');

// L9: box-sizing 全局设置
if (lines.some((l) => /box-sizing:\s*border-box/.test(l))) {
  passOutput('L9', 'box-sizing: border-box 已设置');
} else {
  failOutput('L9', '缺少全局 box-sizing 设置',
    '未找到 box-sizing: border-box',
    '在全局重置中添加: * { margin:0; padding:0; box-sizing: border-box; }');
}

// L10: 禁止 transform: scale() 做布局（@keyframes 动画中的 scale 合法）
// awk 状态机等价实现：进入 @keyframes 块后跳过，遇行首 } 退出
const transformScaleHits = [];
{
  let kf = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('@keyframes')) kf = true;
    if (kf && /^\}/.test(line)) kf = false;
    if (!kf && /transform:\s*scale/.test(line)) {
      transformScaleHits.push(`${i + 1}: ${line}`);
      if (transformScaleHits.length >= 2) break;
    }
  }
}
if (transformScaleHits.length > 0) {
  failOutput('L10', '使用 transform: scale() 做布局（禁止）',
    transformScaleHits.join('\n'),
    '删除 transform: scale()，改用 position: fixed + margin 偏移方案');
} else {
  passOutput('L10', '未使用 transform: scale() 布局');
}

// L11: body/html 禁止 overflow-x: hidden
const bodyOverflow = [];
for (let i = 0; i < lines.length; i++) {
  if (/(body|html)[^{]*overflow-x:\s*hidden/.test(lines[i])) {
    bodyOverflow.push(`${i + 1}: ${lines[i]}`);
    if (bodyOverflow.length >= 2) break;
  }
}
if (bodyOverflow.length > 0) {
  failOutput('L11', 'body/html 设置了 overflow-x: hidden',
    bodyOverflow.join('\n'),
    '删除 body/html 上的 overflow-x: hidden；仅 .main-content 可设置');
} else {
  passOutput('L11', 'body/html 无 overflow-x: hidden');
}

// L12: 主内容区 flex 布局（分页固定底部）
// 等价 bash: grep -A10 '.main-content' | grep 'display:\s*flex'
let MAIN_FLEX = false;
if (HAS_PAGINATION > 0) {
  for (let i = 0; i < lines.length; i++) {
    if (/\.main-content/.test(lines[i])) {
      const end = Math.min(lines.length, i + 11); // 匹配行 + 后10行
      for (let j = i; j < end; j++) {
        if (/display:\s*flex/.test(lines[j])) { MAIN_FLEX = true; break; }
      }
      if (MAIN_FLEX) break;
    }
  }
}
if (HAS_PAGINATION > 0) {
  if (MAIN_FLEX) {
    passOutput('L12', '主内容区 flex 布局已设置（分页固定底部）');
  } else {
    warnOutput('L12', '主内容区可能缺少 flex 布局',
      '检测到分页但 main-content 未设置 display: flex',
      '确保 .main-content { display: flex; flex-direction: column; } 以实现分页固定底部');
  }
} else {
  passOutput('L12', '无分页（跳过 flex 布局检测）');
}

console.log('');

// ================================================
// 汇总
// ================================================
console.log('============================================');
console.log('布局骨架扫描结果汇总');
console.log('============================================');
console.log(`  通过: ${PASS}`);
console.log(`  警告: ${WARN}`);
console.log(`  失败: ${FAIL}`);
if (SKIP > 0) console.log(`  跳过: ${SKIP}（分流检测：MPA 页面/common.js 不适用项）`);
const TOTAL = PASS + WARN + FAIL + SKIP;
console.log(`  总计: ${TOTAL}/12 项`);
console.log('');

if (FAIL > 0) {
  console.log(`🔴 发现 ${FAIL} 项必须修复的布局结构问题`);
  console.log('   📖 页面规则参考: REFERENCES/page-types.md');
  console.log('   📦 骨架模板目录: ASSETS/page-shells/（index.html + pages/D-XXX_{页面功能名称}.html）');
  console.log('');
  console.log('   📌 典型修复流程:');
  console.log('      1. 确认页面类型（列表/详情/表单/弹窗）');
  console.log('      2. 用 Grep 从 ASSETS/page-shells/ 对应 .html 模板仅提取所需骨架容器片段（禁止整文件阅读，单模板45KB+）；已有产物清洗场景优先按 M5/M6/M10 注入缺失容器');
  console.log('      3. 在骨架基础上搬运业务内容（依 SKILL.md §G11 禁止从零重写）');
  console.log('      4. 重新运行本脚本验证');
  process.exit(1);
} else if (WARN > 0) {
  console.log(`🟡 存在 ${WARN} 项建议优化项`);
  process.exit(0);
} else {
  console.log('🟢 全部通过！布局骨架符合 JMBOS 设计规范 ✓');
  process.exit(0);
}
