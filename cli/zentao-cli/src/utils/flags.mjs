/** 工具：命令行 --flag 参数解析（--kebab-case value / --key=value / 布尔开关） */

/**
 * 解析 flags 参数
 * @param {string[]} argv
 * @returns {Object<string, string|boolean>} kebab-case 自动转 camelCase
 */
export function parseFlags(argv) {
    const flags = {};
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (!a || !a.startsWith('--')) continue;
        let key, value;
        const eq = a.indexOf('=');
        if (eq > -1) {
            key = a.slice(2, eq);
            value = a.slice(eq + 1);
        } else {
            key = a.slice(2);
            const next = argv[i + 1];
            if (next !== undefined && !next.startsWith('--')) { value = next; i++; }
            else value = true;
        }
        const camel = key.replace(/-([a-zA-Z])/g, (_, c) => c.toUpperCase());
        flags[camel] = value;
    }
    return flags;
}
