/** 命令：创建域 — preview（预览中文清单）/ create（创建 Story+Tasks，test 只建第1条） */
import * as storyService from '../services/story-service.mjs';
import { getWebUrl } from '../config.mjs';
import { getToken } from '../auth.mjs';
import { ok, fail } from '../utils/output.mjs';

/** 从 CreatePayload 归一出 stories 数组（兼容批量与单条两种格式） */
function extractStories(data) {
    return data.stories || [data.story ? { ...data.story, tasks: data.tasks || [] } : null].filter(Boolean);
}

/**
 * zentao preview <json路径> — 输出中文字段完整清单（用户确认用，不发请求）
 * @param {import('../types.mjs').CreatePayload} data
 */
export async function cmdPreview(data) {
    const stories = extractStories(data);
    const result = {
        status: 'ok',
        productId: data.productId,
        executionId: data.executionId,
        totalStories: stories.length,
        totalTasks: stories.reduce((sum, s) => sum + (s.tasks || []).length, 0),
        preview: []
    };

    for (const st of stories) {
        result.preview.push({
            所属产品: data.productId,
            关联执行: data.executionId,
            研发需求: {
                需求标题: st.title,
                需求描述: st.spec || '',
                所属模块: st.module,
                指派人: st.assignedTo || '',
                优先级: st.pri || 3
            },
            任务列表: (st.tasks || []).map(t => ({
                任务名称: t.name,
                任务类型: t.type || 'devel',
                指派账号: t.assignedTo || st.assignedTo || '',
                预计开始: t.estStarted || '',
                截止日期: t.deadline || '',
                所属模块: t.module || st.module,
                相关研发需求: '(创建后自动关联)',
                任务描述: t.desc || ''
            }))
        });
    }

    ok(result);
}

/**
 * zentao create <json路径> [test] — 创建 Story（激活+指派）+ Tasks
 * @param {import('../types.mjs').CreatePayload} data
 * @param {boolean} isTest true 时只创建第1条做测试
 */
export async function cmdCreate(data, isTest) {
    try {
        const token = await getToken();
        const webUrl = getWebUrl();
        const stories = extractStories(data);
        const itemsToCreate = isTest ? [stories[0]] : stories;

        const results = { story: null, tasks: [] };

        for (let si = 0; si < itemsToCreate.length; si++) {
            const st = itemsToCreate[si];

            const storyBody = storyService.buildStoryBody(data, st);
            const created = await storyService.createActiveStory(token, storyBody, st.assignedTo);
            if (created.error) {
                ok({ status: 'error', message: created.error, storyIndex: si });
                continue;
            }
            const storyId = created.id;
            const storyLink = `${webUrl}story-view-${storyId}.html`;

            const createdTasks = [];
            for (const t of (st.tasks || [])) {
                const taskBody = storyService.buildTaskBody({ ...st, storyId }, t);
                const taskResult = await storyService.createTask(token, data.executionId, taskBody);
                if (taskResult.id) {
                    createdTasks.push({
                        id: taskResult.id,
                        name: taskBody.name,
                        link: `${webUrl}task-view-${taskResult.id}.html`
                    });
                }
            }

            results.story = {
                id: storyId,
                title: st.title,
                link: storyLink,
                taskCount: createdTasks.length,
                tasks: createdTasks
            };
            results.tasks = createdTasks;
        }

        results.status = 'ok';
        results.testRun = !!isTest;
        results.message = isTest
            ? '测试创建完成，请检查链接，确认无误后执行批量创建'
            : `批量创建完成，共 ${results.tasks.length} 个任务`;

        ok(results);
    } catch (e) {
        fail(e.message);
    }
}
