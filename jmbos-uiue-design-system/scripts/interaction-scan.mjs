#!/usr/bin/env node
// JMBOS Design System — 交互覆盖率扫描脚本 (Interaction Scan, Node.js 版，跨平台：macOS / Windows)
// 用法: node scripts/interaction-scan.mjs <html-or-js-file>
//
// 功能：扫描HTML/JS文件中可点击元素是否绑定交互行为，输出覆盖率报告
// 对应规范：REFERENCES/implementation-guide.md §6.4 交互完整性检查（AC1-AC7）
//           REFERENCES/page-interactions.md 必备交互
//
// 与 style-scan.mjs 的关系：
//   style-scan.mjs      → 样式层检测（CSS值是否符合规范）
//   interaction-scan.mjs → 行为层检测（按钮/链接是否可点击有反馈）← 本脚本
// 两者配合使用：先 style-scan → 再 interaction-scan → 修复 → 重验
//
// v1.1: 适配 MPA 多页面场景的 pages/D-XXX_{页面功能名称}.html 与 js/pages/D-XXX_{页面功能名称}.js
//       新增 AC8: switchPage 跨页面跳转检测（多页面场景）

import path from 'node:path';
import {
  checkNodeVersion, readLines, fileExists, countLines,
} from './lib.mjs';

checkNodeVersion();

// 解析参数
let HTML_FILE = '';
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('-')) {
    console.log(`未知参数: ${arg}`);
    console.log('用法: node scripts/interaction-scan.mjs <html-or-js-file>');
    process.exit(1);
  } else HTML_FILE = arg;
}

if (!HTML_FILE) {
  console.log('用法: node scripts/interaction-scan.mjs <html-or-js-file>');
  process.exit(1);
}
if (!fileExists(HTML_FILE)) {
  console.log(`[ERR] 文件不存在: ${HTML_FILE}`);
  process.exit(1);
}

// 判断文件类型
const IS_JS_FILE = path.extname(HTML_FILE).toLowerCase() === '.js' ? 1 : 0;
const lines = readLines(HTML_FILE);
const content = lines.join('\n');

let PASS = 0, WARN = 0, FAIL = 0, TOTAL = 0;

// ========== 通用函数 ==========
function failOutput(id, desc, detail, fix) {
  console.log(`[FAIL] ${id}: ${desc}`);
  console.log(`   偏差: ${detail}`);
  console.log(`   矫正: ${fix}`);
  console.log('');
  FAIL++; TOTAL++;
}
function warnOutput(id, desc, detail, fix) {
  console.log(`[WARN] ${id}: ${desc}`);
  console.log(`   提示: ${detail}`);
  console.log(`   建议: ${fix}`);
  console.log('');
  WARN++; TOTAL++;
}
function passOutput(id, desc) {
  console.log(`[PASS] ${id}: ${desc}`);
  PASS++; TOTAL++;
}

// ========== 头部信息 ==========
console.log('============================================');
console.log('JMBOS 交互覆盖率扫描 v1.1');
console.log(`文件: ${HTML_FILE}`);
if (IS_JS_FILE === 1) console.log('模式: JS 文件（HTML/事件以字符串形式检测）');
console.log('检测范围: 7项交互完整性（AC1-AC7）+ 多页面跳转（AC8）');
console.log('规范参考: REFERENCES/implementation-guide.md §6.4');
console.log('============================================');
console.log('');

// ========== AC1: 查询/重置交互 ==========
console.log('--- AC1: 查询/重置交互 ---');

// 检测查询按钮是否存在且绑定事件
const QUERY_BTN_COUNT = countLines(lines, /class="[^"]*btn-primary[^"]*"/);
const QUERY_HANDLER_COUNT = countLines(lines, /handleSearch|onclick.*search|addEventListener.*click.*search/);

if (QUERY_BTN_COUNT > 0) {
  if (QUERY_HANDLER_COUNT > 0 || /onclick=/.test(content)) {
    passOutput('AC1', '查询按钮已绑定交互');
  } else {
    failOutput('AC1', '查询按钮缺少交互绑定',
      '查询按钮存在但未检测到 handleSearch 或 onclick 绑定',
      '为查询按钮添加 onclick="handleSearch()" 并实现该函数');
  }
} else {
  warnOutput('AC1', '未检测到查询按钮',
    '当前页面可能非列表页，查询按钮不适用',
    '如为列表页，请添加查询按钮');
}

// 检测重置按钮
if (/btn-secondary|btn-default/.test(content) && /重置|reset/i.test(content)) {
  if (/handleReset|onclick.*reset/.test(content)) {
    passOutput('AC1-R', '重置按钮已绑定交互');
  } else {
    failOutput('AC1-R', '重置按钮缺少交互绑定',
      '检测到重置按钮但未找到 handleReset 函数',
      '为重置按钮添加 onclick="handleReset()" 并实现该函数');
  }
}

