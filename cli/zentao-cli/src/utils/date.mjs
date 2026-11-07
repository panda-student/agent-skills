/** 工具：日期处理（本地时区，避免 UTC 偏移） */

/** 是否为真实日期（排除未设置的 0000-00-00 和空值） */
export function isRealDate(d) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(d || '')) && d !== '0000-00-00';
}

/** 本地日期 YYYY-MM-DD（避免 toISOString 的 UTC 时区偏移） */
export function todayLocal() {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}
