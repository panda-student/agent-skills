/**
 * 统一 MCP 机制层入口：按 transport 选择适配器，暴露同一套客户端 API。
 *
 * 用法：
 *   import { connect, withClient } from "mcp-client";
 *
 *   const client = await connect({ transport: "stdio", command, args });
 *   const client = await connect({ transport: "http", url, headers });
 *   const tools = await client.listTools();
 *   const result = await client.callTool("tool_name", { ... });
 *   await client.close();
 *
 *   // 一步式（自动握手与回收）
 *   const result = await withClient({ transport: "stdio", command, args }, (c) =>
 *     c.callTool("tool_name", { ... })
 *   );
 */
import { McpClient, toolResult } from "./src/core.js";
import { StdioTransport } from "./src/transports/stdio.js";
import { HttpTransport } from "./src/transports/http.js";

export { McpClient, toolResult };
export { StdioTransport, HttpTransport };

/** 根据配置创建传输适配器 */
export function createTransport(config = {}) {
  const transport = config.transport || (config.command ? "stdio" : config.url ? "http" : "");
  if (transport === "stdio") {
    return new StdioTransport(config.command, config.args, config);
  }
  if (transport === "http") {
    return new HttpTransport(config.url, config);
  }
  throw new Error("缺少传输配置：需要 transport=stdio+command，或 transport=http+url");
}

/**
 * 建立连接并完成 initialize 握手。
 * @param {object} config  { transport, command, args, url, headers, timeoutMs, clientInfo }
 * @returns {Promise<McpClient>}
 */
export async function connect(config = {}) {
  const transport = createTransport(config);
  const client = new McpClient(transport, config);
  await client.start();
  try {
    await client.init(config.clientInfo);
  } catch (error) {
    await client.close().catch(() => {});
    throw error;
  }
  return client;
}

/** 一步式：连接 → 执行回调 → 关闭（异常也会回收） */
export async function withClient(config, fn) {
  const client = await connect(config);
  try {
    return await fn(client);
  } finally {
    await client.close();
  }
}