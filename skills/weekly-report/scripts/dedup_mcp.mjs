#!/usr/bin/env node
/** 三表去重：按日期+成员+文本内容分组，保留最后编辑时间最早的一条，删其余 */
import lib from './lib/config.cjs';
// 配置驱动：表标识/字段名 来自技能内 config/tdocs_mcp.json
const CFG = lib.loadConfig('tdocs_mcp.json', 'TDOCS_CONFIG');
lib.requireSecret(CFG.token, '腾讯文档 token');
const FILE = CFG.doc.file_id;
const SHEETS = Object.fromEntries(Object.entries(CFG.doc.sheets).map(([k, v]) => [k, v.sheet_id]));
const TID = Object.fromEntries(Object.entries(CFG.doc.sheets).map(([k, v]) => [k, v.text_field]));
const token = CFG.token;
const call = (id, method, params = {}) => fetch('https://docs.qq.com/openapi/mcp', {
    method: 'POST', headers: { Authorization: token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
}).then(r => r.json());
let _id = 10;
const tool = async (name, args) => {
    const r = await call(_id++, 'tools/call', { name, arguments: args });
    if (r.error) throw new Error(`${name}: ${JSON.stringify(r.error)}`);
    return JSON.parse(r.result?.content?.[0]?.text || '{}');
};

// 单表去重：分页读全量 → 按 日期|成员|内容 分组 → 保留最后编辑最早，删其余
async function dedupOne(key) {
    let recs = [], offset = 0, hasMore = true;
    while (hasMore) {
        const r = await tool('smartsheet.list_records', { file_id: FILE, sheet_id: SHEETS[key], limit: 100, offset });
        recs = recs.concat(r.records || []); hasMore = r.has_more; offset = recs.length;
    }
    const groups = new Map();
    for (const rec of recs) {
        const vals = rec.field_values || [];
        const get = t => vals.find(v => v.field === t);
        const date = get('日期')?.string_value || '';
        const member = get('成员')?.option_value?.items?.[0]?.text || '';
        const text = (get(TID[key])?.text_value?.items || []).map(i => i.text || '').join('').trim();
        if (!text && !date) continue;
        const k = `${date}|${member}|${text}`;
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(rec);
    }
    const doomed = [];
    for (const [k, list] of groups) {
        if (list.length < 2) continue;
        list.sort((a, b) => {
            const t = x => x.field_values.find(v => v.field === '最后编辑时间')?.string_value || '0';
            return t(a).localeCompare(t(b));
        });
        list.slice(1).forEach(rec => doomed.push(rec.record_id));
        console.log(`[dedup] ${key} 重复 ${list.length} 条，保留最早，删 ${list.length - 1}: ${k.slice(0, 60)}...`);
    }
    if (doomed.length) {
        await tool('smartsheet.delete_records', { file_id: FILE, sheet_id: SHEETS[key], record_ids: doomed });
        console.log(`[dedup] ${key} 已删 ${doomed.length} 条`);
    } else console.log(`[dedup] ${key} 无重复`);
}

(async () => {
    await Promise.all(Object.keys(SHEETS).map(dedupOne)); // 三表并行
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
