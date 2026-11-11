'use strict';
const fs = require('fs');
const path = require('path');
const { sh, disp } = require('../util');
const { findUp } = require('../detect');

const RULESET = path.join(__dirname, '..', '..', 'rules', 'pmd-codescan.xml');
// PMD 是公共依赖,不入 git 仓库:首次使用自动下载官方 release 到包目录(已 gitignore)
const PMD_VERSION = process.env.CODESCAN_PMD_VERSION || '6.55.0'; // PMD 7 需 JDK11+,PMD 6 兼容 Java 8
const PMD_HOME = path.join(__dirname, '..', '..', `pmd-bin-${PMD_VERSION}`);
const PMD_URL = `https://github.com/pmd/pmd/releases/download/pmd_releases/${PMD_VERSION}/pmd-bin-${PMD_VERSION}.zip`;
const HOME = path.join(__dirname, '..', '..');
// PMD 6.55 最高支持到 Java 19;更高版本先按 19 解析并在 detail 里说明
const PMD_MAX_JAVA = 19;

/** zip 魔数校验(PK):防代理故障产出"错误页+续传字节"的混合文件 */
function isZip(p) {
  try {
    const fd = fs.openSync(p, 'r');
    const buf = Buffer.alloc(4);
    fs.readSync(fd, buf, 0, 4, 0);
    fs.closeSync(fd);
    return buf[0] === 0x50 && buf[1] === 0x4b;
  } catch {
    return false;
  }
}

/** 用 Windows 自带 bsdtar 解压(注意:PATH 里 Git 的 GNU tar 不支持 zip,必须绝对路径;
 *  且 -C 带盘符冒号会被解析成远程主机,必须用相对路径 + cwd) */
async function extractPmd(zipName) {
  const bsdTar = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
  await sh(`"${disp(bsdTar)}" -xf ${zipName} -C .`, { cwd: HOME, timeoutMs: 300000 });
  return fs.existsSync(path.join(PMD_HOME, 'bin', 'pmd.bat'));
}

/** 确保 PMD 可执行;缺失时自动下载解压(curl 断点续传 + bsdtar) */
async function ensurePmd() {
  if (fs.existsSync(path.join(PMD_HOME, 'bin', 'pmd.bat'))) return { ok: true };
  const zipName = `pmd-bin-${PMD_VERSION}.zip`;
  const zipAbs = path.join(HOME, zipName);
  fs.mkdirSync(HOME, { recursive: true });
  // GitHub 直连在本机网络下极慢,优先走 ghfast.top 镜像(与 git remote fetch 同策略),直连兜底
  const urls = [
    `https://ghfast.top/${PMD_URL}`,
    PMD_URL,
  ];
  const done = () => {
    try { fs.unlinkSync(zipAbs); } catch { /* 临时 zip 清理失败无碍 */ }
    return { ok: true, downloaded: true };
  };
  for (const url of urls) {
    for (let attempt = 0; attempt < 3; attempt++) {
      // 已有合法 zip(此前可能已下完)先直接尝试解压
      if (fs.existsSync(zipAbs) && isZip(zipAbs) && await extractPmd(zipName)) return done();
      if (fs.existsSync(zipAbs) && !isZip(zipAbs)) {
        try { fs.unlinkSync(zipAbs); } catch { /* 占用时忽略,下次重试 */ }
      }
      // -C - 断点续传:慢网络下多次重试可累积完成
      const dl = await sh(`curl -sSL -C - -o ${zipName} "${url}"`, { cwd: HOME, timeoutMs: 900000 });
      if (dl.code === 0 && fs.existsSync(zipAbs) && fs.statSync(zipAbs).size > 10000000 && isZip(zipAbs)) {
        if (await extractPmd(zipName)) return done();
        return { ok: false, error: 'PMD 解压失败(下载完整但解压异常,可手动解压 ' + disp(zipAbs) + ' 到 ' + disp(PMD_HOME) + ')' };
      }
    }
  }
  return {
    ok: false,
    error: `PMD 自动下载失败(已重试)。请手动下载 ${PMD_URL} 解压到 ${disp(PMD_HOME)},或用 --pmd-home 指定已有安装`,
  };
}

// 规则 → 维度(未列出的默认 quality)
const DIMENSION = {
  GodClass: 'srp', TooManyMethods: 'srp', TooManyFields: 'srp', ExcessiveClassLength: 'srp',
  CyclomaticComplexity: 'kiss', ExcessiveMethodLength: 'kiss', ExcessiveParameterList: 'kiss',
  NcssMethodCount: 'kiss',
};
// 类级问题:diff 过滤时按"文件有变更"匹配(类声明行本身可能不在 diff 中)
const FILE_LEVEL_RULES = new Set(['GodClass', 'TooManyMethods', 'TooManyFields', 'ExcessiveClassLength']);

