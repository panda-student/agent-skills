/** 工具：结构化 JSON 输出与错误退出（CLI 唯一的 stdout/stderr 出口约定） */

/** 成功输出（stdout，JSON pretty） */
export function ok(data) {
    console.log(JSON.stringify(data, null, 2));
}

/** 失败输出（stderr，JSON pretty）并退出码 1 */
export function fail(message, extra) {
    console.error(JSON.stringify(Object.assign({ status: 'error', message }, extra || {}), null, 2));
    process.exit(1);
}

/** 纯用法错误（stderr 单行 JSON），退出码 1 */
export function usageError(message) {
    console.error(JSON.stringify({ status: 'error', message }));
    process.exit(1);
}
