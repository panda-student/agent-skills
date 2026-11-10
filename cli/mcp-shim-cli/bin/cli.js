#!/usr/bin/env node
/**
 * MCP-shim 通用入口：把「只讲 MCP 协议」的二进制封装成 CLI 子命令。
 *
 * dbx（数据库/Nacos 客户端 MCP）：
 *   dbx connections                          列出已配置连接
 *   dbx databases [--conn N]                 列出连接可用库
 *   dbx tables [--conn N] [--db N]           列出表/视图
 *   dbx describe [--conn N] [--db N] TABLE   表结构
 *   dbx query [--conn N] [--db N] [--rows N] [--cell N] "SQL"   查询（默认100行，上限1000）
 *   dbx batch [--conn N] [--db N] "多语句SQL脚本"                批量执行（方言感知分句）
 *   dbx call <tool> [json]                   其余 31 个工具的原样透传（nacos、session、事务、redis 等）
 *
 * vault（凭据库 MCP）：
 *   vault search [关键词] [--tag T] [--kind password|api|database|generic]   搜条目（只出元数据，不出密文）
 *   vault get ID [ID...]                     按 id 读条目元数据
 *   vault fill CREDENTIAL_ID --field password --file PATH [--mode create|replace] [--group GID]
 *                                            把凭据密文写入目标文件（不回显明文）
 *   vault call <tool> [json]                 其余工具原样透传（update/export/pin/organize/capture_fill_target…）
 *
 * 二进制路径可用环境变量覆盖：VAULT_BIN / DBX_BIN；--timeout=毫秒 调整单请求超时。
 */
import { withClient, McpStdioClient } from "../lib/mcp-client.js";

export const PROFILES = {
  vault: {
    command: process.env.VAULT_BIN || "D:/vault/vault.exe",
    args: ["--mcp"],
  },
  dbx: {
    command: process.env.DBX_BIN || "D:/nodejs/node_modules/@dbx-app/mcp-server/node_modules/@dbx-app/mcp-win32-x64/bin/dbx-mcp.exe",
    args: [],
  },
};

function parseArgs(argv) {
  const opts = { json: false, timeoutMs: 120000 };
  const rest = [];
  const flagNames = ["conn", "db", "rows", "cell", "tag", "kind", "field", "file", "mode", "group"];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const hit = flagNames.find((f) => a === "--" + f);
    if (hit) {
      opts[hit] = argv[++i];
    } else if (a === "--json") {
      opts.json = true;
    } else if (a.startsWith("--timeout=")) {
      opts.timeoutMs = Number(a.slice(10)) || 120000;
    } else {
      rest.push(a);
    }
  }
  return { opts, rest };
}

function emit(result) {
  const text = McpStdioClient.resultText(result);
  if (result && result.isError) {
    console.error(text);
    process.exit(1);
  }
  console.log(text);
}

