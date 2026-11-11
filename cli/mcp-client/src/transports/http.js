/**
 * Streamable HTTP 传输：POST JSON-RPC，兼容 JSON 与 SSE 两种响应体。
 *
 * - 初始化时服务端可能下发 Mcp-Session-Id，后续请求自动回带
 * - 初始化后自动带上协商的 MCP-Protocol-Version
 * - Accept 同时声明 application/json 与 text/event-stream
 * - 通知（无 id）允许服务端返回 202
 *
 * 旧版 HTTP+SSE（先 GET 建流）暂未实现；若遇到只支持旧协议的服务，
 * 再增加 sse 适配器，不影响上层 McpClient。
 */
export class HttpTransport {
  constructor(url, opts = {}) {
    if (!url) throw new Error("http 传输缺少 url");
    this.url = url;
    this.headers = { ...(opts.headers || {}) };
    this.sessionId = null;
    this.protocolVersion = null;
    this.messageHandler = () => {};
    this.closeHandler = () => {};
  }

  onMessage(handler) {
    this.messageHandler = handler;
  }

  onClose(handler) {
    this.closeHandler = handler;
  }

  setProtocolVersion(version) {
    this.protocolVersion = version;
  }

  async start() {
    return this;
  }

  #headers() {
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...this.headers,
    };
    if (this.sessionId) headers["Mcp-Session-Id"] = this.sessionId;
    if (this.protocolVersion) headers["MCP-Protocol-Version"] = this.protocolVersion;
    return headers;
  }

  async send(message) {
    let response;
    try {
      response = await fetch(this.url, {
        method: "POST",
        headers: this.#headers(),
        body: JSON.stringify(message),
      });
    } catch (error) {
      throw new Error(`MCP HTTP 请求失败: ${error.message}`);
    }

    const sessionId = response.headers.get("mcp-session-id");
    if (sessionId) this.sessionId = sessionId;

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      const error = {
        code: response.status,
        message: `HTTP ${response.status}: ${text.slice(0, 300)}`,
      };
      // 服务端可能不回 JSON-RPC 错误体，这里按请求 id 合成响应，避免上层超时
      if (message.id != null) {
        this.messageHandler({ jsonrpc: "2.0", id: message.id, error });
      } else {
        throw new Error(error.message);
      }
      return;
    }

    // 通知被接受
    if (response.status === 202) return;

    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    if (contentType.includes("text/event-stream")) {
      await this.#readEventStream(response);
      return;
    }

    const text = await response.text();
    if (!text.trim()) return;
    try {
      const payload = JSON.parse(text);
      if (Array.isArray(payload)) {
        for (const item of payload) this.messageHandler(item);
      } else {
        this.messageHandler(payload);
      }
    } catch {
      throw new Error(`MCP HTTP 响应不是合法 JSON: ${text.slice(0, 300)}`);
    }
  }

  async #readEventStream(response) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let dataLines = [];

    const flush = () => {
      if (!dataLines.length) return;
      const data = dataLines.join("\n");
      dataLines = [];
      try {
        const payload = JSON.parse(data);
        if (Array.isArray(payload)) {
          for (const item of payload) this.messageHandler(item);
        } else {
          this.messageHandler(payload);
        }
      } catch {
        // 忽略无法解析的事件
      }
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf("\n")) >= 0) {
        let line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line === "") {
          flush();
          continue;
        }
        if (line.startsWith(":")) continue;
        const colon = line.indexOf(":");
        const field = colon === -1 ? line : line.slice(0, colon);
        let val = colon === -1 ? "" : line.slice(colon + 1);
        if (val.startsWith(" ")) val = val.slice(1);
        if (field === "data") dataLines.push(val);
      }
    }
    flush();
  }

  async close() {
    // 规范允许客户端 DELETE 结束会话；失败不影响退出
    if (!this.sessionId) return;
    try {
      await fetch(this.url, { method: "DELETE", headers: this.#headers() });
    } catch {
      // 忽略
    }
  }
}