// JMBOS Design System — 脚本公共库（Node.js 版，跨平台：macOS / Windows）
// 运行要求: Node.js v22.13.0 及以上版本
// 供 validate-design / style-scan / layout-scan / interaction-scan / structure-fix / quick-fix 引用

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 技能根目录（scripts/ 的上一级） */
export const SKILL_ROOT = path.resolve(__dirname, '..');
/** 脚本目录 */
export const SCRIPT_DIR = __dirname;

/** Node 版本检查：低于 v22.13.0 直接报错退出 */
export function checkNodeVersion() {
  const m = process.version.match(/^v(\d+)\.(\d+)/);
  const major = m ? Number(m[1]) : 0;
  const minor = m ? Number(m[2]) : 0;
  if (major < 22 || (major === 22 && minor < 13)) {
    console.error(`[ERR] Node.js 版本过低: 当前 ${process.version}，要求 v22.13.0 及以上版本`);
    console.error('      请前往 https://nodejs.org/ 安装 LTS 版本后重试');
    process.exit(1);
  }
}

/** 读文件为字符串（文件不存在抛异常，由调用方处理） */
export function readText(file) {
  return fs.readFileSync(file, 'utf8');
}

/** 读文件为行数组（去除末尾因换行产生的空元素，与 bash 逐行语义一致） */
export function readLines(file) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

/** 写文件（UTF-8，无 BOM） */
export function writeText(file, content) {
  fs.writeFileSync(file, content, 'utf8');
}

/** 文件是否存在 */
export function fileExists(file) {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

/** 路径转 POSIX 分隔符（Windows 下匹配 /js/pages/ 等路径模式用） */
export function toPosix(p) {
  return p.split(path.sep).join('/');
}

/**
 * 文件类型分流（与 bash 版分流检测逻辑 1:1 对应）
 * 返回 { isJsFile, isMpaPage, isNavShell, isCommonCss, isRedirectShell, basename }
 */
export function classifyFile(file, lines) {
  const isJsFile = path.extname(file).toLowerCase() === '.js' ? 1 : 0;
  const content = lines.join('\n');
  let isMpaPage = 0;
  let isNavShell = 0;
  let isCommonCss = 0;
  if (isJsFile) {
    if (/function renderHeader|function renderSidebar/.test(content)) {
      isNavShell = 1;
    } else if (/\/js\/pages\/[^/]+\.js$/.test(toPosix(file))) {
      isMpaPage = 1;
    }
  } else {
    if (/window\.__pageId\s*=/.test(content)) {
      isMpaPage = 1;
    } else if (/src="(\.\.\/)?js\/common\.js"/.test(content)) {
      isMpaPage = 1;
    }
  }
  const basename = path.basename(file);
  if (!isJsFile && /common\.css$/.test(basename)) isCommonCss = 1;
  // 重定向壳识别（与 structure-fix.mjs 壳页豁免同口径）：index.html 仅作跳转入口
  // （location.replace/assign/href 或 meta refresh 指向 pages/*.html），无业务内容。
  // 仅 index.html 允许为壳页（G1）；pages/ 子页出现重定向不豁免，E5 仍正常检测。
  const isRedirectShell = !isJsFile && basename.toLowerCase() === 'index.html' && (
    /location\.(?:replace|assign)\s*\(\s*['"`][^'"`]*pages\/[^'"`]+\.html['"`]/.test(content) ||
    /location\.href\s*=\s*['"`][^'"`]*pages\/[^'"`]+\.html['"`]/.test(content) ||
    /http-equiv=["']?refresh["']?[^>]*url=[^"'>]*pages\/[^"'>]+\.html/i.test(content)
  ) ? 1 : 0;
  return { isJsFile, isMpaPage, isNavShell, isCommonCss, isRedirectShell, basename };
}

/** 带行号匹配：返回 [{no, text}]，等价 grep -n */
export function grepLines(lines, re) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (re.test(lines[i])) out.push({ no: i + 1, text: lines[i] });
  }
  return out;
}

/** 匹配行数，等价 grep -c */
export function countLines(lines, re) {
  let n = 0;
  for (const l of lines) if (re.test(l)) n++;
  return n;
}

/** 第一个匹配行号（1-based），无匹配返回 null，等价 grep -n | head -1 | cut -d: -f1 */
export function firstMatchLine(lines, re) {
  for (let i = 0; i < lines.length; i++) {
    if (re.test(lines[i])) return i + 1;
  }
  return null;
}

/**
 * 提取内联 style="..."（跳过 JMBOS-SVG-SPRITE 块，等价 bash 版 E6/S67 的 awk 状态机）
 * 返回 "行号: 匹配内容" 字符串数组
 */
export function extractInlineStyles(lines) {
  const out = [];
  let inSprite = false;
  const re = /style="[^"]*"/g;
  // 行级白名单：SVG Sprite 容器（官方固有模式，hidden 属性对 SVG 元素无效，无内联替代）。
  // 特征：<svg 开标签 + xmlns 属性 + 纯 display:none —— 业务内联 svg 一般不带 xmlns，不会误豁免。
  const spriteContainerRe = /<svg[^>]*xmlns[^>]*style="display:\s*none;?"[^>]*>/;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('<!-- JMBOS-SVG-SPRITE -->')) {
      inSprite = true;
      continue;
    }
    if (line.includes('<!-- /JMBOS-SVG-SPRITE -->')) {
      inSprite = false;
      continue;
    }
    if (inSprite) continue;
    if (spriteContainerRe.test(line)) continue;
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(line)) !== null) {
      out.push(`${i + 1}: ${m[0]}`);
    }
  }
  return out;
}

