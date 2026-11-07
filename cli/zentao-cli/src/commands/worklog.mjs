/**
 * 命令：工时域 — effort（填写工时，剩余0自动完成+关闭）/ close（关闭任务）
 *
 * 编排顺序（规则判定在 services/worklog-rules.mjs，API 执行在 services/task-service.mjs）：
 * 输入校验 → 任务可操作性校验 → 截止时间防超期调整 → 超预计拦截 → 记录工时 → 回读验证 → 自动完成关闭
 */
import * as taskService from '../services/task-service.mjs';
import * as rules from '../services/worklog-rules.mjs';
import { getAccount, getWebUrl } from '../config.mjs';
import { getToken } from '../auth.mjs';
import { ok, fail } from '../utils/output.mjs';
import { isRealDate, todayLocal } from '../utils/date.mjs';
import { round2 } from '../utils/number.mjs';

/**
 * zentao effort <json路径> 或 zentao effort --task-id <ID> --date <日期> --consumed <h>
 *   [--left <剩余>] [--work "<内容>"] [--deadline <日期>] [--no-auto-close]
 * @param {import('../types.mjs').EffortInput} input
 */
export async function cmdEffort(input) {
    const steps = [];
    const failWith = (message) => fail(message, { steps });
    try {
        const account = getAccount();
        const todayStr = todayLocal();

        // 输入合法性（格式/未来日期/截止时间顺序）
        const inputErr = rules.validateEffortInput(input, todayStr);
        if (inputErr) failWith(inputErr);

        const taskId = input.taskId;
        const date = input.date;
        const consumed = Number(input.consumed);
        const work = input.work || '开发';
        const wantDeadline = input.deadline ? String(input.deadline) : '';

        const token = await getToken();
        const before = await taskService.getTaskDetail(token, taskId, false, account);
        if (!before) failWith(`任务 ${taskId} 不存在或无权限`);
        if (['done', 'closed', 'cancel'].includes(before.status)) {
            failWith(`任务状态为 ${before.status}，无需再填工时（需要关闭请用 close 命令）`);
        }

        // 规则校验: 只能操作指派给自己的任务
        const mineErr = rules.mineViolationMessage(before, account);
        if (mineErr) failWith(mineErr);

        // 规则校验: 截止时间防超期（工时日期超过截止时间 → 先调整）
        let deadlineAdjusted = null;
        const adjustment = rules.computeDeadlineAdjustment(before, date, wantDeadline);
        if (adjustment) {
            deadlineAdjusted = await taskService.adjustDeadline(token, taskId, adjustment.from, adjustment.to);
            steps.push({ step: '调整截止时间', from: deadlineAdjusted.from, to: deadlineAdjusted.to });
        }

        // 规则校验: 总消耗不能超过预计工时
        const estErr = rules.estimateViolationMessage(before, consumed);
        if (estErr) failWith(estErr);

        // 计算剩余工时
        const { value: newLeft, error: leftErr } = rules.computeNewLeft(before, input);
        if (leftErr) failWith(leftErr);

        // 记录工时
        steps.push({ step: '记录工时', date, consumed, left: newLeft, work });
        await taskService.recordEffortRaw(token, taskId, { date, consumed, left: newLeft, work });

        // 回读验证
        const after = await taskService.getTaskDetail(token, taskId, false, account);
        const verified = after.consumed >= round2(before.consumed + consumed) - 0.001;
        steps.push({
            step: '回读验证', ok: verified,
            consumedBefore: before.consumed, consumedAfter: after.consumed,
            leftAfter: after.left, status: after.status
        });
        if (!verified) failWith('工时记录后回读校验未通过，请打开任务页人工检查');

        // 剩余为 0 → 自动完成 + 关闭
        const actions = [];
        let finalTask = after;
        if (rules.needsAutoClose(after, input.autoClose)) {
            if (rules.finishable(after.status)) {
                try {
                    await taskService.finishTaskRaw(token, taskId, { realStarted: date, consumed: after.consumed, left: 0 });
                    actions.push({ action: 'finish', ok: true });
                } catch (e) {
                    actions.push({ action: 'finish', ok: false, message: e.message });
                }
            }
            finalTask = await taskService.getTaskDetail(token, taskId, false, account);
            if (finalTask.status !== 'closed') {
                try {
                    await taskService.closeTaskRaw(token, taskId, account);
                    actions.push({ action: 'close', ok: true });
                } catch (e) {
                    actions.push({ action: 'close', ok: false, message: e.message });
                }
                finalTask = await taskService.getTaskDetail(token, taskId, false, account);
            }
        }

        ok({
            status: 'ok',
            taskId: before.id,
            taskName: before.name,
            recorded: { date, consumed, left: newLeft, work },
            deadlineAdjusted,
            consumedTotalAfter: round2(after.consumed),
            actions,
            task: finalTask,
            link: `${getWebUrl()}task-view-${before.id}.html`
        });
    } catch (e) {
        failWith(e.message);
    }
}

/**
 * zentao close <任务ID> — 关闭任务（仅 done/cancel 状态；超过截止时间先调整再关闭）
 */
export async function cmdClose(taskId) {
    try {
        const account = getAccount();
        const webUrl = getWebUrl();
        const token = await getToken();
        const t = await taskService.getTaskDetail(token, taskId, false, account);
        if (!t) fail(`任务 ${taskId} 不存在或无权限`);
        if (t.status === 'closed') {
            ok({ status: 'ok', message: '任务已是关闭状态，无需操作', task: t, link: `${webUrl}task-view-${t.id}.html` });
            return;
        }
        if (!rules.closable(t.status)) {
            fail(`任务状态为 ${t.status}，需先填写工时使剩余为0（或状态为 done/cancel）才能关闭`, { task: t });
        }

        // 规则校验: 只能操作指派给自己的任务
        const mineErr = rules.mineViolationMessage(t, account);
        if (mineErr) fail(mineErr, { task: t });

        // 规则校验: 截止时间防超期（超过截止时间先调整，避免超期关闭）
        let deadlineAdjusted = null;
        const todayStr = todayLocal();
        if (isRealDate(t.deadline) && t.deadline < todayStr) {
            deadlineAdjusted = await taskService.adjustDeadline(token, t.id, t.deadline, todayStr);
        }

        await taskService.closeTaskRaw(token, taskId, account);
        const after = await taskService.getTaskDetail(token, taskId, false, account);
        ok({
            status: 'ok',
            taskId: t.id,
            taskName: t.name,
            statusBefore: t.status,
            statusAfter: after.status,
            deadlineAdjusted,
            link: `${webUrl}task-view-${t.id}.html`
        });
    } catch (e) {
        fail(e.message);
    }
}
