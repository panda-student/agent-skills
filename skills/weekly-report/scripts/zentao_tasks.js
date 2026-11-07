#!/usr/bin/env node
/**
 * 拉取禅道"我的任务"列表（自包含，无外部依赖）
 * 配置查找顺序: 环境变量 ZENTAO_CONFIG → 向上逐级找 .config/zentao.json
 * 用法: node zentao_tasks.js [executionId]
 *   无参数: 先 GET /executions/<id>/tasks 过滤 assignedTo（准确），失败回退 GET /tasks
 * 输出: zentao_tasks.json（编号/名称/状态/所属执行/类型/截止日期）
 */
const https = require('https');
const fs = require('fs');
const path = require('path');
const lib = require('./lib/config.cjs');

const cfg = lib.loadConfig('zentao.json', 'ZENTAO_CONFIG').zentao;
lib.requireSecret(cfg.password, '禅道密码');
const BASE = cfg.baseUrl.replace(/\/+$/, '');
const ME = cfg.username;

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

function brief(t) {
    return {
        id: t.id, name: t.name, status: t.status, pri: t.pri, type: t.type,
        execution: t.execution, executionName: t.executionName || undefined,
        project: t.project, story: t.story, storyTitle: t.storyTitle || undefined,
        deadline: t.deadline, assignedTo: t.assignedTo,
        realStarted: t.realStarted, estStarted: t.estStarted
    };
}

(async () => {
    const tok = await api(`${BASE}/tokens`, 'POST', null, { account: cfg.username, password: cfg.password });
    if (!tok.token) { console.error('LOGIN_FAILED', JSON.stringify(tok).substring(0, 300)); process.exit(1); }
    const token = tok.token;

    let mine = [];
    let mode = 'executions';
    // 优先：按执行拉取（/tasks 接口有重复与缺失）
    const execIds = process.argv[2] ? [process.argv[2]] : (cfg.executionIds || [1231]);
    try {
        for (const eid of execIds) {
            let all = [], page = 1;
            while (true) {
                const r = await api(`${BASE}/executions/${eid}/tasks?limit=100&page=${page}`, 'GET', token);
                const list = Array.isArray(r) ? r : (r.tasks || []);
                all = all.concat(list);
                const limit = (!Array.isArray(r) && r.limit) || 100;
                if (list.length < limit || page > 50) break;
                page++;
            }
            mine = mine.concat(all.filter(t => t.assignedTo && (t.assignedTo.account === ME || t.assignedTo === ME)));
        }
        // 去重
        const seen = new Set();
        mine = mine.filter(t => !seen.has(t.id) && seen.add(t.id));
        if (!mine.length) throw new Error('empty from executions');
    } catch (e) {
        mode = 'fallback-/tasks';
        let all = [], page = 1;
        while (true) {
            const r = await api(`${BASE}/tasks?limit=100&page=${page}`, 'GET', token);
            const list = Array.isArray(r) ? r : (r.tasks || []);
            all = all.concat(list);
            const limit = (!Array.isArray(r) && r.limit) || 100;
            if (list.length < limit || page > 50) break;
            page++;
        }
        mine = all.filter(t => t.assignedTo && (t.assignedTo.account === ME || t.assignedTo === ME));
    }

    const out = path.join(process.cwd(), 'zentao_tasks.json');
    fs.writeFileSync(out, JSON.stringify(mine.map(brief), null, 2), 'utf8');
    console.log(JSON.stringify({ status: 'ok', mode, total: mine.length, file: out }));
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
