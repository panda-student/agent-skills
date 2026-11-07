#!/usr/bin/env node
/**
 * 查询指定禅道任务详情（自包含，可多个）
 * 配置查找顺序: 环境变量 ZENTAO_CONFIG → 向上逐级找 .config/zentao.json
 * 用法: node zentao_task_detail.js 23023 22915 ...
 * 输出: JSON（编号/名称/状态/所属执行/需求标题/描述摘要等）
 */
const https = require('https');
const fs = require('fs');
const path = require('path');
const lib = require('./lib/config.cjs');

const cfg = lib.loadConfig('zentao.json', 'ZENTAO_CONFIG').zentao;
lib.requireSecret(cfg.password, '禅道密码');
const BASE = cfg.baseUrl.replace(/\/+$/, '');

function api(url, method = 'GET', token = null, body = null) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const headers = {};
        if (token) headers['Token'] = token;
        if (body) headers['Content-Type'] = 'application/json; charset=utf-8';
        const req = https.request({
            hostname: u.hostname, port: u.port || 443,
            path: u.pathname + u.search, method, headers,
            rejectUnauthorized: false
        }, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { reject(new Error('HTTP ' + res.statusCode + ' :: ' + data.substring(0, 300))); }
            });
        });
        req.on('error', reject);
        if (body) req.write(Buffer.from(JSON.stringify(body), 'utf-8'));
        req.end();
    });
}

(async () => {
    const tok = await api(`${BASE}/tokens`, 'POST', null, { account: cfg.username, password: cfg.password });
    if (!tok.token) { console.error('LOGIN_FAILED'); process.exit(1); }
    const token = tok.token;

    const ids = process.argv.slice(2);
    if (!ids.length) { console.error('usage: node zentao_task_detail.js <id> [id...]'); process.exit(1); }
    const out = [];
    for (const id of ids) {
        try {
            const t = await api(`${BASE}/tasks/${id}`, 'GET', token);
            out.push({
                id: t.id, name: t.name, status: t.status, pri: t.pri, type: t.type,
                execution: t.execution, executionName: t.executionName,
                story: t.story, storyTitle: t.storyTitle,
                deadline: t.deadline, estStarted: t.estStarted,
                assignedTo: t.assignedTo && t.assignedTo.account ? t.assignedTo.account : t.assignedTo,
                openedBy: t.openedBy && t.openedBy.account ? t.openedBy.account : t.openedBy,
                desc: (t.desc || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').substring(0, 400)
            });
        } catch (e) {
            out.push({ id, error: e.message });
        }
    }
    console.log(JSON.stringify(out, null, 2));
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