async function run(profile, opts, fn) {
  try {
    const result = await withClient(profile.command, profile.args, { timeoutMs: opts.timeoutMs }, fn);
    emit(result);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

/** 组装 dbx 连接定位参数（--conn 是 connection_name，--db 是 database） */
function dbxTarget(opts) {
  const t = {};
  if (opts.conn) t.connection_name = opts.conn;
  if (opts.db) t.database = opts.db;
  return t;
}

export async function main(profileName, argv) {
  const profile = PROFILES[profileName];
  if (!profile) {
    console.error(`未知 profile: ${profileName}`);
    process.exit(2);
  }
  const { opts, rest } = parseArgs(argv);
  const [cmd, ...positional] = rest;

  if (profileName === "dbx") {
    switch (cmd) {
      case "tools": {
        const tools = await withClient(profile.command, profile.args, { timeoutMs: opts.timeoutMs }, (c) => c.listTools());
        if (opts.json) console.log(JSON.stringify(tools, null, 2));
        else for (const t of tools) console.log(t.name + " — " + (t.description || "").split("\n")[0]);
        return;
      }
      case "connections":
        return run(profile, opts, (c) => c.callTool("dbx_list_connections", {}));
      case "databases":
        return run(profile, opts, (c) => c.callTool("dbx_list_databases", dbxTarget(opts)));
      case "tables":
        return run(profile, opts, (c) => c.callTool("dbx_list_tables", dbxTarget(opts)));
      case "describe": {
        const table = positional[0];
        if (!table) { console.error('用法: dbx describe [--conn N] [--db N] TABLE'); process.exit(2); }
        return run(profile, opts, (c) => c.callTool("dbx_describe_table", { ...dbxTarget(opts), table }));
      }
      case "query": {
        const sql = positional.join(" ");
        if (!sql) { console.error('用法: dbx query [--conn N] [--db N] [--rows N] "SQL"'); process.exit(2); }
        const args = { ...dbxTarget(opts), sql };
        if (opts.rows) args.max_rows = Number(opts.rows);
        if (opts.cell) args.cell_char_limit = Number(opts.cell);
        return run(profile, opts, (c) => c.callTool("dbx_execute_query", args));
      }
      case "batch": {
        const sql = positional.join(" ");
        if (!sql) { console.error('用法: dbx batch [--conn N] [--db N] "多语句SQL脚本"'); process.exit(2); }
        return run(profile, opts, (c) => c.callTool("dbx_execute_batch", { ...dbxTarget(opts), sql }));
      }
      case "call": {
        const tool = positional[0];
        if (!tool) { console.error("用法: dbx call <tool> [json参数]"); process.exit(2); }
        let argsObj = {};
        try { argsObj = positional[1] ? JSON.parse(positional.slice(1).join(" ")) : {}; }
        catch (e) { console.error("JSON 参数解析失败: " + e.message); process.exit(2); }
        return run(profile, opts, (c) => c.callTool(tool, argsObj));
      }
      default:
        console.error("用法: dbx connections|databases|tables|describe|query|batch|call …（详见文件头注释）");
        process.exit(2);
    }
  }

  if (profileName === "vault") {
    switch (cmd) {
      case "tools": {
        const tools = await withClient(profile.command, profile.args, { timeoutMs: opts.timeoutMs }, (c) => c.listTools());
        if (opts.json) console.log(JSON.stringify(tools, null, 2));
        else for (const t of tools) console.log(t.name + " — " + (t.description || "").split("\n")[0]);
        return;
      }
      case "search": {
        const item = {};
        const q = positional.join(" ");
        if (q) item.query = q;
        if (opts.tag) item.tag = opts.tag;
        if (opts.kind) item.kind = opts.kind;
        return run(profile, opts, (c) => c.callTool("search_entries", { items: [item] }));
      }
      case "get": {
        if (!positional.length) { console.error("用法: vault get ID [ID...]"); process.exit(2); }
        return run(profile, opts, (c) => c.callTool("get_entries", { items: positional.map((id) => ({ id })) }));
      }
      case "fill": {
        const credentialId = positional[0];
        if (!credentialId || !opts.file || !opts.field) {
          console.error("用法: vault fill CREDENTIAL_ID --field password --file PATH [--mode create|replace] [--group GID]");
          process.exit(2);
        }
        const target = { type: "file", path: opts.file };
        if (opts.mode) target.mode = opts.mode;
        const args = { credentialId, field: opts.field, target };
        if (opts.group) args.groupId = opts.group;
        return run(profile, opts, (c) => c.callTool("write_credential", args));
      }
      case "call": {
        const tool = positional[0];
        if (!tool) { console.error("用法: vault call <tool> [json参数]"); process.exit(2); }
        let argsObj = {};
        try { argsObj = positional[1] ? JSON.parse(positional.slice(1).join(" ")) : {}; }
        catch (e) { console.error("JSON 参数解析失败: " + e.message); process.exit(2); }
        return run(profile, opts, (c) => c.callTool(tool, argsObj));
      }
      default:
        console.error("用法: vault search|get|fill|call …（详见文件头注释）");
        process.exit(2);
    }
  }

  console.error(`未知 profile: ${profileName}`);
  process.exit(2);
}
