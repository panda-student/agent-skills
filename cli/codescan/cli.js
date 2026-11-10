#!/usr/bin/env node
'use strict';
const { runScan } = require('./lib/scan');
const { toText } = require('./lib/report');

const HELP = `codescan — 确定性代码质量扫描 CLI(供 codescan 技能调用)

用法:
  node cli.js <目标文件或目录> [选项]

选项:
  --diff [ref]     只报告 diff 新增行上的发现;ref 缺省 HEAD(未提交变更)
  --format json|text  输出格式,默认 json(技能消费),text 为人读
  --tools a,b,c    指定工具子集: jscpd,astgrep,pmd,eslint,tsc,knip(默认按语言自动)
  --min-tokens N   jscpd 重复判定阈值,默认 70
  --pmd-home PATH  PMD 目录,默认包内 pmd-bin-6.55.0(缺失时自动从官方 release 下载)
  --timeout ms     单工具超时,默认 300000
  --max-findings N 报告上限,默认 200
  -h, --help       帮助

输出 finding 字段: tool/rule/dimension(reuse|srp|quality|performance|kiss)/severity(high|medium|low|info)/file/line/message`;

function parseArgs(argv) {
  const args = { format: 'json', tools: null, minTokens: 70, pmdHome: null, timeoutMs: 300000, maxFindings: 200, diff: false, diffRef: 'HEAD' };
  const pos = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--diff') {
      args.diff = true;
      const nx = argv[i + 1];
      if (nx && !nx.startsWith('-')) { args.diffRef = nx; i++; }
    } else if (a === '--format') args.format = argv[++i];
    else if (a === '--tools') args.tools = String(argv[++i] || '').split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--min-tokens') args.minTokens = parseInt(argv[++i], 10) || 70;
    else if (a === '--pmd-home') args.pmdHome = argv[++i];
    else if (a === '--timeout') args.timeoutMs = parseInt(argv[++i], 10) || 300000;
    else if (a === '--max-findings') args.maxFindings = parseInt(argv[++i], 10) || 200;
    else if (a === '-h' || a === '--help') args.help = true;
    else pos.push(a);
  }
  args.target = pos[0];
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.target) {
    console.log(HELP);
    process.exit(args.help ? 0 : 1);
  }
  const report = await runScan(args);
  if (report.error) {
    console.error('ERROR: ' + report.error);
    process.exit(2);
  }
  console.log(args.format === 'text' ? toText(report) : JSON.stringify(report, null, 2));
}

main().catch((e) => { console.error('FATAL: ' + (e && e.stack || e)); process.exit(3); });
