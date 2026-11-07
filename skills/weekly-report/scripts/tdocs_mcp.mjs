#!/usr/bin/env node
/** 腾讯文档 MCP CLI: node tdocs_mcp.mjs <tool> [args.json文件或'{"..."}'字符串]  输出 result JSON */
import fs from 'fs';
import lib from './lib/config.cjs';
const [, , tool, argsArg] = process.argv;
const token = lib.requireSecret(lib.loadConfig('tdocs_mcp.json', 'TDOCS_CONFIG').token, '腾讯文档 token');
let args = {};
if (argsArg) {
    const s = argsArg.trim();
    args = s.startsWith('{') || s.startsWith('[') ? JSON.parse(s) : JSON.parse(fs.readFileSync(s, 'utf8'));
}
const call = (id, method, params = {}) =>
    fetch('https://docs.qq.com/openapi/mcp', {
        method: 'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
    }).then(r => r.json());

(async () => {
    await call(1, 'initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'weekreport', version: '1.0' } });
    const r = await call(2, 'tools/call', { name: tool, arguments: args });
    if (r.error) { console.error('MCP-ERROR:', JSON.stringify(r.error)); process.exit(1); }
    const c = r.result?.content?.[0];
    const text = c?.text ?? JSON.stringify(r.result);
    try { console.log(JSON.stringify(JSON.parse(text), null, 1)); }  // 二次解析 text 内嵌 JSON
    catch { console.log(text); }
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
