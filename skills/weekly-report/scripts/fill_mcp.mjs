#!/usr/bin/env node
/**
 * 周报三视图 MCP 直写（官方 smartsheet.* 工具，无浏览器、无剪贴板、无焦点问题）
 * 用法:
 *   node fill_mcp.mjs <draft.txt>            # 解析草稿三节并写入三个 sheet
 *   node fill_mcp.mjs --clean                # 删除三个 sheet 中所有空行（所有可写字段皆空）
 *   node fill_mcp.mjs --mock                 # 三表各写 1 条 MOCK-记录（验证用）
 * 实测要点: 日期=毫秒时间戳(string_value)；singleSelect=option_value:{items:[{id}]}（option 必须已存在）；
 *          number=number_value；text=text_value:{items:[{text}]}；记录落位=表尾（分组自动归位）
 */
import fs from 'fs';
import lib from './lib/config.cjs';

// 配置驱动：表标识/字段名/视图 全部来自技能内 config/tdocs_mcp.json（改表结构只改配置）
const CFG = lib.loadConfig('tdocs_mcp.json', 'TDOCS_CONFIG');
lib.requireSecret(CFG.token, '腾讯文档 token');
const FILE = CFG.doc.file_id;
const SHEETS = Object.fromEntries(Object.entries(CFG.doc.sheets).map(([k, v]) => [k, v.sheet_id]));
const TID_MAP = Object.fromEntries(Object.entries(CFG.doc.sheets).map(([k, v]) => [k, v.text_field]));
const DAILY_VIEW = CFG.doc.sheets.daily.view_id;
const token = CFG.token;

