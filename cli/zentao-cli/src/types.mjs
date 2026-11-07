/**
 * 类型定义 — 全项目共享的 JSDoc typedef
 *
 * 说明：本项目为纯 JS 零依赖 ESM（.mjs），类型用 JSDoc 表达（编辑器开启 JS 类型检查即可获得完整提示）。
 * 其他文件通过 `@param {import('../types.mjs').NormalizedTask}` 等方式引用。
 */

/**
 * 禅道 CLI 配置（%USERPROFILE%\.zentao\config.json）
 * @typedef {Object} ZenTaoConfig
 * @property {string} 说明
 * @property {{baseUrl: string, account: string, password: string}} auth
 * @property {string} defaultAssignee
 */

/**
 * 待创建任务输入（来自数据准备阶段的 JSON）
 * @typedef {Object} TaskInput
 * @property {string} name                       任务名称
 * @property {string} [assignedTo]               指派账号（省略时用 Story 的指派人）
 * @property {string} [estStarted]               预计开始 YYYY-MM-DD
 * @property {string} [deadline]                 截止日期 YYYY-MM-DD
 * @property {number|string} [module]            所属模块ID（省略时用 Story 的模块）
 * @property {string} [type]                     任务类型，默认 devel
 * @property {number} [pri]                      优先级，默认 3
 * @property {number} [estimate]                 预计工时（小时），默认 4
 * @property {string} [desc]                     任务描述
 */

/**
 * 待创建研发需求输入
 * @typedef {Object} StoryInput
 * @property {string} title                      需求标题
 * @property {string} [spec]                     需求描述
 * @property {number|string} [module]            所属模块ID
 * @property {string} [assignedTo]               指派账号
 * @property {number} [pri]                      优先级，默认 3
 * @property {TaskInput[]} [tasks]               关联任务清单
 */

/**
 * create 命令数据文件结构
 * @typedef {Object} CreatePayload
 * @property {number} productId                  产品ID
 * @property {number} executionId                执行ID
 * @property {number} [planId]                   计划ID（可选）
 * @property {StoryInput[]} [stories]            批量格式
 * @property {StoryInput} [story]                单条格式（旧兼容）
 * @property {TaskInput[]} [tasks]               单条格式配套任务（旧兼容）
 */

/**
 * effort 命令输入（flags 或 JSON）
 * @typedef {Object} EffortInput
 * @property {number|string} taskId              任务ID
 * @property {string} date                       工时日期 YYYY-MM-DD
 * @property {number|string} consumed            本次消耗（小时）
 * @property {number|string} [left]              剩余工时（省略时自动按 当前剩余-本次消耗）
 * @property {string} [work]                     工作内容
 * @property {string} [deadline]                 最终截止日期（不得早于工时日期）
 * @property {boolean} [autoClose]               false 时关闭"剩余0自动完成+关闭"
 */

/**
 * 禅道原始工时记录（GET /tasks/{id}/estimate）
 * @typedef {Object} EffortRecord
 * @property {number} id
 * @property {string} date
 * @property {number} consumed
 * @property {number} left
 * @property {string} work
 * @property {string|{account: string}} account
 */

/**
 * 归一化后的任务对象（services/task-service.mjs normalizeTask 输出）
 * @typedef {Object} NormalizedTask
 * @property {number} id
 * @property {string} name
 * @property {string} status
 * @property {number|string} execution
 * @property {number} story
 * @property {number} estimate                   预计工时
 * @property {number} consumed                   已消耗工时
 * @property {number} left                       剩余工时
 * @property {string} assignedTo                 指派账号
 * @property {string} assignedToName
 * @property {boolean} isMine                    是否指派给当前登录账号
 * @property {string} deadline
 * @property {EffortRecord[]} efforts            工时明细
 */

/**
 * 按日期汇总的已填工时（account → 日期 → 小时）
 * @typedef {Object<string, number>} DailyTotals
 */

export {};
