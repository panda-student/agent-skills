#!/usr/bin/env node
/**
 * vault CLI：本机凭据密码库（vault.exe）子命令封装。
 * vault.exe 是纯 MCP 二进制（--mcp 才起协议），本脚本经 mcp-stdio-client 与其通信。
 *
 * 用法：
 *   vault tools [--json]                                     工具清单与参数模式
 *   vault search [关键词] [--tag T] [--kind password|api|database|generic]   搜条目（只出元数据）
 *   vault get ID [ID...]                                     按 id 读条目元数据
 *   vault fill ID --field password --file PATH [--mode create|replace] [--group GID]   密文写入目标文件
 *   vault call <tool> [json参数]                             其余工具原样透传
 *
 * 环境变量 VAULT_BIN 覆盖二进制路径；--timeout=毫秒 调整单请求超时。
 */
import { withClient, McpStdioClient } from "mcp-stdio-client";

const COMMAND = process.env.VAULT_BIN || "D:/vault/vault.exe";
const ARGS = ["--mcp"];

function parseArgs(argv) {
  const opts = { json: false, timeoutMs: 120000 };
  const rest = [];
  const flags = ["tag", "kind", "field", "file", "mode", "group"];
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
  const text = McpStdioClient.resultText(result);
  if (result && result.isError) {
    console.error(text);
    process.exit(1);
  }
  console.log(text);
}

async function run(opts, fn) {
  try {
    emit(await withClient(COMMAND, ARGS, { timeoutMs: opts.timeoutMs }, fn));
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

async function printTools(opts) {
  const tools = await withClient(COMMAND, ARGS, { timeoutMs: opts.timeoutMs }, (c) => c.listTools());
  if (opts.json) console.log(JSON.stringify(tools, null, 2));
  else for (const t of tools) console.log(t.name + " — " + (t.description || "").split("\n")[0]);
}

const { opts, rest } = parseArgs(process.argv.slice(2));
const [cmd, ...positional] = rest;

switch (cmd) {
  case "tools":
    await printTools(opts);
    break;
  case "search": {
    const item = {};
    const q = positional.join(" ");
    if (q) item.query = q;
    if (opts.tag) item.tag = opts.tag;
    if (opts.kind) item.kind = opts.kind;
    await run(opts, (c) => c.callTool("search_entries", { items: [item] }));
    break;
  }
  case "get": {
    if (!positional.length) { console.error("用法: vault get ID [ID...]"); process.exit(2); }
    await run(opts, (c) => c.callTool("get_entries", { items: positional.map((id) => ({ id })) }));
    break;
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
    await run(opts, (c) => c.callTool("write_credential", args));
    break;
  }
  case "call": {
    const tool = positional[0];
    if (!tool) { console.error("用法: vault call <tool> [json参数]"); process.exit(2); }
    let argsObj = {};
    try { argsObj = positional[1] ? JSON.parse(positional.slice(1).join(" ")) : {}; }
    catch (e) { console.error("JSON 参数解析失败: " + e.message); process.exit(2); }
    await run(opts, (c) => c.callTool(tool, argsObj));
    break;
  }
  default:
    console.error("用法: vault tools | search | get | fill | call（详见文件头注释）");
    process.exit(2);
}
