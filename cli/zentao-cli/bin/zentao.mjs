#!/usr/bin/env node
/**
 * zentao CLI — 逻辑编排入口（ESM）
 *
 * 职责：参数解析 → 命令路由 → 帮助信息。不含业务逻辑与 API 调用。
 *
 * 分层结构（src/，全部 ESM .mjs）：
 *   types.mjs             类型定义（JSDoc typedefs）
 *   config.mjs            配置加载/写入（%USERPROFILE%\.zentao\config.json）
 *   utils/                工具类：flags 参数解析 / 日期 / 数值 / JSON 输出
 *   protocol/             通信协议：http-client（HTTP 客户端）+ endpoints（接口定义）
 *   auth.mjs              认证：Token 获取、当前用户
 *   services/             业务逻辑：story（创建）/ task（查询与工时API）/ worklog-rules（硬规则）
 *   commands/             命令实现（按业务域分组）：
 *                           account.mjs     setup / login
 *                           fetch-data.mjs  fetch-data
 *                           story.mjs       preview / create
 *                           task-query.mjs  my-work / my-tasks / task / tasks
 *                           worklog.mjs     effort / close
 *
 * 工时硬性规则（services/worklog-rules.mjs + AI 共同保证）：
 *   1. 每天所有任务工时总和 ≤ 8h（按填写日期统计）
 *   2. 单任务总消耗（consumed）≤ 预计工时（estimate）
 *   3. 剩余工时（left）为 0 → 自动完成任务并关闭
 *   4. 工时日期超过任务截止时间（deadline）→ 先调整截止时间再填写/关闭
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseFlags } from '../src/utils/flags.mjs';
import { usageError } from '../src/utils/output.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VERSION = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8')).version;

import * as account from '../src/commands/account.mjs';
import * as fetchData from '../src/commands/fetch-data.mjs';
import * as story from '../src/commands/story.mjs';
import * as taskQuery from '../src/commands/task-query.mjs';
import * as worklog from '../src/commands/worklog.mjs';

function printHelp() {
    console.log(`
zentao CLI v${VERSION} — 禅道 JSON API 命令行工具

用法:
  zentao setup --base-url <API地址> --account <账号> --password <密码> [--assignee <默认指派人>]
      配置禅道账号信息（写入 %USERPROFILE%\\.zentao\\config.json；也支持 setup '<json>' 或 setup <json文件路径>）

  zentao login
      登录并获取所有产品(ID+名称)和执行(ID+名称)

  zentao preview <json文件路径>
      预览创建内容，输出中文字段的完整清单

  zentao create <json文件路径> [test]
      创建 Story + Tasks
      加 test 参数（或 --test）：只创建第1条作为测试，返回链接
      不加 test 参数：批量创建全部

  zentao my-work [状态过滤]
      列出"我的任务"（禅道 my-work-task 页面数据源，无需执行ID；可选 wait/doing 过滤）

  zentao my-tasks <执行ID>
      列出当前账号在该执行下的全部任务(状态/预计/消耗/剩余)

  zentao task <任务ID>
      查看任务详情(状态/预计/消耗/剩余 + efforts工时明细)

  zentao tasks <ID1,ID2,...>
      批量查看任务详情，并输出 dailyTotals(当前账号按日期已填工时汇总，8小时/天校验用)

  zentao effort <json文件路径或'{json}'>
  zentao effort --task-id <任务ID> --date <YYYY-MM-DD> --consumed <小时> [--left <剩余>] [--work "<工作内容>"] [--deadline <YYYY-MM-DD>] [--no-auto-close]
      填写工时；left 省略时自动按 当前剩余-本次消耗 计算
      deadline 省略时，若工时日期超过任务截止时间会自动调整为工时日期；指定时不得早于工时日期
      剩余为0时自动完成任务并关闭(--no-auto-close 可关闭该行为)

  zentao close <任务ID>
      关闭任务(仅 done/cancel 状态可关闭)

  zentao --version | -v
      查看版本

数据文件格式 (JSON):
{
  "productId": <产品ID>,
  "executionId": <执行ID>,
  "stories": [
    {
      "title": "系统名：模块-功能",
      "spec": "系统名\\n功能描述",
      "module": <模块ID>,
      "assignedTo": "<账号>",
      "pri": 3,
      "tasks": [
        {
          "name": "系统名：模块-功能：细节点",
          "assignedTo": "<账号>",
          "estStarted": "2026-08-03",
          "deadline": "2026-08-09",
          "module": <模块ID>,
          "type": "devel",
          "pri": 3,
          "estimate": 4,
          "desc": "任务描述"
        }
      ]
    }
  ]
}
`);
}

/** 读取第一个非 flag 位置参数 */
function firstPositional(rest) {
    return rest.find(a => !a.startsWith('--'));
}

