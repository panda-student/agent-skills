#!/usr/bin/env node
/**
 * 临时脚本：执行禅道工时补录 + 过期任务 deadline 调整（跑完删除）
 * 输入: drafts/zentao-worktime-2026W39.txt
 * 流程: PATCH deadline ×6 → POST /tasks/{id}/estimate 批量记工时 → GET 校验
 */
const https = require('https');
const fs = require('fs');
const path = require('path');
const lib = require('./lib/config.cjs');
const ROOT = lib.findProjectRoot() || process.cwd(); // 项目根

const cfg = lib.loadConfig('zentao.json', 'ZENTAO_CONFIG').zentao;
lib.requireSecret(cfg.password, '禅道密码');
const BASE = cfg.baseUrl.replace(/\/+$/, '');
const sleep = ms => new Promise(r => setTimeout(r, ms));

function api(url, method = 'GET', token = null, body = null) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const h = {};
        if (token) h['Token'] = token;
        if (body) h['Content-Type'] = 'application/json';
        const r = https.request({ hostname: u.hostname, path: u.pathname + u.search, method, headers: h, rejectUnauthorized: false }, x => {
            let d = '';
            x.on('data', c => d += c);
            x.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(new Error('HTTP' + x.statusCode + ':' + d.substring(0, 200))); } });
        });
        r.on('error', reject);
        if (body) r.write(JSON.stringify(body));
        r.end();
    });
}
async function getToken() {
    for (let i = 0; i < 5; i++) {
        const t = await api(`${BASE}/tokens`, 'POST', null, { account: cfg.username, password: cfg.password });
        if (t.token) return t.token;
        await sleep(2000);
    }
    throw new Error('token failed');
}
async function call(fn, label) {
    for (let i = 0; i < 3; i++) {
        const r = await fn();
        if (!r.error) return r;
        console.log(`  retry ${label}:`, JSON.stringify(r).substring(0, 120));
        await sleep(2000);
    }
    throw new Error('failed: ' + label);
}

// 解析草稿（参数指定文件，缺省取项目 drafts/zentao-worktime-<本周>.txt）
function isoWeek(d) {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((t - yearStart) / 86400000) + 1) / 7);
    return `${t.getUTCFullYear()}W${String(week).padStart(2, '0')}`;
}
const draftFile = process.argv[2] || path.join(ROOT, 'drafts', `zentao-worktime-${isoWeek(new Date())}.txt`);
const text = fs.readFileSync(draftFile, 'utf8');
const records = []; // {id, date, h}
const sec1 = text.split('【二、')[0];
for (const line of sec1.split('\n')) {
    const m = line.match(/^(\d{5})\t(\d{4}-\d{2}-\d{2})\t(\d+(?:\.\d+)?)$/);
    if (m) records.push({ id: m[1], date: m[2], h: parseFloat(m[3]) });
}
const deadlines = [];
const sec4 = text.split('【四、')[1] || '';
for (const line of sec4.split('\n')) {
    const m = line.match(/^(\d{5})\t(\d{4}-\d{2}-\d{2})/);
    if (m) deadlines.push({ id: m[1], date: m[2] });
}

(async () => {
    const tok = await getToken();
    console.log('records:', records.length, 'deadlines:', deadlines.length);

    // 1. deadline 调整
    for (const d of deadlines) {
        const r = await call(() => api(`${BASE}/tasks/${d.id}`, 'PUT', tok, { deadline: d.date }), `deadline ${d.id}`);
        console.log(`deadline ${d.id} -> ${d.date}: OK (${(r.deadline || '?')})`);
        await sleep(400);
    }

    // 2. 按任务分组记工时（left 递减）
    const byTask = {};
    for (const r of records) (byTask[r.id] = byTask[r.id] || []).push(r);
    for (const id of Object.keys(byTask).sort()) {
        const rs = byTask[id].sort((a, b) => a.date < b.date ? -1 : 1);
        const task = await call(() => api(`${BASE}/tasks/${id}`, 'GET', tok), `get ${id}`);
        let left = task.left;
        const lefts = rs.map(r => { left -= r.h; return Math.max(0, left); });
        const body = {
            id: rs.map((_, i) => i),
            objectID: rs.map(() => Number(id)),
            dates: rs.map(r => r.date),
            work: rs.map(r => '功能开发'),
            consumed: rs.map(r => r.h),
            left: lefts,
            objectType: rs.map(() => 'task')
        };
        const r = await call(() => api(`${BASE}/tasks/${id}/estimate`, 'POST', tok, body), `estimate ${id}`);
        console.log(`estimate ${id}: ${rs.length}条 ${rs.reduce((s, x) => s + x.h, 0)}h -> status:${r.status} consumed:${r.consumed} left:${r.left}`);
        await sleep(500);
    }

    // 3. 校验
    console.log('--- verify ---');
    for (const id of Object.keys(byTask).sort()) {
        const t = await call(() => api(`${BASE}/tasks/${id}`, 'GET', tok), `verify ${id}`);
        console.log(`${id}: status=${t.status} cons=${t.consumed} left=${t.left}`);
        await sleep(300);
    }
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });

