/** 命令：查询域 — my-work / my-tasks / task / tasks（任务清单与详情） */
import * as taskService from '../services/task-service.mjs';
import { getAccount, getBaseUrl, getWebUrl } from '../config.mjs';
import { getToken } from '../auth.mjs';
import { api } from '../protocol/http-client.mjs';
import * as endpoints from '../protocol/endpoints.mjs';
import { ok, fail } from '../utils/output.mjs';

/**
 * zentao my-work [状态过滤] — "我的任务"清单（对应禅道 my-work-task 页面，无需执行ID）
 * 数据源：GET {webUrl}my-work-task.json + Token 头
 */
export async function cmdMyWork(statusFilter) {
    try {
        const token = await getToken();
        const account = getAccount();
        const r = await api(endpoints.myWork(getWebUrl()), 'GET', token);
        let data = r && r.data;
        if (typeof data === 'string') data = JSON.parse(data);
        if (!data || !data.tasks) throw new Error('my-work-task.json 返回结构异常: ' + JSON.stringify(r).substring(0, 200));
        let list = Array.isArray(data.tasks) ? data.tasks : Object.values(data.tasks);
        if (statusFilter) list = list.filter(t => t.status === statusFilter);
        const tasks = list.map(t => ({
            id: t.id,
            name: t.name,
            status: t.status,
            pri: t.pri,
            estimate: Number(t.estimate) || 0,
            consumed: Number(t.consumed) || 0,
            left: Number(t.left) || 0,
            deadline: t.deadline || '',
            execution: t.execution,
            executionName: t.executionName || '',
            story: t.story || 0,
            assignedTo: (t.assignedTo && typeof t.assignedTo === 'object') ? t.assignedTo.account : (t.assignedTo || ''),
            isMine: true
        }));
        ok({ status: 'ok', account, source: 'my-work-task.json', total: tasks.length, tasks });
    } catch (e) {
        fail(e.message);
    }
}

/** zentao task <任务ID> — 单任务详情（含工时明细 + 当日汇总） */
export async function cmdTask(taskId) {
    try {
        const token = await getToken();
        const account = getAccount();
        const t = await taskService.getTaskDetail(token, taskId, true, account);
        if (!t) fail(`任务 ${taskId} 不存在或无权限`);
        ok({
            status: 'ok',
            task: t,
            dailyTotals: taskService.computeDailyTotals([t], account),
            link: `${getWebUrl()}task-view-${t.id}.html`
        });
    } catch (e) {
        fail(e.message);
    }
}

/** zentao tasks <ID1,ID2,...> — 批量详情 + dailyTotals（当前账号按日期已填工时） */
export async function cmdTasks(idsCsv) {
    try {
        const token = await getToken();
        const account = getAccount();
        const ids = String(idsCsv).split(',').map(s => s.trim()).filter(Boolean);
        if (!ids.length) throw new Error('缺少任务ID列表，如: zentao tasks 1001,1002');
        const tasks = [];
        const failed = [];
        for (const id of ids) {
            try {
                const t = await taskService.getTaskDetail(token, id, true, account);
                if (t) tasks.push(t);
                else failed.push({ id: Number(id) || id, message: '不存在或无权限' });
            } catch (e) {
                failed.push({ id: Number(id) || id, message: e.message });
            }
        }
        ok({
            status: 'ok',
            account,
            dailyTotals: taskService.computeDailyTotals(tasks, account),
            tasks,
            failed
        });
    } catch (e) {
        fail(e.message);
    }
}

/** zentao my-tasks <执行ID> — 当前账号在该执行下的任务清单 */
export async function cmdMyTasks(executionId) {
    try {
        const token = await getToken();
        const account = getAccount();
        const r = await api(endpoints.executionTasks(getBaseUrl(), executionId), 'GET', token);
        const arr = r.tasks || (Array.isArray(r) ? r : []);
        const myTasks = arr
            .filter(t => ((t.assignedTo && typeof t.assignedTo === 'object') ? t.assignedTo.account : t.assignedTo) === account)
            .map(t => ({
                id: t.id,
                name: t.name,
                status: t.status,
                estimate: Number(t.estimate) || 0,
                consumed: Number(t.consumed) || 0,
                left: Number(t.left) || 0,
                story: t.story || 0,
                deadline: t.deadline || ''
            }));
        ok({
            status: 'ok',
            account,
            executionId: parseInt(executionId),
            executionTaskTotal: arr.length,
            myTaskTotal: myTasks.length,
            myTasks
        });
    } catch (e) {
        fail(e.message);
    }
}
