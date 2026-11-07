/**
 * 业务逻辑 — 任务查询/归一化 与 工时记录/完成/关闭 的 API 封装
 */
import { api } from '../protocol/http-client.mjs';
import * as endpoints from '../protocol/endpoints.mjs';
import { getBaseUrl } from '../config.mjs';
import { round2 } from '../utils/number.mjs';

/** assignedTo/efforts 兼容对象与字符串两种结构，取账号 */
function acc(v) {
    return (v && typeof v === 'object') ? (v.account || '') : (v || '');
}

/**
 * 归一化任务对象（各命令统一的任务数据形态）
 * @param {Object} t 禅道原始任务
 * @param {string} account 当前登录账号
 * @returns {import('../types.mjs').NormalizedTask}
 */
export function normalizeTask(t, account) {
    let efforts = t.efforts || [];
    if (!Array.isArray(efforts)) efforts = Object.values(efforts);
    return {
        id: t.id,
        name: t.name,
        status: t.status,
        execution: (t.execution && typeof t.execution === 'object') ? t.execution.id : t.execution,
        story: t.story || 0,
        estimate: Number(t.estimate) || 0,
        consumed: Number(t.consumed) || 0,
        left: Number(t.left) || 0,
        assignedTo: acc(t.assignedTo),
        assignedToName: (t.assignedTo && typeof t.assignedTo === 'object') ? (t.assignedTo.realname || '') : '',
        isMine: acc(t.assignedTo) === account,
        deadline: t.deadline || '',
        efforts: efforts.map(e => ({
            id: e.id,
            date: e.date,
            consumed: Number(e.consumed) || 0,
            left: Number(e.left) || 0,
            work: e.work || '',
            account: acc(e.account)
        }))
    };
}

/**
 * 任务详情；withEfforts 时另调官方端点补工时明细
 * （开源版 GET /tasks/{id} 不含 efforts，需 GET /tasks/{id}/estimate）
 * @returns {Promise<import('../types.mjs').NormalizedTask|null>}
 */
export async function getTaskDetail(token, taskId, withEfforts = false, account) {
    const baseUrl = getBaseUrl();
    const r = await api(endpoints.taskDetail(baseUrl, taskId), 'GET', token);
    const t = (r && r.task) ? r.task : r;
    if (!t || !t.id) return null;
    const task = normalizeTask(t, account);
    if (withEfforts) {
        try {
            const er = await api(endpoints.taskEstimate(baseUrl, taskId), 'GET', token);
            const arr = er && er.effort ? (Array.isArray(er.effort) ? er.effort : Object.values(er.effort)) : [];
            if (arr.length) {
                task.efforts = arr.map(e => ({
                    id: e.id,
                    date: e.date,
                    consumed: Number(e.consumed) || 0,
                    left: Number(e.left) || 0,
                    work: e.work || '',
                    account: acc(e.account)
                }));
            }
        } catch (e) { /* 明细获取失败不阻塞，efforts 保持空 */ }
    }
    return task;
}

/**
 * 按日期汇总指定账号已填工时（跨任务），用于"每天≤8h"校验
 * @param {import('../types.mjs').NormalizedTask[]} tasks
 * @param {string} account
 * @returns {import('../types.mjs').DailyTotals}
 */
export function computeDailyTotals(tasks, account) {
    const totals = {};
    for (const t of tasks) {
        for (const e of t.efforts || []) {
            if (account && e.account && e.account !== account) continue;
            totals[e.date] = round2((totals[e.date] || 0) + e.consumed);
        }
    }
    return totals;
}

/** 调整任务截止时间（PUT /tasks/{id}），避免超期完成/关闭 */
export async function adjustDeadline(token, taskId, fromDeadline, targetDeadline) {
    const res = await api(endpoints.taskDetail(getBaseUrl(), taskId), 'PUT', token, { deadline: targetDeadline });
    if (!res || res.error) throw new Error('调整截止时间失败: ' + JSON.stringify(res || {}).substring(0, 200));
    return { from: fromDeadline, to: targetDeadline };
}

/**
 * 记录工时 — 开源版官方端点 POST /tasks/{id}/estimate
 * 字段为批量行式数组（dates[]/consumed[]/left[]/work[]）；异常时自动回退单值/旧路径
 */
export async function recordEffortRaw(token, taskId, body) {
    const baseUrl = getBaseUrl();
    const attempts = [
        { url: endpoints.taskEstimate(baseUrl, taskId), body: { dates: [body.date], consumed: [body.consumed], left: [body.left], work: [body.work] } },
        { url: endpoints.taskEstimate(baseUrl, taskId), body: Object.assign({}, body, { dates: body.date }) },
        { url: endpoints.taskRecordEstimateAlt(baseUrl, taskId), body: Object.assign({}, body, { dates: body.date }) },
        { url: endpoints.taskEffort(baseUrl, taskId), body }
    ];
    let lastErr = null;
    for (const a of attempts) {
        try {
            const res = await api(a.url, 'POST', token, a.body);
            if (res && !res.error) return { ok: true, endpoint: a.url };
            lastErr = new Error(JSON.stringify(res).substring(0, 300));
        } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error('记录工时失败');
}

/** 完成任务（POST /tasks/{id}/finish，多请求体形态回退） */
export async function finishTaskRaw(token, taskId, body) {
    const url = endpoints.taskFinish(getBaseUrl(), taskId);
    const attempts = [body, { consumed: body.consumed, left: 0 }, {}];
    let lastErr = null;
    for (const b of attempts) {
        try {
            const res = await api(url, 'POST', token, b);
            if (res && !res.error) return { ok: true };
            lastErr = new Error(JSON.stringify(res).substring(0, 300));
        } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error('完成任务失败');
}

/** 关闭任务（POST /tasks/{id}/close，多请求体形态回退） */
export async function closeTaskRaw(token, taskId, account) {
    const url = endpoints.taskClose(getBaseUrl(), taskId);
    const attempts = [{}, { assignedTo: account }, { comment: '', assignedTo: account }];
    let lastErr = null;
    for (const b of attempts) {
        try {
            const res = await api(url, 'POST', token, b);
            if (res && !res.error) return { ok: true };
            lastErr = new Error(JSON.stringify(res).substring(0, 300));
        } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error('关闭任务失败');
}