// ========== AC2: 新增交互 ==========
console.log('');
console.log('--- AC2: 新增交互 ---');

// 仅检测按钮文本包含"新增/添加"的按钮（排除页面标题/菜单中的"新增"字样误判）
// 等价 bash: grep -E '<(button|a)[^>]*class="[^"]*btn[^"]*"[^>]*>[^<]*(新增|添加)' | grep -vcE '<symbol|<use'
const ADD_BTN_COUNT = lines.filter((l) =>
  /<(button|a)[^>]*class="[^"]*btn[^"]*"[^>]*>[^<]*(新增|添加)/.test(l) && !/<symbol|<use/.test(l)
).length;

if (ADD_BTN_COUNT > 0) {
  if (/openModal|handleAdd|onclick.*add|location\.href.*form/.test(content)) {
    passOutput('AC2', '新增按钮已绑定交互');
  } else {
    failOutput('AC2', '新增按钮缺少交互绑定',
      '检测到新增按钮但未找到 openModal/handleAdd 或跳转逻辑',
      "为新增按钮添加 onclick=\"openModal('addModal')\" 或跳转表单页");
  }
} else {
  warnOutput('AC2', '未检测到新增按钮',
    '当前页面可能无新增功能',
    '如需要新增功能，请添加新增按钮');
}

// ========== AC3: 编辑/查看交互 ==========
console.log('');
console.log('--- AC3: 编辑/查看交互 ---');

if (/class="[^"]*link-btn[^"]*"/.test(content)) {
  if (/handleEdit|handleView|onclick.*edit|onclick.*view/.test(content)) {
    passOutput('AC3', '编辑/查看按钮已绑定交互');
  } else {
    failOutput('AC3', '操作列按钮缺少交互绑定',
      '检测到 .link-btn 但未找到 handleEdit/handleView 函数',
      '为操作列按钮添加 onclick="handleEdit(id)" 或 handleView(id)');
  }
} else {
  warnOutput('AC3', '未检测到操作列按钮',
    '当前页面可能无操作列',
    '如需要操作列，请添加 .link-btn 按钮');
}

// ========== AC4: 删除交互 ==========
console.log('');
console.log('--- AC4: 删除交互 ---');

// 排除 <symbol id="icon-trash"> 图标定义，仅检测实际删除按钮
const DELETE_BTN_COUNT = lines.filter((l) =>
  /class="[^"]*btn[^"]*"[^>]*>.*删除/.test(l) && !/<symbol|<use/.test(l)
).length;

if (DELETE_BTN_COUNT > 0) {
  if (/confirm|handleDelete|onclick.*delete|onclick.*Delete/.test(content)) {
    passOutput('AC4', '删除按钮已绑定交互');
  } else {
    failOutput('AC4', '删除按钮缺少交互绑定',
      '检测到删除按钮但未找到 confirm/handleDelete',
      '为删除按钮添加 confirm() 确认提示');
  }
} else {
  warnOutput('AC4', '未检测到删除按钮',
    '当前页面可能无删除功能',
    '如需要删除功能，请添加删除按钮');
}

// ========== AC5: 分页交互 ==========
console.log('');
console.log('--- AC5: 分页交互 ---');

if (/class="[^"]*pagination[^"]*"/.test(content)) {
  if (/handlePageChange|onclick.*page|page-btn/.test(content)) {
    passOutput('AC5', '分页器已绑定交互');
  } else {
    failOutput('AC5', '分页器缺少交互绑定',
      '检测到 .pagination 但未找到 handlePageChange',
      '为分页按钮添加 onclick="handlePageChange(page)"');
  }
} else {
  warnOutput('AC5', '未检测到分页器',
    '当前页面可能非列表页',
    '如为列表页，请添加分页器');
}

// ========== AC6: 表单提交交互 ==========
console.log('');
console.log('--- AC6: 表单提交交互 ---');

const REQUIRED_COUNT = countLines(lines, /required/);

if (REQUIRED_COUNT > 0) {
  if (/handleFormSave|handleSave|saveModal|saveRoleModal|saveRole|querySelectorAll.*required/.test(content)) {
    passOutput('AC6', '表单提交校验已实现');
  } else {
    failOutput('AC6', '表单缺少提交校验',
      `检测到 ${REQUIRED_COUNT} 个 required 字段但未找到校验逻辑`,
      "实现 handleFormSave() 函数，使用 querySelectorAll('[required]') 校验");
  }
} else {
  warnOutput('AC6', '未检测到必填字段',
    '当前页面可能无表单或无必填项',
    '如有表单，请为必填字段添加 required 属性');
}

