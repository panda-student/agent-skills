#!/usr/bin/env node
/**
 * dbx CLI：数据库 / Redis / Nacos 客户端（DBX）子命令封装。
 * DBX 的 MCP 二进制只讲 MCP 协议，本脚本经 mcp-client（stdio 传输）与其通信。
 *
 * 用法：
 *   dbx tools [--json]                                       工具清单（31 个，权威参考）
 *   dbx connections                                          列出已配置连接
 *   dbx databases [--conn N]                                 列出连接可用库
 *   dbx tables [--conn N] [--db N]                           列出表/视图
 *   dbx describe [--conn N] [--db N] TABLE                   表结构
 *   dbx query [--conn N] [--db N] [--rows N] [--cell N] "SQL"   查询（默认100行/格200字符，可放宽）
 *   dbx batch [--conn N] [--db N] "多语句SQL脚本"             方言感知分句批量执行
 *   dbx call <tool> [json参数]                               其余工具原样透传（nacos、session、事务、redis 等）
 *
 * 环境变量 DBX_BIN 覆盖二进制路径；--timeout=毫秒 调整单请求超时。
 * --conn 是连接名称（connection_name），--db 是 database。
 */
import { withClient, McpClient } from "mcp-client";

const COMMAND = process.env.DBX_BIN
  || "D:/nodejs/node_modules/@dbx-app/mcp-server/node_modules/@dbx-app/mcp-win32-x64/bin/dbx-mcp.exe";
const ARGS = [];

function stdio(opts) {
  return {
    transport: "stdio",
    command: COMMAND,
    args: ARGS,
    timeoutMs: opts.timeoutMs,
    clientInfo: { name: "dbx-cli", version: "1.0.0" },
  };
}

function parseArgs(argv) {
  const opts = { json: false, timeoutMs: 120000 };
  const rest = [];
  const flags = ["conn", "db"];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const hit = flags.find((f) => a === "--" + f);
    if (hit) opts[hit] = argv[++i];
    else if (a === "--json") opts.json = true;
    else if (a.startsWith("--timeout=")) opts.timeoutMs = Number(a.slice(10)) || 120000;
    else rest.push(a);
  }
  return { opts, rest };
}

function emit(result) {
  const text = McpClient.resultText(result);
  if (result && result.isError) {
    console.error(text);
    process.exit(1);
  }
  console.log(text);
}

async function run(opts, fn) {
  try {
    emit(await withClient(stdio(opts), fn));
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

async function printTools(opts) {
  const tools = await withClient(stdio(opts), (c) => c.listTools());
  if (opts.json) console.log(JSON.stringify(tools, null, 2));
  else for (const t of tools) console.log(t.name + " — " + (t.description || "").split("\n")[0]);
}

/** 组装连接定位参数 */
function target(opts) {
  const t = {};
  if (opts.conn) t.connection_name = opts.conn;
  if (opts.db) t.database = opts.db;
  return t;
}

function parseJsonArg(items) {
  try {
    return items.length ? JSON.parse(items.join(" ")) : {};
  } catch (e) {
    console.error("JSON 参数解析失败: " + e.message);
    process.exit(2);
  }
}

const { opts, rest } = parseArgs(process.argv.slice(2));
const [cmd, ...positional] = rest;

switch (cmd) {
  case "tools":
    await printTools(opts);
    break;
  case "connections":
    await run(opts, (c) => c.callTool("dbx_list_connections", {}));
    break;
  case "databases":
    await run(opts, (c) => c.callTool("dbx_list_databases", target(opts)));
    break;
  case "tables":
    await run(opts, (c) => c.callTool("dbx_list_tables", target(opts)));
    break;
  case "describe": {
    const table = positional[0];
    if (!table) { console.error("用法: dbx describe [--conn N] [--db N] TABLE"); process.exit(2); }
    await run(opts, (c) => c.callTool("dbx_describe_table", { ...target(opts), table }));
    break;
  }
  case "query": {
    const sql = positional.join(" ");
    if (!sql) { console.error('用法: dbx query [--conn N] [--db N] [--rows N] "SQL"'); process.exit(2); }
    const args = { ...target(opts), sql };
    if (opts.rows) args.max_rows = Number(opts.rows);
    if (opts.cell) args.cell_char_limit = Number(opts.cell);
    await run(opts, (c) => c.callTool("dbx_execute_query", args));
    break;
  }
  case "batch": {
    const sql = positional.join(" ");
    if (!sql) { console.error('用法: dbx batch [--conn N] [--db N] "多语句SQL脚本"'); process.exit(2); }
    await run(opts, (c) => c.callTool("dbx_execute_batch", { ...target(opts), sql }));
    break;
  }
  case "call": {
    const tool = positional[0];
    if (!tool) { console.error("用法: dbx call <tool> [json参数]"); process.exit(2); }
    const argsObj = parseJsonArg(positional.slice(1));
    await run(opts, (c) => c.callTool(tool, argsObj));
    break;
  }
  default:
    console.error("用法: dbx tools | connections | databases | tables | describe | query | batch | call（详见文件头注释）");
    process.exit(2);
}
