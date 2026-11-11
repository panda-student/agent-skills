#!/usr/bin/env node
'use strict';
const { runScan } = require('./lib/scan');
const { toText } = require('./lib/report');
const { createDefaultRegistry, loadToolModules } = require('./lib/registry');
const pkg = require('./package.json');

const HELP = `codescan — 确定性代码质量扫描 CLI(供 codescan 技能调用)

用法:
  codescan <目标文件或目录> [选项]

审查范围:
  --diff [ref]       只报告 ref → 工作区 新增行上的发现,并包含未跟踪文件;ref 缺省 HEAD
  --diff-commit ref  只报告该提交自身的改动(等价于 git diff ref^ ref)
  --staged           只报告暂存区(ref → index)的改动

输出与工具:
  --format json|text 输出格式,默认 json(技能消费),text 为人读
  --tools a,b,c      指定工具子集: jscpd,astgrep,pmd,eslint,tsc,knip(默认按语言自动)
  --tool-module PATH 加载外部工具适配器(可重复),同名覆盖内置工具
  --list-tools       列出已注册工具(含外部模块)
  --jobs N           并发执行的工具数,默认 4
  --min-tokens N     jscpd 重复判定阈值,默认 70
  --pmd-home PATH    PMD 目录,默认包内 pmd-bin-6.55.0(缺失时自动从官方 release 下载)
  --timeout ms       单工具超时,默认 300000
  --max-findings N   报告上限,默认 200
  --fail-on-tool-error  有工具 error/partial 时以退出码 4 结束(CI 用)
  -v, --version      版本
  -h, --help         帮助

输出 finding 字段:
  tool/rule/dimension(reuse|srp|quality|performance|kiss)/severity(high|medium|low|info)/file/line/message

工具状态:
  ok       成功执行
  skipped  前置条件不满足(未安装依赖、无配置等),本次未检查
  partial  执行了但部分文件/批次失败,结果不完整
  error    执行失败,结果不可用

退出码:
  0 成功  1 用法错误  2 目标错误  3 内部异常  4 工具未完整执行(--fail-on-tool-error)`;

function parseArgs(argv) {
  const args = {
    format: 'json', tools: null, minTokens: 70, pmdHome: null, timeoutMs: 300000,
    maxFindings: 200, diff: false, diffRef: 'HEAD', diffCommit: null, staged: false,
    jobs: 4, failOnToolError: false, toolModules: [], listTools: false,
  };
  const pos = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--diff') {
      args.diff = true;
      const nx = argv[i + 1];
      if (nx && !nx.startsWith('-')) { args.diffRef = nx; i++; }
    } else if (a === '--diff-commit') {
      args.diff = true;
      const nx = argv[i + 1];
      if (!nx || nx.startsWith('-')) { args.invalid = '--diff-commit 需要一个 ref'; return args; }
      args.diffCommit = nx;
      i++;
    } else if (a === '--staged') {
      args.diff = true;
      args.staged = true;
    } else if (a === '--format') args.format = argv[++i];
    else if (a === '--tools') args.tools = String(argv[++i] || '').split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--tool-module') {
      const v = argv[++i];
      if (!v) { args.invalid = '--tool-module 需要一个路径'; return args; }
      args.toolModules.push(v);
    } else if (a === '--list-tools') args.listTools = true;
    else if (a === '--jobs') args.jobs = parseInt(argv[++i], 10) || 4;
    else if (a === '--min-tokens') args.minTokens = parseInt(argv[++i], 10) || 70;
    else if (a === '--pmd-home') args.pmdHome = argv[++i];
    else if (a === '--timeout') args.timeoutMs = parseInt(argv[++i], 10) || 300000;
    else if (a === '--max-findings') args.maxFindings = parseInt(argv[++i], 10) || 200;
    else if (a === '--fail-on-tool-error') args.failOnToolError = true;
    else if (a === '-v' || a === '--version') args.version = true;
    else if (a === '-h' || a === '--help') args.help = true;
    else pos.push(a);
  }
  args.target = pos[0];
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.version) {
    console.log(pkg.version);
    process.exit(0);
  }
  if (args.invalid) {
    console.error('ERROR: ' + args.invalid);
    process.exit(1);
  }

  let registry;
  try {
    registry = loadToolModules(createDefaultRegistry(), args.toolModules);
  } catch (e) {
    console.error('ERROR: ' + e.message);
    process.exit(1);
  }

  if (args.listTools) {
    console.log(['name', 'languages', 'dimensions', 'description'].join('\t'));
    for (const t of registry.list()) {
      console.log([t.name, t.languages.join(','), (t.dimensions || []).join(','), t.description || ''].join('\t'));
    }
    process.exit(0);
  }

  if (args.help || !args.target) {
    console.log(HELP);
    process.exit(args.help ? 0 : 1);
  }
  if (!['json', 'text'].includes(args.format)) {
    console.error(`ERROR: 不支持的 --format ${args.format}(可选 json|text)`);
    process.exit(1);
  }
  if (args.diff && args.diffCommit && args.staged) {
    console.error('ERROR: --diff-commit 与 --staged 不能同时使用');
    process.exit(1);
  }

  const report = await runScan(args, { registry });
  if (report.error) {
    console.error('ERROR: ' + report.error);
    process.exit(2);
  }
  console.log(args.format === 'text' ? toText(report) : JSON.stringify(report, null, 2));
  if (args.failOnToolError && !report.ok) process.exit(4);
}

main().catch((e) => { console.error('FATAL: ' + (e && e.stack || e)); process.exit(3); });