/** design-tokens 色板白名单（S34/S40 三级色值策略用，来源 ASSETS/design-tokens.css） */
export const KNOWN_HEX = [
  '3685F2', '5E9DF5', '2364CC', 'AFCEFA', '0C328C', '141b24', '7C8493', 'B9BFCB',
  'EBF1F6', 'FFFFFF', 'F4F7F9', 'EDF3FA', 'D2D7E1', 'E4E7F0', '04D999', 'FF813B',
  'FF4D5D', 'DEEDFF', 'F3F8FE', '2468F2', '4F90FF', '144BCC', '78AEFF', 'E8F5FF',
  'F0F7FF', '5EE7BD', '00B780', 'A4F1DA', 'CDF7EB', 'E6FBF5', 'FFAE81', 'D46B08',
  'FFCF8B', 'FFE4BA', 'FFF7E8', 'FF717D', 'D93649', 'FFA3AB', 'FFD1D4', 'FFEDEF',
  '5086F5', 'E9EFFD',
];

/** S34/S40 共用：色值是否在 design-tokens 色板中（大小写不敏感） */
export function isKnownHex(hexVal) {
  const up = hexVal.toUpperCase();
  return KNOWN_HEX.some((k) => k.toUpperCase() === up);
}

/**
 * S34/S40 共用：场景分类（图表 / 清晰UI / 模糊）
 * @param line    带行号的原始行 "N: content"
 * @param context 该行前后 5 行的上下文文本
 * @param isCssRuleLine  CSS 规则行判断（S40 用，S34 传 null 走 HTML 属性行逻辑）
 * @returns 'chart' | 'clear' | 'ambiguous'
 */
export function classifyColorScene(line, context, isCssRuleLine = null) {
  const isCss = isCssRuleLine === null ? false : isCssRuleLine;
  if (isCss) {
    // CSS 规则行：按选择器名判断
    if (/(chart|graph|series|pie|bar|line-chart|axis|plot|legend|dataset|data-viz|canvas)/i.test(line)) {
      return 'chart';
    }
    if (/\.(btn|button|link|nav|menu|sidebar|header|footer|title|label|text|input|border|card|modal|table|page|query|action|tab|pagination|sort)/i.test(line)) {
      return 'clear';
    }
    return 'ambiguous';
  }
  // HTML 属性行：按附近 HTML 元素判断
  if (/canvas|chart|graph|series|d3\.|echarts|highcharts|plot|data-viz|visualization|legend|\.pie|\.bar|axis|dataset/i.test(context)) {
    return 'chart';
  }
  if (/<path.*d=|<polygon|<polyline|<circle.*cx|stroke-dasharray/i.test(context)) {
    return 'chart';
  }
  if (/(logo|brand|top-nav|icon-|btn|button|nav|menu|sidebar)/i.test(line)) {
    return 'clear';
  }
  return 'ambiguous';
}

/** 取前后各 5 行上下文（S34/S40 分类用） */
export function contextAround(lines, lineNo) {
  const start = Math.max(0, lineNo - 6);
  const end = Math.min(lines.length, lineNo + 5);
  return lines.slice(start, end).join('\n');
}

/** 打印扫描结果汇总（plain 风格：validate / style-scan 共用） */
export function printPlainSummary({ kind, total, pass, warn, fail, skip, quiet }) {
  if (quiet) {
    console.log(`汇总: PASS=${pass} WARN=${warn} FAIL=${fail} SKIP=${skip} (共${total}/${kind}项)`);
    return;
  }
  console.log('============================================');
  console.log(kind === 6 ? '校验结果汇总' : '📊 样式扫描结果汇总');
  console.log('============================================');
  console.log(`  PASS: ${pass}`);
  console.log(`  WARN: ${warn}`);
  console.log(`  FAIL: ${fail}`);
  if (skip > 0) console.log(`  SKIP: ${skip}`);
  console.log('');
}

/** 以 bash 版一致的退出码退出：FAIL>0 → 1，否则 0 */
export function exitByFail(fail, opts = {}) {
  const { quiet = 0, kind = '' } = opts;
  if (fail > 0) {
    if (!quiet) {
      if (kind === 6) {
        console.log('存在必须修复的问题，请检查上方 FAIL 项');
        console.log('   资源类 FAIL：检查 common.css/common.js 是否从 ASSETS 正确复制');
        console.log(`   样式类问题：运行 node scripts/style-scan.mjs --quiet "<文件>"`);
      } else {
        console.log(`🔴 发现 ${fail} 项必须修复的样式偏差`);
        console.log('   📖 详细矫正方法见: REFERENCES/style-fix-cheatsheet.md');
        console.log('   🔧 资源类问题：检查 common.css/common.js 是否从 ASSETS 正确复制');
        console.log('');
        console.log('   📌 典型修复流程:');
        console.log('      1. 查看上方 FAIL 项的「矫正」字段');
        console.log('      2. 在 style-fix-cheatsheet.md 中查找对应编号获取完整修复代码');
        console.log('      3. 应用修复后重新运行本脚本验证');
      }
    }
    process.exit(1);
  }
  if (!quiet) {
    if (kind === 6) {
      console.log('全部通过！页面符合 JMBOS 设计系统规范');
    } else {
      console.log('🟢 全部通过！样式完全符合 JMBOS 设计规范 ✓');
    }
  }
  process.exit(0);
}