// ========== AC7: 弹窗管理交互 ==========
console.log('');
console.log('--- AC7: 弹窗管理交互 ---');

if (/class="[^"]*modal[^"]*"/.test(content)) {
  const MODAL_OPEN = countLines(lines, /openModal|openRoleModal/);
  const MODAL_CLOSE = countLines(lines, /closeModal/);
  const ESC_HANDLER = countLines(lines, /Escape|keydown/);

  if (MODAL_OPEN > 0 && MODAL_CLOSE > 0) {
    passOutput('AC7', '弹窗打开/关闭已实现');
    if (ESC_HANDLER === 0) {
      warnOutput('AC7-E', 'ESC 键关闭未实现',
        '建议添加 ESC 键监听以提升体验',
        "document.addEventListener('keydown', function(e){ if(e.key==='Escape') closeModal(...) })");
    }
  } else {
    failOutput('AC7', '弹窗管理不完整',
      `openModal=${MODAL_OPEN}, closeModal=${MODAL_CLOSE}`,
      '实现 openModal(id) 和 closeModal(id) 函数');
  }
} else {
  warnOutput('AC7', '未检测到弹窗',
    '当前页面可能无弹窗',
    '如需要弹窗，请添加 .modal 容器');
}

// ========== AC8: 多页面跳转交互 ==========
console.log('');
console.log('--- AC8: 多页面跳转交互 ---');

const SWITCH_PAGE_COUNT = countLines(lines, /switchPage\(/);

if (SWITCH_PAGE_COUNT > 0) {
  passOutput('AC8', `检测到 ${SWITCH_PAGE_COUNT} 处 switchPage 跨页面跳转`);
} else {
  warnOutput('AC8', '未检测到 switchPage 调用',
    '当前页面可能无跨页面跳转需求',
    "如需跳转，添加 switchPage('路由ID', module) 调用（MPA 下 location.href 跳转）");
}

// ========== 检测"死按钮"（有 class 但无 onclick） ==========
console.log('');
console.log('--- 附加检测：死按钮扫描 ---');

// 提取所有可点击元素，检查是否有 inline onclick 绑定
// 检测范围：btn-(primary|secondary|default|danger|link) + nav-menu-item + toolbar-btn + file-upload-btn + more-action-btn + inline-tab + link-btn + page-btn
// 注意：仅检测 inline onclick，通过 addEventListener 绑定的按钮需人工确认
const BTN_CLASS_RE = /<(button|a)[^>]*class="[^"]*(btn-(primary|secondary|default|danger|link|more-text)|nav-menu-item|toolbar-btn|file-upload-btn|more-action-btn|inline-tab|link-btn|page-btn)[^"]*"/;
const deadBtns = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (!BTN_CLASS_RE.test(line)) continue;
  // 跳过已有 onclick 的
  if (/onclick=|addEventListener/.test(line)) continue;
  // 跳过纯样式按钮（type="submit" 在 form 中）
  if (/type="submit"/.test(line)) continue;
  // 跳过 disabled 按钮
  if (/disabled/.test(line)) continue;
  // 跳过 SVG sprite 内的 symbol/use（非真实按钮）
  if (/<symbol|<use /.test(line)) continue;
  deadBtns.push(`${i + 1}: ${line}`);
}

if (deadBtns.length > 0) {
  for (const d of deadBtns) console.log(`   ${d}`);
  warnOutput('DEAD', `检测到 ${deadBtns.length} 个按钮无 inline onclick`,
    '上述按钮可能通过 addEventListener 绑定，需人工确认',
    '如未绑定交互，请添加 onclick 或在 <script> 中绑定事件');
} else {
  passOutput('DEAD', '所有按钮均已绑定 inline onclick');
}

// ========== 汇总报告 ==========
console.log('');
console.log('============================================');
console.log('交互覆盖率扫描报告');
console.log('============================================');
console.log(`PASS: ${PASS}`);
console.log(`WARN: ${WARN}`);
console.log(`FAIL: ${FAIL}`);
console.log('--------------------------------------------');
console.log(`总计: ${TOTAL} 项`);
console.log('============================================');

if (FAIL > 0) {
  console.log('');
  console.log(`🚨 发现 ${FAIL} 项交互缺失，请修复后重新扫描`);
  console.log('📖 参考: REFERENCES/page-interactions.md 必备交互');
  process.exit(1);
} else if (WARN > 0) {
  console.log('');
  console.log(`⚠️  发现 ${WARN} 项警告（可能因页面类型不适用，请人工确认）`);
  process.exit(0);
} else {
  console.log('');
  console.log('🎉 全部交互检查通过！');
  process.exit(0);
}
