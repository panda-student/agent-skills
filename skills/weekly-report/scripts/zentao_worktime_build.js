#!/usr/bin/env node
/**
 * 临时脚本：生成禅道工时补录草稿（跑完删除，算法固化进 skill）
 * 输入: gitlog_{pms,pms_frontend,pms_mobile}.txt + 任务清单（内置）
 * 输出: drafts/zentao-worktime-2026W39.txt
 * 规则: 每任务补录 left 小时使剩余=0；工时日期参考该任务提交日期；每天全局 ≤8h
 */
const fs = require('fs');
const path = require('path');
const lib = require('./lib/config.cjs');
const ROOT = lib.findProjectRoot() || process.cwd(); // 项目根（含 docs + .agents/.claude，或 .git）
const WEEK = process.argv[2] || isoWeek(new Date()); // 输出周标识，如 2026W45

// 待完成任务 → 需补录小时(left)
const TASKS = {
    23060: 4, 23061: 4, 23062: 4, 23063: 4, 24987: 24,
    22939: 12, 22940: 12, 22941: 12, 22942: 12, 22943: 4, 22944: 12, 22945: 12,
    23023: 4, 23024: 4, 22916: 32, 22917: 32, 24791: 32, 24792: 32
};
const EST_STARTED = {
    23060: '2026-08-17', 23061: '2026-08-17', 23062: '2026-08-17', 23063: '2026-08-17',
    24987: '2026-09-18', 22939: '2026-09-14', 22940: '2026-09-14', 22941: '2026-09-14',
    22942: '2026-09-14', 22943: '2026-09-14', 22944: '2026-09-14', 22945: '2026-09-14',
    23023: '2026-07-20', 23024: '2026-07-20', 22916: '2026-08-28', 22917: '2026-08-31',
    24791: '2026-09-10', 24792: '2026-09-10'
};

// 提交消息 → 任务映射（按优先级，命中即归）
const RULES = [
    [/合同|推送.*合同|htcontract|notifyapprover|notifyvariation/i, [24987]],
    [/离职|预警|交接|resign|dimission|handover/i, null, msg => /导出/.test(msg) ? [23024] : [23023]],
    [/计划效益|benefitfee|planbenefit/i, [22939]],
    [/月效益|benefitmonth|monthlybenefit/i, [22940]],
    [/年效益|实际年效益|benefityear|actualyear|annualbenefit/i, [22941]],
    [/未提交效益|unsubmitted/i, [22942]],
    [/月目标|monthunreached|未达成月/i, [22943]],
    [/年目标|yearunreached|未达成年/i, [22944]],
    [/回收|overdue|unrecovered/i, [22945]],
    [/离职.*导出|resign.*export/i, [23024]],
    [/品牌变更|materialbrand/i, [24792]],
    [/节点|回写|nodehandler|流程结束/i, [24792]],
    [/取人|wfrole|flowrole|角色配置|roleconfig/i, [24791]],
    [/变更详情|changedetail|变更基本信息/i, [22916]],
    [/关联.*(项目|数据)|变更.*关联/i, [22917]],
    [/签呈.*图|签呈.*字段|签呈.*页面/i, [23060]],
    [/签呈.*提交/i, [23062]],
    [/签呈.*节点/i, [23063]],
    [/签呈/i, [23060, 23061, 23062, 23063]], // 未细分的签呈提交轮流分
];

function loadCommits() {
    const out = [];
    for (const repo of ['pms', 'pms_frontend', 'pms_mobile']) {
        const lines = fs.readFileSync(path.join(ROOT, `gitlog_${repo}.txt`), 'utf8').split(/\r?\n/);
        for (const line of lines) {
            const m = line.match(/^(\d{4}-\d{2}-\d{2})\|(.+)$/);
            if (m) out.push({ date: m[1], msg: m[2], repo });
        }
    }
    return out;
}

function classify(commits) {
    const buckets = {}; // taskId -> Set(dates)
    const roundRobin = { idx: 0, order: [23060, 23061, 23062, 23063] };
    for (const c of commits) {
        for (const rule of RULES) {
            if (!rule[0].test(c.msg)) continue;
            let ids;
            if (typeof rule[2] === 'function') ids = rule[2](c.msg);
            else if (rule[1]) ids = rule[1];
            else continue;
            if (ids.length > 1) { ids = [roundRobin.order[roundRobin.idx++ % roundRobin.order.length]]; }
            for (const id of ids) {
                if (!TASKS[id]) continue;
                (buckets[id] = buckets[id] || new Set()).add(c.date);
            }
            break;
        }
    }
    return buckets;
}

