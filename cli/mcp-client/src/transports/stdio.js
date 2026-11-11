/**
 * stdio 传输：spawn 本地 MCP 二进制，按行分隔 JSON-RPC 报文。
 * 负责进程生命周期与 stderr 诊断，不解析业务语义。
 */
import { spawn } from "node:child_process";

export class StdioTransport {
  constructor(command, args = [], opts = {}) {
    if (!command) throw new Error("stdio 传输缺少 command");
    this.command = command;
    this.args = args || [];
    this.proc = null;
    this.buffer = "";
    this.lastStderr = "";
    this.messageHandler = () => {};
    this.closeHandler = () => {};
    this.stopping = false;
    this.opts = opts;
  }

  onMessage(handler) {
    this.messageHandler = handler;
  }

  onClose(handler) {
    this.closeHandler = handler;
  }

  async start() {
    this.proc = spawn(this.command, this.args, {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
      env: this.opts.env || process.env,
    });

    this.proc.stdout.setEncoding("utf8");
    this.proc.stdout.on("data", (chunk) => this.#onData(chunk));

    this.proc.stderr.setEncoding("utf8");
    this.proc.stderr.on("data", (chunk) => {
      // MCP server 日志走 stderr，仅在异常退出时用于诊断
      this.lastStderr = (this.lastStderr + chunk).slice(-4000);
    });

    this.proc.on("error", (error) => {
      if (!this.stopping) this.closeHandler(new Error(`MCP server 启动失败: ${error.message}`));
    });

    this.proc.on("exit", (code) => {
      if (this.stopping) return;
      const detail = this.lastStderr ? `：${this.lastStderr.trim().slice(0, 500)}` : "";
      this.closeHandler(new Error(`MCP server 已退出(code=${code})${detail}`));
    });

    return this;
  }

  #onData(chunk) {
    this.buffer += chunk;
    let idx;
    while ((idx = this.buffer.indexOf("\n")) >= 0) {
      const line = this.buffer.slice(0, idx).trim();
      this.buffer = this.buffer.slice(idx + 1);
      if (!line) continue;
      try {
        this.messageHandler(JSON.parse(line));
      } catch {
        // 忽略非 JSON 噪声行
      }
    }
  }

  async send(message) {
    if (!this.proc || !this.proc.stdin.writable) {
      throw new Error("MCP server 未启动或 stdin 不可写");
    }
    this.proc.stdin.write(JSON.stringify(message) + "\n");
  }

  async close() {
    this.stopping = true;
    if (this.proc && this.proc.exitCode === null) {
      try {
        this.proc.stdin.end();
        this.proc.kill();
      } catch {
        // 已退出则忽略
      }
    }
  }
}