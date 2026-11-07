/**
 * 通信协议 — 通用 HTTP(S) JSON 请求客户端
 *
 * 禅道约定：
 * - 认证走 Header `Token: {token}`（由 POST /tokens 获取）
 * - 请求/响应均为 JSON，UTF-8 编码
 * - 内网自签证书场景：关闭 TLS 校验（rejectUnauthorized: false）
 */
import https from 'https';
import http from 'http';

/**
 * 发送 HTTP 请求并解析 JSON 响应
 * @param {string} url 完整 URL
 * @param {'GET'|'POST'|'PUT'} [method]
 * @param {string|null} [token] 禅道 Token（放 Header）
 * @param {Object|null} [body] JSON 请求体
 * @returns {Promise<Object>} 解析后的响应对象
 */
export function api(url, method = 'GET', token = null, body = null) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const mod = urlObj.protocol === 'https:' ? https : http;
        const headers = {};
        if (token) headers['Token'] = token;
        if (body) headers['Content-Type'] = 'application/json; charset=utf-8';
        const opts = {
            hostname: urlObj.hostname,
            port: urlObj.port,
            path: urlObj.pathname + urlObj.search,
            method,
            headers,
            rejectUnauthorized: false
        };
        const req = mod.request(opts, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(new Error(data.substring(0, 500))); }
            });
        });
        req.on('error', reject);
        if (body) req.write(Buffer.from(JSON.stringify(body), 'utf-8'));
        req.end();
    });
}