function fmt(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
/** ISO 周标识，如 2026W45 */
function isoWeek(d) {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((t - yearStart) / 86400000) + 1) / 7);
    return `${t.getUTCFullYear()}W${String(week).padStart(2, '0')}`;
}
function workdays(from, to) {
    const out = [];
    const d = new Date(from + 'T00:00:00');
    const end = new Date(to + 'T00:00:00');
    while (d <= end) {
        const dow = d.getDay();
        if (dow !== 0 && dow !== 6) out.push(fmt(d));
        d.setDate(d.getDate() + 1);
    }
    return out;
}

function allocate(buckets) {
    const cap = {}; // date -> remaining hours (global 8h/day)
    const use = (date, h) => { cap[date] = (cap[date] === undefined ? 8 : cap[date]) - h; };
    const left = date => (cap[date] === undefined ? 8 : cap[date]);
    const plan = {}; // taskId -> [{date, h}]
    const warnings = [];
    const TODAY = fmt(new Date());

    // 按最早提交日排序任务（早的先占容量）
    const ids = Object.keys(TASKS).map(Number).sort((a, b) => {
        const da = buckets[a] ? Math.min(...buckets[a]) : '9999';
        const db = buckets[b] ? Math.min(...buckets[b]) : '9999';
        return da < db ? -1 : 1;
    });

    for (const id of ids) {
        let need = TASKS[id];
        const dates = buckets[id] ? [...buckets[id]].sort() : [];
        // estStarted 不可靠（常晚于实际提交），候选日期=全部提交日期
        const candidates = dates;
        const used = new Set();
        plan[id] = [];
        for (const d of candidates) {
            if (need <= 0) break;
            if (used.has(d)) continue; used.add(d);
            if (d > TODAY) break;
            const h = Math.min(need, left(d));
            if (h > 0) { plan[id].push({ date: d, h }); use(d, h); need -= h; }
        }
        // 不足 → 顺延后续工作日（≤今天）
        if (need > 0) {
            const lastDay = candidates.length ? candidates[candidates.length - 1] : '2026-07-01';
            for (const d of workdays(lastDay, TODAY)) {
                if (need <= 0) break;
                if (candidates.includes(d)) continue;
                const h = Math.min(need, left(d));
                if (h > 0) { plan[id].push({ date: d, h }); use(d, h); need -= h; }
            }
        }
        if (need > 0) warnings.push(`${id} 仍差 ${need}h（容量不足）`);
        plan[id].sort((a, b) => a.date < b.date ? -1 : 1);
    }
    return { plan, warnings, cap };
}

(function main() {
    const commits = loadCommits();
    const buckets = classify(commits);
    const { plan, warnings } = allocate(buckets);

    const lines = [];
    let totalH = 0;
    lines.push(`禅道工时补录数据 zentao-worktime-${WEEK}（生成于 ${TODAY}）`);
    lines.push('规则：工时日期参考代码提交日期；每天全局合计≤8h；每任务补录后剩余=0（自动完成）。');
    lines.push('');
    lines.push('【一、逐条记录】格式：任务ID<TAB>日期<TAB>小时（执行用，POST /tasks/{id}/estimates）');
    for (const id of Object.keys(plan).map(Number).sort((a, b) => a - b)) {
        for (const r of plan[id]) { lines.push(`${id}\t${r.date}\t${r.h}`); totalH += r.h; }
    }
    lines.push('');
    lines.push('【二、按任务汇总】任务ID<TAB>补录合计<TAB>日期范围<TAB>记录条数');
    for (const id of Object.keys(plan).map(Number).sort((a, b) => a - b)) {
        const rs = plan[id];
        const sum = rs.reduce((s, r) => s + r.h, 0);
        if (rs.length) lines.push(`${id}\t${sum}h\t${rs[0].date} ~ ${rs[rs.length - 1].date}\t${rs.length}条`);
        else lines.push(`${id}\t0h\t无提交记录可归属\t0条`);
    }
    lines.push('');
    const daily = {};
    for (const id of Object.keys(plan)) for (const r of plan[id]) daily[r.date] = (daily[r.date] || 0) + r.h;
    const maxDay = Math.max(0, ...Object.values(daily));
    lines.push(`【三、校验】总补录 ${totalH}h；每日最大 ${maxDay}h（≤8h）`);
    lines.push('【四、过期任务 deadline 调整】任务ID<TAB>新截止日（PATCH /tasks/{id}）');
    for (const id of [23060, 23061, 23062, 23063, 23064, 23056]) lines.push(`${id}\t2026-09-30`);
    if (warnings.length) { lines.push('【警告】'); warnings.forEach(w => lines.push('- ' + w)); }
    const outDir = path.join(ROOT, 'drafts');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, `zentao-worktime-${WEEK}.txt`), lines.join('\n'), 'utf8');
    console.log('written. total:', totalH, 'h; warnings:', warnings.length);
    console.log(warnings.join('\n'));
})();