const call = (id, method, params = {}) =>
    fetch('https://docs.qq.com/openapi/mcp', {
        method: 'POST',
        headers: { Authorization: token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
    }).then(r => r.json());
let _id = 10;
async function tool(name, args) {
    const r = await call(_id++, 'tools/call', { name, arguments: args });
    if (r.error) throw new Error(`${name}: ${JSON.stringify(r.error)}`);
    const c = r.result?.content?.[0];
    const text = c?.text ?? '{}';
    try { return JSON.parse(text); } catch { return { raw: text }; }
}
const ms = d => new Date(`${d}T00:00:00+08:00`).getTime();

// ---- 字段元数据（每 sheet 拉一次，option text→id 映射） ----
const fieldMeta = {}; // sheetKey -> { title -> {type, opts:Map(text->id)} }
async function loadFields(sheetKey, viewId) {
    const r = await tool('smartsheet.list_fields', { file_id: FILE, sheet_id: SHEETS[sheetKey], ...(viewId ? { view_id: viewId } : {}) });
    const m = {};
    for (const f of r.fields || []) {
        const opts = new Map();
        for (const o of f.property_single_select?.options || f.property_select?.options || []) opts.set(o.text, o.id);
        m[f.field_title] = { type: f.field_type, opts };
    }
    fieldMeta[sheetKey] = m;
}

// ---- 记录构造 ----
function buildFieldValues(sheetKey, pairs) {
    const meta = fieldMeta[sheetKey];
    return pairs.map(([title, val]) => {
        const f = meta[title];
        if (!f) throw new Error(`[${sheetKey}] 字段不存在: ${title}`);
        if (f.type === 'dateTime') return { field: title, string_value: String(ms(val)) };
        if (f.type === 'number') return { field: title, number_value: parseInt(val) };
        if (f.type === 'text') return { field: title, text_value: { items: [{ text: val, type: 'text' }] } };
        if (f.type === 'singleSelect' || f.type === 'select') {
            const id = f.opts.get(val);
            if (!id) throw new Error(`[${sheetKey}] 选项不存在: ${title}=${val}（现有: ${[...f.opts.keys()].join('/')}）`);
            return { field: title, option_value: { items: [{ id, text: val }] } };
        }
        throw new Error(`[${sheetKey}] 未支持字段类型: ${title}=${f.type}`);
    });
}

// ---- 草稿解析（节标记 + 日期开头 TSV 行） ----
function getSection(text, startMark, endMark) {
    const s = text.indexOf(startMark);
    if (s < 0) throw new Error(`草稿缺少节: ${startMark}`);
    let body = text.slice(s + startMark.length);
    if (endMark) { const e = body.indexOf(endMark); if (e >= 0) body = body.slice(0, e); }
    return body.split(/\r?\n/).filter(l => /^\d{4}-\d{2}-\d{2}\t/.test(l)).map(l => l.split('\t'));
}

(async () => {
    const mode = process.argv[2] || '';
    await Promise.all([loadFields('weekly'), loadFields('daily', DAILY_VIEW), loadFields('next')]); // 三表字段元数据并行

    // 单表清理：分页读全量 → 找空行/MOCK → 删除
    async function cleanOne(key) {
        const r = await tool('smartsheet.list_records', { file_id: FILE, sheet_id: SHEETS[key], limit: 100 });
        let doomed = [], offset = 0, hasMore = r.has_more;
        const scan = recs => recs.forEach(rec => {
            const vals = rec.field_values || [];
            const texts = vals.filter(v => v.text_value?.items).flatMap(v => v.text_value.items.map(i => i.text || ''));
            const hasMock = texts.some(t => t.includes('MOCK-'));
            const meaningful = vals.filter(v =>
                v.field !== '最后编辑人' && v.field !== '最后编辑时间' &&
                (v.text_value?.items?.some(i => (i.text || '').trim()) || v.option_value?.items?.length ||
                 (v.number_value ?? null) !== null || v.string_value));
            if (hasMock || meaningful.length === 0) doomed.push(rec.record_id);
        });
        scan(r.records || []);
        while (hasMore) {
            offset += (r.records || []).length;
            const r2 = await tool('smartsheet.list_records', { file_id: FILE, sheet_id: SHEETS[key], limit: 100, offset });
            scan(r2.records || []); hasMore = r2.has_more;
        }
        if (doomed.length) {
            await tool('smartsheet.delete_records', { file_id: FILE, sheet_id: SHEETS[key], record_ids: doomed });
            return `[clean] ${key} 删除 ${doomed.length} 条（空行/MOCK）`;
        }
        return `[clean] ${key} 无空行`;
    }

    if (mode === '--clean') {
        (await Promise.all(Object.keys(SHEETS).map(cleanOne))).forEach(r => console.log(r));
        return;
    }

    if (mode === '--mock') {
        const mocks = [
            ['daily', [['日期', '2026-10-19'], ['成员', '孙志强'], ['项目', 'PMS'], ['工作内容', 'MOCK-验证记录：验证后删除']]],
            ['weekly', [['日期', '2026-10-23'], ['成员', '孙志强'], ['项目', 'PMS'], ['问题处理总数', '1'], ['新增需求数', '1'], ['问题处理', 'MOCK-验证记录：验证后删除']]],
            ['next', [['日期', '2026-10-23'], ['成员', '孙志强'], ['项目', 'PMS'], ['下周工作计划', 'MOCK-验证记录：验证后删除'], ['开始时间', '2026-10-26'], ['计划完成时间', '2026-10-30']]],
        ];
        const results = await Promise.all(mocks.map(([key, pairs]) =>
            tool('smartsheet.add_records', { file_id: FILE, sheet_id: SHEETS[key], records: [{ field_values: buildFieldValues(key, pairs) }] })
                .then(r => `[mock] ${key}: ${JSON.stringify(r).slice(0, 150)}`)));
        results.forEach(r => console.log(r));
        return;
    }

    // 正式填写：解析草稿
    const draft = fs.readFileSync(process.argv[2], 'utf8');
    const daily = getSection(draft, '【一、日报】', '【二、');
    const weekly = getSection(draft, '【二、周报汇总】', '【三、')[0];
    const next = getSection(draft, '【三、下周计划】', null)[0];
    if (!daily.length || !weekly || !next) throw new Error('草稿三节解析为空');

    const jobs = [
        ['daily', daily.map(c => [['日期', c[0]], ['成员', c[1]], ['项目', c[2]], ['工作内容', c[3] || '']])],
        ['weekly', [[['日期', weekly[0]], ['成员', weekly[1]], ['项目', weekly[2]], ['问题处理总数', weekly[3] || '0'], ['新增需求数', weekly[4] || '0'], ['问题处理', weekly[5] || '']]]],
        ['next', [[['日期', next[0]], ['成员', next[1]], ['项目', next[2]], ['下周工作计划', next[3] || ''], ['开始时间', next[4] || next[0]], ['计划完成时间', next[5] || '']]]],
    ];
    const t0 = Date.now();
    const results = await Promise.all(jobs.map(([key, records]) =>
        tool('smartsheet.add_records', { file_id: FILE, sheet_id: SHEETS[key], records: records.map(p => ({ field_values: buildFieldValues(key, p) })) })
            .then(r => `[fill] ${key} ${records.length} 条: ${JSON.stringify(r).slice(0, 100)}`)));
    results.forEach(r => console.log(r));
    console.log(`[done] 三表并行写入完成，耗时 ${((Date.now() - t0) / 1000).toFixed(1)}s`);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
