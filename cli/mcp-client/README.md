# mcp-client

统一 MCP 机制层：`initialize` 握手、`tools/list`、`tools/call`，以及 JSON-RPC id 匹配、超时、错误归一。**只做机制，不含任何业务工具语义或凭据读取。**

## 传输

| transport | 适用 | 关键参数 |
|---|---|---|
| `stdio` | 本地 MCP 二进制（vault.exe、dbx-mcp.exe、npx 启动的 server） | `command`、`args`、`env` |
| `http` | Streamable HTTP 远程 MCP（腾讯文档等） | `url`、`headers`；自动处理 `Mcp-Session-Id`、`MCP-Protocol-Version`、JSON/SSE 响应 |

旧版 HTTP+SSE（先 GET 建流）暂未实现；遇到只支持旧协议的服务时再加 `sse` 适配器，上层 API 不变。

## API

```js
import { connect, withClient, McpClient, toolResult } from "mcp-client";

// 手动生命周期
const client = await connect({
  transport: "stdio",
  command: "D:/vault/vault.exe",
  args: ["--mcp"],
  timeoutMs: 120000,
});
const tools = await client.listTools();
const result = await client.callTool("search_entries", { items: [{ query: "pms" }] });
McpClient.resultText(result);   // content text 拼接
await client.close();

// 一步式：连接 → 回调 → 回收
const result = await withClient(
  { transport: "http", url, headers: { Authorization: token } },
  (c) => c.callTool("some_tool", {})
);

// 结构化结果：isError 抛错，text 按 JSON 解析
const data = toolResult(result);
```

## 自带命令：mcp

包内提供通用的 HTTP MCP 调试入口，适合临时查看工具或调用任意远程 MCP；业务服务仍用各自的域 CLI。

```powershell
mcp tools --endpoint https://example.com/mcp --token-file "$env:TEMP\mcp-token.tmp"
mcp call some_tool --endpoint https://example.com/mcp --config ~/.auth-center/apps/xxx/config.json @args.json
```

- 端点必填：`--endpoint URL` 或 `MCP_ENDPOINT`
- token：`--token-file` → `--config`（auth-center 风格，读 `token`）→ 不带 Authorization
- `--pretty` 格式化输出；`--timeout=毫秒` 调整单请求超时

## 传输适配器契约

新增传输时只实现四个方法：

```js
{
  onMessage(handler),   // 收到 JSON-RPC 报文时回调
  onClose(handler),     // 连接断开/进程退出时回调
  start(),              // spawn 进程或建立会话
  send(message),        // 把报文送出去
  close(),              // 回收进程/会话
}
```

id 匹配、超时、初始化状态由 `src/core.js` 统一处理，适配器不得自行解析业务结果。

## 域 CLI 如何复用

领域 CLI 通过 `file:../mcp-client` 依赖本包，只写子命令与业务参数：

- `cli/vault-cli` / `cli/dbx-cli`：stdio
- `cli/tencent-docs-cli`：http
- 任意远程 HTTP MCP 的临时调用：本包自带的 `mcp` 命令

新增一个本地 MCP 服务：新建 `cli/<name>-cli/` + bin 入口，`file:` 依赖本包，**不要复制进程管理、握手或 JSON-RPC 代码**。