/** 读取 JSON 参数：文件路径或内联 JSON 字符串 */
function readJsonArg(arg) {
    return fs.existsSync(arg) ? JSON.parse(fs.readFileSync(arg, 'utf-8')) : JSON.parse(arg);
}

async function main() {
    const argv = process.argv.slice(2);
    const command = argv[0];
    const rest = argv.slice(1);

    switch (command) {
        case '--version':
        case '-v':
            console.log(VERSION);
            break;

        case '--help':
        case '-h':
        case undefined:
            printHelp();
            break;

        case 'setup': {
            const flags = parseFlags(rest);
            let input = null;
            if (flags.baseUrl || flags.account || flags.password) {
                input = { baseUrl: flags.baseUrl, account: flags.account, password: flags.password, assignee: flags.assignee };
            } else {
                const first = firstPositional(rest);
                if (first) input = readJsonArg(first);
            }
            if (!input || !input.baseUrl || !input.account || !input.password) {
                usageError('setup 需要 baseUrl/account/password。用法: zentao setup --base-url <API地址> --account <账号> --password <密码> [--assignee <默认指派人>]');
            }
            await account.cmdSetup(input);
            break;
        }

        case 'login':
            await account.cmdLogin();
            break;

        case 'fetch-data':
            if (!rest[0] || !rest[1]) usageError('用法: zentao fetch-data <产品ID> <执行ID>');
            await fetchData.cmdFetchData(rest[0], rest[1]);
            break;

        case 'preview': {
            const pArg = firstPositional(rest);
            if (!pArg) usageError('用法: zentao preview <json文件路径>');
            await story.cmdPreview(readJsonArg(pArg));
            break;
        }

        case 'create': {
            const flags = parseFlags(rest);
            const cPath = firstPositional(rest);
            if (!cPath) usageError('用法: zentao create <json文件路径> [test]');
            const isTest = rest[1] === 'test' || (flags.test !== undefined && flags.test !== 'false');
            await story.cmdCreate(readJsonArg(cPath), isTest);
            break;
        }

        case 'my-work':
            await taskQuery.cmdMyWork(rest[0]);
            break;

        case 'my-tasks':
            if (!rest[0]) usageError('用法: zentao my-tasks <执行ID>');
            await taskQuery.cmdMyTasks(rest[0]);
            break;

        case 'task':
            if (!rest[0]) usageError('用法: zentao task <任务ID>');
            await taskQuery.cmdTask(rest[0]);
            break;

        case 'tasks':
            if (!rest[0]) usageError('用法: zentao tasks <ID1,ID2,...>');
            await taskQuery.cmdTasks(rest[0]);
            break;

        case 'effort': {
            const flags = parseFlags(rest);
            let input;
            if (flags.taskId || flags.date || flags.consumed !== undefined) {
                input = {
                    taskId: flags.taskId,
                    date: flags.date,
                    consumed: flags.consumed,
                    left: flags.left,
                    work: flags.work,
                    deadline: flags.deadline
                };
                if (flags.noAutoClose) input.autoClose = false;
            } else {
                const eArg = rest[0];
                if (!eArg) usageError('用法: zentao effort --task-id <任务ID> --date <YYYY-MM-DD> --consumed <小时> [--left <剩余>] [--work "<工作内容>"] [--deadline <YYYY-MM-DD>] [--no-auto-close]；或 zentao effort <json文件路径>');
                input = readJsonArg(eArg);
            }
            await worklog.cmdEffort(input);
            break;
        }

        case 'close':
            if (!rest[0]) usageError('用法: zentao close <任务ID>');
            await worklog.cmdClose(rest[0]);
            break;

        default:
            usageError(`未知命令: ${command}，运行 zentao --help 查看用法`);
    }
}

main().catch(e => {
    console.error(JSON.stringify({ status: 'error', message: e.message }));
    process.exit(1);
});
