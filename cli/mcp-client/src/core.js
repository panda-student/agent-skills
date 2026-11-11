/**
 * MCP 机制层核心：JSON-RPC 请求/响应匹配、超时、初始化握手与结果提取。
 * 不关心传输方式（stdio / http），也不关心业务工具语义。
 */

export class McpClient {
  /**
   * @param {object} transport  传输适配器，需实现 start/send/onMessage/onClose/close
   * @param {object} [options]  { timeoutMs, clientInfo }
   */
  constructor(transport, options = {}) {
    this.transport = transport;
    this.timeoutMs = options.timeoutMs ?? 120000;
    this.clientInfo = options.clientInfo ?? { name: "mcp-client", version: "1.0.0" };
    this.nextId = 1;
    this.pending = new Map(); // id -> { resolve, reject, timer }
    this.initialized = false;
    this.serverInfo = null;
    this.closed = false;
  }

  async start() {
    this.transport.onMessage((message) => this.#onMessage(message));
    this.transport.onClose((error) => this.#rejectAll(error));
    await this.transport.start();
    return this;
  }

  #onMessage(message) {
    if (Array.isArray(message)) {
      for (const item of message) this.#onMessage(item);
      return;
    }
    if (message == null || message.id == null) return; // 服务端通知/日志，忽略
    const slot = this.pending.get(message.id);
    if (!slot) return;
    this.pending.delete(message.id);
    clearTimeout(slot.timer);
    if (message.error) {
      slot.reject(new Error(`MCP error ${message.error.code}: ${message.error.message}`));
    } else {
      slot.resolve(message.result);
    }
  }

  #rejectAll(error) {
    this.closed = true;
    for (const slot of this.pending.values()) {
      clearTimeout(slot.timer);
      slot.reject(error instanceof Error ? error : new Error(String(error)));
    }
    this.pending.clear();
  }

  request(method, params = {}) {
    if (this.closed) return Promise.reject(new Error("MCP 连接已关闭"));
    const id = this.nextId++;
    const payload = { jsonrpc: "2.0", id, method, params };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`MCP 请求超时(${this.timeoutMs}ms): ${method}`));
      }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      Promise.resolve(this.transport.send(payload)).catch((error) => {
        const slot = this.pending.get(id);
        if (!slot) return;
        this.pending.delete(id);
        clearTimeout(slot.timer);
        slot.reject(error);
      });
    });
  }

  notify(method, params = {}) {
    if (this.closed) return;
    Promise.resolve(this.transport.send({ jsonrpc: "2.0", method, params })).catch(() => {
      // 通知失败不阻塞主流程，由后续请求暴露连接问题
    });
  }

  async init(clientInfo = this.clientInfo) {
    if (this.initialized) return this.serverInfo;
    const result = await this.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo,
    });
    this.serverInfo = result && result.serverInfo;
    this.initialized = true;
    // HTTP 传输在初始化后需要带上协商的协议版本
    if (result && result.protocolVersion && this.transport.setProtocolVersion) {
      this.transport.setProtocolVersion(result.protocolVersion);
    }
    this.notify("notifications/initialized", {});
    return result;
  }

  async listTools() {
    const result = await this.request("tools/list", {});
    return (result && result.tools) || [];
  }

  async callTool(name, argsObj = {}) {
    return this.request("tools/call", { name, arguments: argsObj });
  }

  /** 提取 tools/call 结果为可打印文本（优先 text content；无 text 才附结构化内容） */
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

  async close() {
    this.#rejectAll(new Error("MCP 连接已关闭"));
    await this.transport.close();
  }
}

/**
 * 把 tools/call 结果转成业务对象：isError 抛错，text 尝试按 JSON 解析。
 * 适合需要结构化输出的域 CLI（腾讯文档等）。
 */
export function toolResult(result) {
  const text = McpClient.resultText(result);
  if (result && result.isError) {
    throw new Error(text || "MCP 工具执行失败");
  }
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}