/** PMD 6.x 静态分析(Java):异常处理/潜在 bug + SRP/KISS 复杂度信号 */
async function run(ctx) {
  // --pmd-home 指向已存在的安装;不指定则用包内默认位置,缺失自动下载
  const pmdHome = ctx.args.pmdHome ? path.resolve(ctx.args.pmdHome) : PMD_HOME;
  if (!fs.existsSync(path.join(pmdHome, 'bin', 'pmd.bat'))) {
    if (ctx.args.pmdHome) {
      return { status: 'error', detail: `--pmd-home 指定目录不存在: ${disp(pmdHome)}`, findings: [] };
    }
    const ensured = await ensurePmd();
    if (!ensured.ok) return { status: 'error', detail: ensured.error, findings: [] };
  }

  const java = detectJavaVersion(ctx.targetAbs, ctx.repoRoot);
  const bat = path.join(pmdHome, 'bin', 'pmd.bat');
  const r = await sh(
    `"${disp(bat)}" -d "${disp(ctx.targetAbs)}" -R "${disp(RULESET)}" -f xml ` +
    `-language java -version ${java.version} --no-cache`,
    { cwd: HOME, timeoutMs: ctx.toolTimeout },
  );

  if (r.spawnError) {
    return { status: 'error', detail: `PMD 启动失败: ${(r.error || r.stderr || '').slice(0, 200)}`, findings: [] };
  }

  const out = r.stdout || '';
  // stderr 可能是 GBK 乱码,只用 ASCII 片段判断
  const errText = r.stderr || '';
  if (/Cannot load ruleset|No rules found/.test(errText)) {
    const m = errText.match(/Unable to find referenced rule \w+/);
    return { status: 'error', detail: 'ruleset 加载失败: ' + (m ? m[0] : '见 stderr'), findings: [] };
  }

  const findings = parseViolations(out);
  const errors = parseErrors(out);
  const javaNote = `java ${java.version}${java.source ? ` (${java.source})` : ''}` +
    (java.clamped ? `, 原值 ${java.detected} 超出 PMD ${PMD_VERSION} 上限` : '');

  // PMD 对无法解析的文件输出 <error> 而不是 <violation>,必须显式上报
  if (errors.length) {
    const sample = errors.slice(0, 3).map((e) => `${shortFile(ctx, e.file)}: ${e.msg}`).join(' | ');
    const detail = `${javaNote}; ${errors.length} 个文件未被分析: ${sample}`;
    return { status: findings.length ? 'partial' : 'error', detail, findings };
  }

  if (!out.includes('<violation')) {
    if (r.code !== 0 && r.code !== 4) {
      return { status: 'error', detail: `${javaNote}; PMD 退出码 ${r.code}: ${errText.slice(0, 300)}`, findings: [] };
    }
    if (/Exception|Error/.test(errText) && !/deprecated/.test(errText)) {
      return { status: 'error', detail: `${javaNote}; PMD 运行错误: ${errText.slice(0, 300)}`, findings: [] };
    }
    return { status: 'ok', detail: `${javaNote}; no violations`, findings: [] };
  }
  return { status: 'ok', detail: `${javaNote}; ${findings.length} violations`, findings };
}

function parseViolations(out) {
  const findings = [];
  const fileRe = /<file name="([^"]+)">([\s\S]*?)<\/file>/g;
  let fm;
  while ((fm = fileRe.exec(out))) {
    const file = disp(fm[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
    const vioRe = /<violation([^>]*)>([\s\S]*?)<\/violation>/g;
    let vm;
    while ((vm = vioRe.exec(fm[2]))) {
      const attrs = vm[1];
      const get = (k) => { const m = attrs.match(new RegExp(k + '="([^"]*)"')); return m ? m[1] : ''; };
      const rule = get('rule');
      const line = parseInt(get('beginline'), 10) || 0;
      const priority = parseInt(get('priority'), 10) || 3;
      const msg = vm[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
      findings.push({
        tool: 'pmd', rule, dimension: DIMENSION[rule] || 'quality',
        severity: priority <= 2 ? 'high' : priority === 3 ? 'medium' : 'low',
        file, line, message: msg,
        fileLevel: FILE_LEVEL_RULES.has(rule),
      });
    }
  }
  return findings;
}

function parseErrors(out) {
  const errors = [];
  const re = /<error\b([^>]*)\/?>/g;
  let m;
  while ((m = re.exec(out))) {
    const attrs = {};
    const ar = /([\w:-]+)="([^"]*)"/g;
    let am;
    while ((am = ar.exec(m[1]))) attrs[am[1]] = am[2];
    errors.push({ file: attrs.filename || '', msg: attrs.msg || '' });
  }
  return errors;
}

