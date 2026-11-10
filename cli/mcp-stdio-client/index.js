/**
 * 最小 MCP stdio 客户端：spawn MCP server 二进制 → initialize 握手 → tools/list → tools/call。
 * 供 vault / dbx 两个 bin 复用（MCP 二进制本身只讲 JSON-RPC，无命令行模式）。
 */
import { spawn } from "node:child_process";

export class McpStdioClient {
  /**
   * @param {string} command  可执行文件路径
   * @param {string[]} args   启动参数
   * @param {object} [opts]   { timeoutMs = 120000 }
   */
  constructor(command, args = [], opts = {}) {
    this.command = command;
    this.args = args;
    this.timeoutMs = opts.timeoutMs ?? 120000;
    this.proc = null;
    this.nextId = 1;
    this.pending = new Map(); // id -> {resolve, reject}
    this.buffer = "";
    this.serverInfo = null;
  }

  start() {
    this.proc = spawn(this.command, this.args, {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
      env: process.env,
    });
    this.proc.stdout.setEncoding("utf8");
    this.proc.stdout.on("data", (chunk) => this.#onData(chunk));
    this.proc.stderr.setEncoding("utf8");
    this.proc.stderr.on("data", (chunk) => {
      // MCP server 的日志走 stderr，仅在天异常退出时才有诊断价值，平时静默
      this.lastStderr = (this.lastStderr || "") + chunk;
    });
    this.proc.on("exit", (code) => {
      for (const { reject } of this.pending.values()) {
        reject(new Error(`MCP server 已退出(code=${code})${this.lastStderr ? "：" + this.lastStderr.trim().slice(0, 500) : ""}`));
      }
      this.pending.clear();
    });
    return this;
  }

  #onData(chunk) {
    this.buffer += chunk;
    let idx;
    // MCP stdio 传输为按行分隔的 JSON-RPC 报文
    while ((idx = this.buffer.indexOf("\n")) >= 0) {
      const line = this.buffer.slice(0, idx).trim();
      this.buffer = this.buffer.slice(idx + 1);
      if (!line) continue;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        continue; // 忽略非 JSON 噪声行
      }
      if (msg.id != null && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) {
          reject(new Error(`MCP error ${msg.error.code}: ${msg.error.message}`));
        } else {
          resolve(msg.result);
        }
      }
    }
  }

  request(method, params) {
    const id = this.nextId++;
    const payload = { jsonrpc: "2.0", id, method, params };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`MCP 请求超时(${this.timeoutMs}ms): ${method}`));
      }, this.timeoutMs);
      const wrap = (fn) => (v) => {
        clearTimeout(timer);
        fn(v);
      };
      this.pending.set(id, { resolve: wrap(resolve), reject: wrap(reject) });
      this.proc.stdin.write(JSON.stringify(payload) + "\n");
    });
  }

  notify(method, params) {
    this.proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
  }

  async init(clientName = "mcp-shim-cli") {
    const result = await this.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: clientName, version: "1.0.0" },
    });
    this.serverInfo = result && result.serverInfo;
    this.notify("notifications/initialized", {});
    return result;
  }

  async listTools() {
    const result = await this.request("tools/list", {});
    return (result && result.tools) || [];
  }

  async callTool(name, argsObj = {}) {
    const result = await this.request("tools/call", { name, arguments: argsObj });
    return result;
  }

  /** 提取 tools/call 结果为可打印文本（优先 text content；无 text 才附结构化内容原样 JSON） */
  static resultText(result) {
    if (!result) return "";
    const parts = [];
    if (Array.isArray(result.content)) {
      for (const c of result.content) {
        if (c.type === "text") parts.push(c.text);
        else parts.push(JSON.stringify(c));
      }
    }
    if (!parts.length && result.structuredContent !== undefined) {
      parts.push(JSON.stringify(result.structuredContent, null, 2));
    }
    return parts.join("\n");
  }

  stop() {
    if (this.proc && this.proc.exitCode === null) {
      try {
        this.proc.stdin.end();
        this.proc.kill();
      } catch { /* 已退出则忽略 */ }
    }
  }
}

/** 一步式：启动 → 握手 → 执行回调 → 退出。回调抛错/超时保证进程回收。 */
export async function withClient(command, args, opts, fn) {
  const client = new McpStdioClient(command, args, opts).start();
  try {
    await client.init();
    return await fn(client);
  } finally {
    client.stop();
  }
}
