/** 命令：数据聚合 — fetch-data（一次拉取模块+全部Story+全部Task，供AI查重参考） */
import { api } from '../protocol/http-client.mjs';
import * as endpoints from '../protocol/endpoints.mjs';
import { getBaseUrl } from '../config.mjs';
import { getToken } from '../auth.mjs';
import { ok, fail } from '../utils/output.mjs';

/**
 * zentao fetch-data <产品ID> <执行ID>
 * 注意：结果仅供 AI 参考做查重，不展示给用户；不落盘避免残留个人数据
 */
export async function cmdFetchData(productId, executionId) {
    try {
        const token = await getToken();
        if (!token) throw new Error('获取Token失败');
        const baseUrl = getBaseUrl();

        const result = { status: 'ok', productId: parseInt(productId), executionId: parseInt(executionId) };

        // 模块列表（产品级，Story/Task 共用）
        try {
            const modRes = await api(endpoints.modules(baseUrl, productId), 'GET', token);
            const modArr = modRes.modules || (Array.isArray(modRes) ? modRes : []);
            result.modules = modArr.map(m => ({ id: m.id, name: m.name, parent: m.parent || 0 }));
        } catch (e) {
            result.modules = [];
            result.moduleError = e.message;
        }

        // 全部 Story（单次获取，禅道 page 参数不生效）
        const sr = await api(endpoints.productStories(baseUrl, productId), 'GET', token);
        const storyArr = sr.stories || (Array.isArray(sr) ? sr : []);
        result.stories = storyArr.map(s => ({
            id: s.id,
            title: s.title,
            status: s.status,
            module: s.module,
            assignedTo: s.assignedTo,
            spec: s.spec ? String(s.spec).substring(0, 100) : ''
        }));

        // 全部 Task（单次获取，禅道 page 参数不生效）
        const tr = await api(endpoints.executionTasks(baseUrl, executionId), 'GET', token);
        const taskArr = tr.tasks || (Array.isArray(tr) ? tr : []);
        result.tasks = taskArr.map(t => ({
            id: t.id,
            name: t.name,
            status: t.status,
            module: t.module,
            assignedTo: t.assignedTo,
            story: t.story || 0
        }));

        result.stats = {
            modules: result.modules.length,
            stories: result.stories.length,
            tasks: result.tasks.length
        };

        ok(result);
    } catch (e) {
        fail(e.message);
    }
}