/**
 * 从项目构建文件推断 Java 版本;找不到时默认 17(按现代项目,且能解析旧语法)。
 * 返回 {version, source, detected, clamped}
 */
function detectJavaVersion(startAbs, repoRoot) {
  const candidates = [
    ['pom.xml', (txt) => firstMatch(txt, [
      /<java\.version>\s*([^<]+?)\s*<\/java\.version>/,
      /<maven\.compiler\.release>\s*([^<]+?)\s*<\/maven\.compiler\.release>/,
      /<maven\.compiler\.source>\s*([^<]+?)\s*<\/maven\.compiler\.source>/,
      /<maven\.compiler\.target>\s*([^<]+?)\s*<\/maven\.compiler\.target>/,
      /<source>\s*([^<]+?)\s*<\/source>/,
    ])],
    ['build.gradle', (txt) => firstMatch(txt, [
      /sourceCompatibility\s*[=:]\s*['"]?(?:JavaVersion\.VERSION_)?(\d+(?:\.\d+)?)/,
      /targetCompatibility\s*[=:]\s*['"]?(?:JavaVersion\.VERSION_)?(\d+(?:\.\d+)?)/,
      /JavaVersion\.VERSION_(\d+)/,
    ])],
    ['build.gradle.kts', (txt) => firstMatch(txt, [
      /JavaVersion\.VERSION_(\d+)/,
      /jvmTarget\s*=\s*['"]?(?:JvmTarget\.)?JVM_(\d+)/,
      /sourceCompatibility\s*=\s*['"]?(?:JavaVersion\.VERSION_)?(\d+(?:\.\d+)?)/,
    ])],
    ['gradle.properties', (txt) => firstMatch(txt, [
      /org\.gradle\.java\.version\s*=\s*(\d+(?:\.\d+)?)/,
      /java\.version\s*=\s*(\d+(?:\.\d+)?)/,
    ])],
    ['.java-version', (txt) => (txt.trim().match(/^(\d+(?:\.\d+)?)/) || [])[1]],
  ];

  for (const [file, extract] of candidates) {
    const hit = searchUpForVersion(startAbs, repoRoot, file, extract);
    if (hit) return normalizeJavaVersion(hit.raw, file);
  }
  return { version: '17', source: 'default', detected: '17', clamped: false };
}

/** 子模块 pom 未声明版本时继续向上找父 pom */
function searchUpForVersion(startAbs, repoRoot, file, extract) {
  let from = startAbs;
  for (;;) {
    const dir = findUp(from, [file], repoRoot);
    if (!dir) return null;
    try {
      const raw = extract(fs.readFileSync(path.join(dir, file), 'utf8'));
      if (raw) return { raw, dir };
    } catch { /* 读不了就继续向上 */ }
    if (dir === repoRoot) return null;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    from = parent;
  }
}

function normalizeJavaVersion(raw, source) {
  const s = String(raw).trim();
  // 1.8 / 1.8.0_202 → 8;17 / 17.0.2 → 17;8u202 → 8
  const m = s.match(/^1\.(\d+)/) || s.match(/^(\d+)/);
  const n = m ? parseInt(m[1], 10) : NaN;
  if (!n || n < 8) return { version: '1.8', source, detected: s, clamped: false };
  if (n === 8) return { version: '1.8', source, detected: s, clamped: false };
  if (n > PMD_MAX_JAVA) return { version: String(PMD_MAX_JAVA), source, detected: s, clamped: true };
  return { version: String(n), source, detected: s, clamped: false };
}

function firstMatch(txt, regexes) {
  for (const re of regexes) {
    const m = txt.match(re);
    if (m) return m[1];
  }
  return null;
}

function shortFile(ctx, file) {
  if (!file) return '(unknown)';
  if (ctx.repoRoot && file.toLowerCase().startsWith(ctx.repoRoot.toLowerCase())) {
    return file.slice(ctx.repoRoot.length + 1).replace(/\\/g, '/');
  }
  return file.replace(/\\/g, '/');
}

module.exports = {
  name: 'pmd',
  languages: ['java'],
  dimensions: ['quality', 'srp', 'kiss'],
  description: 'Java 静态分析',
  run,
  detectJavaVersion,
  normalizeJavaVersion,
};