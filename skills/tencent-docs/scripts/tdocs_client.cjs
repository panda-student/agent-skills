/**
 * 腾讯文档 HTTP MCP 公共客户端（腾讯文档操作能力的公共实现）
 *
 * 业务技能通过本模块调用腾讯文档，不再各自复制 JSON-RPC/initialize/tools-call 逻辑。
 *
 * 用法：
 *   const { createTdocsClient } = require('<ops>/scripts/tdocs_client.cjs');
 *   const client = createTdocsClient(token);
 *   const data = await client.tool('smartsheet.list_records', { file_id, sheet_id });
 *
 * token 由调用方加载（vault/配置），本模块不读取凭据文件、不打印 token。
 */
const ENDPOINT = 'https://docs.qq.com/openapi/mcp';
const PROTOCOL_VERSION = '2024-11-05';

function createTdocsClient(token, options = {}) {
    if (!token) {
        throw new Error('missing Tencent Docs token');
    }
    const endpoint = options.endpoint || ENDPOINT;
    const clientName = options.clientName || 'tencent-docs-client';
    let nextId = 1;
    let initialized = false;

    async function call(method, params = {}) {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                Authorization: token,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: nextId++,
                method,
                params,
            }),
        });
        if (!response.ok) {
            const text = await response.text().catch(() => '');
            throw new Error(`MCP ${method} HTTP ${response.status}: ${text.substring(0, 300)}`);
        }
        const payload = await response.json();
        if (payload.error) {
            throw new Error(`MCP ${method} failed: ${JSON.stringify(payload.error)}`);
        }
        return payload;
    }

    async function initialize() {
        if (initialized) {
            return;
        }
        await call('initialize', {
            protocolVersion: PROTOCOL_VERSION,
            capabilities: {},
            clientInfo: { name: clientName, version: '1.0' },
        });
        initialized = true;
    }

    async function tool(name, args = {}) {
        await initialize();
        const payload = await call('tools/call', { name, arguments: args });
        if (!payload.result) {
            throw new Error(`MCP ${name} 返回缺少 result`);
        }
        const content = payload.result.content && payload.result.content[0];
        const text = content && content.text !== undefined ? content.text : JSON.stringify(payload.result);
        if (payload.result.isError) {
            throw new Error(`MCP ${name} 执行失败: ${text}`);
        }
        try {
            return JSON.parse(text);
        } catch (error) {
            return { raw: text };
        }
    }

    return { call, initialize, tool, endpoint };
}

module.exports = { createTdocsClient, ENDPOINT, PROTOCOL_VERSION };