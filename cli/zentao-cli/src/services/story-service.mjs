/**
 * 业务逻辑 — Story（研发需求）与 Task 创建
 *
 * 创建流程（SKILL.md 关键约定）：
 * - Story 直接激活：POST /stories → review 激活 → assign 重新指派（激活会清空指派）
 * - Task 关联刚创建的 Story ID，挂在执行下
 */
import { api } from '../protocol/http-client.mjs';
import * as endpoints from '../protocol/endpoints.mjs';
import { getBaseUrl } from '../config.mjs';

/** 构建 Story 创建请求体 */
export function buildStoryBody(payload, story) {
    return {
        product: payload.productId,
        title: story.title,
        spec: story.spec || '',
        category: 'common',
        type: 'story',
        source: 'other',
        module: story.module,
        assignedTo: story.assignedTo,
        execution: payload.executionId,
        plan: payload.planId || 0,
        pri: story.pri || 3
    };
}

/** 构建 Task 创建请求体 */
export function buildTaskBody(story, t) {
    return {
        name: t.name,
        assignedTo: t.assignedTo || story.assignedTo,
        estStarted: t.estStarted || '',
        realStarted: t.estStarted || '',
        deadline: t.deadline || '',
        module: t.module || story.module,
        story: story.storyId,
        type: t.type || 'devel',
        pri: t.pri || 3,
        estimate: t.estimate || 4,
        consumed: 0,
        left: t.estimate || 4,
        desc: t.desc || ''
    };
}

/**
 * 创建 Story 并直接激活、指派
 * @returns {Promise<{id: number}|{error: string}>}
 */
export async function createActiveStory(token, storyBody, assignedTo) {
    const baseUrl = getBaseUrl();
    const r = await api(endpoints.createStory(baseUrl), 'POST', token, storyBody);
    const story = r.story || r;
    if (!story.id) {
        return { error: `Story创建失败: ${JSON.stringify(r).substring(0, 200)}` };
    }
    const storyId = story.id;
    await api(endpoints.storyReview(baseUrl, storyId), 'POST', token, { result: 'pass' });
    if (assignedTo) {
        await api(endpoints.storyAssign(baseUrl, storyId), 'POST', token, { assignedTo });
    }
    return { id: storyId };
}

/**
 * 创建任务（关联 Story，挂在执行下）
 * @returns {Promise<{id: number}|{error: string}>}
 */
export async function createTask(token, executionId, taskBody) {
    const r = await api(endpoints.executionTasks(getBaseUrl(), executionId), 'POST', token, taskBody);
    const task = r.task || r;
    if (task.id) return { id: task.id };
    return { error: `Task创建失败: ${JSON.stringify(r).substring(0, 200)}` };
}
