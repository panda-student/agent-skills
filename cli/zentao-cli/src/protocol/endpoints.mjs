/**
 * 接口定义 — 禅道 REST 端点集中管理（唯一出 URL 的地方）
 *
 * 端点速查（详见技能 rules/API操作.md）：
 * | 端点                                        | 方法 | 说明                     |
 * |---------------------------------------------|------|--------------------------|
 * | /tokens                                     | POST | 获取 Token               |
 * | /products                                   | GET  | 产品列表                 |
 * | /executions                                 | GET  | 执行列表（需去重）       |
 * | /modules?type=story&id={pid}                | GET  | 产品级模块列表           |
 * | /users                                      | GET  | 用户列表                 |
 * | /products/{pid}/stories                     | GET  | 产品下需求（limit=500）  |
 * | /stories                                    | POST | 创建需求                 |
 * | /stories/{id}/review                        | POST | 激活需求（清空指派）     |
 * | /stories/{id}/assign                        | POST | 重新指派                 |
 * | /executions/{eid}/tasks                     | GET  | 执行下任务（limit=500）  |
 * | /executions/{eid}/tasks                     | POST | 创建任务（关联Story）    |
 * | /tasks?assignedTo={账号}                    | GET  | 按指派人查任务           |
 * | /tasks/{id}                                 | GET  | 任务详情（不含efforts）  |
 * | /tasks/{id}                                 | PUT  | 修改任务字段（deadline） |
 * | /tasks/{id}/estimate                        | GET  | 工时明细（开源版专用）   |
 * | /tasks/{id}/estimate                        | POST | 记录工时（官方端点）     |
 * | /tasks/{id}/finish                          | POST | 完成任务                 |
 * | /tasks/{id}/close                           | POST | 关闭任务（done/cancel）  |
 * | {webUrl}my-work-task.json                   | GET  | "我的任务"页面数据源     |
 *
 * 所有端点构建函数，第一个参数均为 baseUrl（或 webUrl）
 */

// 认证与基础数据
export const token = b => `${b}/tokens`;
export const users = b => `${b}/users?limit=500`;
export const products = b => `${b}/products?limit=500`;
export const executions = b => `${b}/executions?limit=500`;
export const modules = (b, productId) => `${b}/modules?type=story&id=${productId}`;
export const productStories = (b, productId) => `${b}/products/${productId}/stories?limit=500`;
export const executionTasks = (b, executionId) => `${b}/executions/${executionId}/tasks?limit=500`;
export const assignedTasks = (b, account) => `${b}/tasks?assignedTo=${account}`;

// Story（创建 → review 激活 → assign 重新指派）
export const createStory = b => `${b}/stories`;
export const storyReview = (b, storyId) => `${b}/stories/${storyId}/review`;
export const storyAssign = (b, storyId) => `${b}/stories/${storyId}/assign`;

// Task
export const taskDetail = (b, taskId) => `${b}/tasks/${taskId}`;          // GET 详情 / PUT 修改
export const taskFinish = (b, taskId) => `${b}/tasks/${taskId}/finish`;
export const taskClose = (b, taskId) => `${b}/tasks/${taskId}/close`;

// 工时（GET 明细 / POST 记录；recordEstimate 与 effort 为历史回退路径）
export const taskEstimate = (b, taskId) => `${b}/tasks/${taskId}/estimate`;
export const taskRecordEstimateAlt = (b, taskId) => `${b}/tasks/${taskId}/recordEstimate`;
export const taskEffort = (b, taskId) => `${b}/tasks/${taskId}/effort`;

// Web 页面数据源（.json 路由，需 Token 头）
export const myWork = webUrl => `${webUrl}my-work-task.json`;
