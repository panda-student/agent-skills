/**
 * 业务逻辑 — 工时填写与任务关闭的硬性规则（纯决策，不发请求）
 *
 * 硬性规则（SKILL.md / rules/工时与关闭.md）：
 * - 每天所有任务工时总和 ≤ 8h（跨执行按填写日期统计，由 AI 结合 dailyTotals 保证）
 * - 单任务总消耗 ≤ 预计工时（CLI 预检拦截）
 * - 剩余工时为 0 → 自动完成任务并关闭
 * - 不能填未来日期；截止时间防超期
 * - 只能操作指派给自己的任务
 */
import { round2 } from '../utils/number.mjs';
import { isRealDate } from '../utils/date.mjs';

const AUTO_FINISHABLE_STATUS = ['wait', 'doing', 'pause'];
const CLOSABLE_STATUS = ['done', 'cancel'];

/**
 * effort 输入合法性校验
 * @param {import('../types.mjs').EffortInput} input
 * @param {string} todayStr 今天日期 YYYY-MM-DD
 * @returns {string|null} 错误信息（null 表示通过）
 */
export function validateEffortInput(input, todayStr) {
    if (!input.taskId) return '缺少 taskId';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(input.date || ''))) return 'date 格式必须为 YYYY-MM-DD';
    if (!(Number(input.consumed) > 0)) return 'consumed 必须大于0';
    if (input.date > todayStr) return `工时日期(${input.date})不能是未来日期(今天=${todayStr})`;
    const wantDeadline = input.deadline ? String(input.deadline) : '';
    if (wantDeadline && !isRealDate(wantDeadline)) return 'deadline 格式必须为 YYYY-MM-DD';
    if (wantDeadline && wantDeadline < input.date) return `指定截止时间(${wantDeadline})不能早于工时日期(${input.date})`;
    return null;
}

/** 只能操作指派给自己的任务 */
export function mineViolationMessage(task, account) {
    if (task.assignedTo === account) return null;
    return `任务指派给 ${task.assignedTo || '(空)'}，不是当前账号(${account})的任务，只能操作指派给自己的任务（先用 my-work/my-tasks 筛选）`;
}

/**
 * 截止时间防超期：计算是否需要先调整截止时间
 * @returns {{from: string, to: string}|null}
 */
export function computeDeadlineAdjustment(task, date, wantDeadline) {
    const cur = task.deadline;
    if (wantDeadline && wantDeadline !== cur) {
        return { from: cur, to: wantDeadline };
    }
    if (!wantDeadline && isRealDate(cur) && cur < date) {
        return { from: cur, to: date };
    }
    return null;
}

/** 单任务总消耗 ≤ 预计工时（超出必须重新分配） */
export function estimateViolationMessage(before, consumed) {
    if (before.estimate > 0 && round2(before.consumed + consumed) > before.estimate) {
        return `总消耗(${round2(before.consumed + consumed)}h)将超过预计工时(${before.estimate}h)，请重新分配（换任务或减小本次工时）`;
    }
    return null;
}

/**
 * 计算填写后的剩余工时（省略 left 时按 当前剩余-本次消耗）
 * @returns {{value: number, error: string|null}}
 */
export function computeNewLeft(before, input) {
    const value = (input.left === undefined || input.left === null || input.left === '')
        ? Math.max(0, round2(before.left - Number(input.consumed)))
        : Number(input.left);
    if (value < 0) return { value, error: `剩余工时不能为负(当前left=${before.left})` };
    return { value, error: null };
}

/** 剩余为 0 且未禁用自动关闭 → 需要自动完成+关闭 */
export function needsAutoClose(task, autoCloseFlag) {
    return round2(task.left) === 0 && autoCloseFlag !== false;
}

/** 任务是否处于可执行 finish 的状态 */
export function finishable(status) {
    return AUTO_FINISHABLE_STATUS.includes(status);
}

/** 任务是否可关闭（仅 done/cancel） */
export function closable(status) {
    return CLOSABLE_STATUS.includes(status);
}
