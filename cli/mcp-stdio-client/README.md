# mcp-stdio-client

最小 MCP stdio 客户端（单一机制包）：spawn MCP server 二进制 → initialize 握手 → `tools/list` → `tools/call`，按行分隔 JSON-RPC，按 id 匹配响应，超时与异常退出兜底。

本仓库内的域 CLI（[vault-cli](../vault-cli/)、[dbx-cli](../dbx-cli/)）通过 `file:../mcp-stdio-client` 依赖复用，各自只保留领域子命令逻辑——机制归本包，领域归各包。

## API

```js
import { withClient, McpStdioClient } from "mcp-stdio-client";

// 一步式：启动 → 握手 → 回调 → 进程回收
const result = await withClient(command, args, { timeoutMs }, (client) =>
  client.callTool("tool_name", { /* arguments */ })
);

// 或手动控制生命周期
const c = new McpStdioClient(command, args).start();
await c.init();
const tools = await c.listTools();
McpStdioClient.resultText(result);   // text content 拼接（无 text 才附 structuredContent）
c.stop();
```

新 MCP 二进制要封装成 CLI 时：新建域包 + bin 入口 + `file:` 依赖本包，参照 vault-cli/dbx-cli。
