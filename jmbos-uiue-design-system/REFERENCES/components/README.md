# 组件规范索引 Component Index

> **JMBOS UIUE Design System** | 共 **15** 个核心组件 | v4.23.0
>
> 📌 **重要**: 所有数值必须引用 [design-tokens.css](../ASSETS/design-tokens.css) 中的 CSS 变量

## Quick Navigation

| 组件 | 文件 | 核心特性 | 复杂度 | 版本 |
|------|------|---------|--------|------|
| 🎯 [按钮](buttons.md) | `buttons.md` | 四态 + 三类型 + 按钮组规则 | ⭐⭐⭐ | v4.0 |
| 🔘 [操作按钮组](action-buttons.md) | `action-buttons.md` | 最多6个 + 更多按钮 + 按类型着色 | ⭐⭐⭐⭐ | v4.1.0 |
| 📊 [表格](tables.md) | `tables.md` | 3种类型 + 操作列 + 固定列增强 | ⭐⭐⭐⭐⭐ | v4.2.0 |
| ✏️ [表单输入框](form-inputs.md) | `form-inputs.md` | 五态交互 + Focus外光环 + 图标规则 | ⭐⭐ | v4.0 |
| ☑️ [复选框](checkboxes.md) | `checkboxes.md` | 禁止accent-color + 伪元素五态 + 表格/表单双场景 | ⭐⭐ | v1.0 |
| 🔍 [查询栏](query-bar.md) | `query-bar.md` | 单行/多行布局 + 白色背景强制 | ⭐⭐⭐ | v4.10.0 |
| 🧭 [导航菜单](navigation.md) | `navigation.md` | 顶导42px + 侧边栏180px + Logo规范 | ⭐⭐⭐⭐ | v5.1.1 |
| 📦 [卡片](cards.md) | `cards.md` | 两层规则：大卡片(.page-card)无阴影无边框 + 子卡片(.card)有S1阴影 + 内容包裹规则 | ⭐⭐⭐ | v5.1 |
| 🏷️ [标签](tags.md) | `tags.md` | 5色变体 + R1圆角 + 无边框/有边框 | ⭐⭐ | v5.0 |
| 📑 [选项卡/标签页](tabs.md) | `tabs.md` | 三种样式（标准/页签/分类标签）+ 可配置删除 | ⭐⭐⭐ | v1.0.0 |
| 🔣 [图标](icons.md) | `icons.md` | 113个SVG + 场景化尺寸 + 颜色规范 | ⭐⭐⭐⭐⭐ | v7.1.0 |
| 📄 [分页](Pagination.md) | `Pagination.md` | 弹窗/列表页双场景 + 条目数选择器 + 跳转页 | ⭐⭐⭐ | v1.0 |
| 📐 [抽屉](drawer.md) | `drawer.md` | 详情场景专用 + 800px/全屏切换 + 蓝色标题区 + 默认3列 | ⭐⭐⭐ | v1.0.0 |
| 🖼️ [弹窗](modal.md) | `modal.md` | 三档尺寸 + 蓝色标题区40px + 完整表单元素 + 四种关闭方式 | ⭐⭐⭐⭐ | v1.1.0 |
| ❓ [确认对话框](confirm-dialog.md) | `confirm-dialog.md` | 二次确认专用 + 404px固定宽 + 四态变体（通用/成功/警告/危险）+ 主按钮色随类型 | ⭐⭐⭐ | v1.0.0 |

---

## Usage Guide

### For Developers (日常开发)

需要查看某组件规范时：

1. **从本索引找到对应组件** - 点击上方表格中的链接
2. **进入详细文档** - 查看完整的 CSS/HTML 代码示例
3. **查看 CSS 变量引用** → [design-tokens.css](../ASSETS/design-tokens.css)
4. **查看视觉参考** → [component-reference/](../ASSETS/component-reference/)

### 场景化组件查阅指南 ⭐ v4.21.0 新增

> **目标**：根据你的具体开发场景，快速定位需要查阅的组件规范和参考资源
>
> **使用方法**：找到对应的场景卡片 → 按优先级逐项查阅 → 全部打勾 ☑ 后开始编码

---

#### 📋 场景速查表

| 场景 | 核心组件数 | 典型页面 | 复杂度 | 详细清单 |
|------|-----------|---------|--------|---------|
| 📊 **列表页** | 8个核心 + 1个参考 | 数据列表、查询结果 | ⭐⭐⭐⭐ | [查看完整清单 →](#1-列表页-list-page) |
| 📄 **详情页** | 5个核心 + 3个参考 | 信息展示、数据详情 | ⭐⭐⭐ | [查看完整清单 →](#2-详情页-detail-page) |
| ✏️ **表单页** | 6个核心 + 3个参考 | 数据录入、编辑表单 | ⭐⭐⭐⭐ | [查看完整清单 →](#3-表单页-form-page) |  
| 💬 **弹窗/对话框** | 6个核心 + 4个参考 | 确认提示、内联编辑 | ⭐⭐⭐⭐ | [查看完整清单 →](#4-弹窗对话框-modal) |

---

#### 1️⃣ 列表页 (List Page)

> **典型场景**：数据管理后台、查询结果展示、CRUD 列表界面
>
> **详细规范** → [page-types.md §1 列表页](../page-types.md#1-列表页-list-page) | **页面模板** → [pages/list.js](../ASSETS/page-shells/pages/list.js)

**🎯 必读核心组件（按优先级排序）**

| # | 组件 | 文档路径 | 关键查阅点 | 状态 |
|---|------|---------|-----------|------|
| 1 | 🧭 **导航菜单** | [navigation.md](navigation.md) | 顶导42px + 侧边180px + Logo规范 | ☐ |
| 2 | 🔍 **查询栏** | [query-bar.md](query-bar.md) | 白色背景 + 72px标签 + 6种布局模式 | ☐ |
| 3 | 📊 **表格** | [tables.md](tables.md) | 表头/单元格/操作列/.data-table 类名 | ☐ |
| 4 | 🔘 **操作按钮组** | [action-buttons.md](action-buttons.md) | 最多6个按钮 + 更多按钮 + 类型着色 | ☐ |
| 5 | 🎯 **按钮** | [buttons.md](buttons.md) | 四态 + 四类型(Primary/Secondary/Danger/Default) | ☐ |
| 6 | 🔣 **图标** | [icons.md](icons.md) | 场景化尺寸(.icon/.icon-nav) + 颜色控制 | ☐ |
| 7 | 🏷️ **标签** | [tags.md](tags.md) | 5色变体 + R1圆角（用于状态列） | ☐ |
| 8 | 📄 **分页** | [Pagination.md](Pagination.md) | 弹窗/列表页双场景 + 条目数选择器 + 跳转页 | ☐ |

**📚 必读视觉参考**

| # | 资源 | 路径 | 查阅内容 | 状态 |
|---|------|------|---------|------|
| 9 | 列表页示例图 | `ASSETS/page-examples/列表页/单行查询.png` | 整体布局参考（查询栏+工具栏+表格+分页） | ☐ |

**✅ 通过标准**：9项全部查阅完毕（状态均为 ☑）

---

#### 2️⃣ 详情页 (Detail Page)

> **典型场景**：数据详情展示、信息查看、记录详情
>
> **详细规范** → [page-types.md §2 详情页](../page-types.md#2-详情页-detail-page) | **页面模板** → [pages/detail.js](../ASSETS/page-shells/pages/detail.js)

**🎯 必读核心组件（按优先级排序）**

| # | 组件 | 文档路径 | 关键查阅点 | 状态 |
|---|------|---------|-----------|------|
| 1 | 🧭 **导航菜单** | [navigation.md](navigation.md) | 顶导42px + 侧边180px + Logo规范 | ☐ |
| 2 | 📦 **卡片** | [cards.md](cards.md) | 两层规则：大卡片无阴影无边框 + 子卡片S1阴影 + 内容包裹(标题必须在.page-card内) | ☐ |
| 3 | 🎯 **按钮** | [buttons.md](buttons.md) | 四态 + 四类型 + 尺寸（返回/操作按钮） | ☐ |
| 4 | 🔣 **图标** | [icons.md](icons.md) | 场景化尺寸 + 颜色控制（返回箭头等） | ☐ |
| 5 | 🏷️ **标签** | [tags.md](tags.md) | 5色变体（用于状态展示） | ☐ |

**📚 必读视觉参考**

| # | 资源 | 路径 | 查阅内容 | 状态 |
|---|------|------|---------|------|
| 6 | 描述列表参考图 | `ASSETS/component-reference/描述列表.png` | 键值对信息展示（详情页核心） | ☐ |
| 7 | 标签页参考图 | `ASSETS/component-reference/标签页.png` | Tab切换（多视图详情页） | ☐ |
| 8 | 详情页示例图 | `ASSETS/page-examples/详情页/默认.png` | 整体布局参考 | ☐ |

**✅ 通过标准**：8项全部查阅完毕（状态均为 ☑）

---

#### 3️⃣ 表单页 (Form Page)

> **典型场景**：数据录入、新建/编辑记录、配置表单
>
> **详细规范** → [page-types.md §3 表单页](../page-types.md#3-表单页-form-page) | **页面模板** → [pages/form.js](../ASSETS/page-shells/pages/form.js)

**🎯 必读核心组件（按优先级排序）**

| # | 组件 | 文档路径 | 关键查阅点 | 状态 |
|---|------|---------|-----------|------|
| 1 | 🧭 **导航菜单** | [navigation.md](navigation.md) | 顶导42px + 侧边180px + Logo规范 | ☐ |
| 2 | ✏️ **表单输入框** | [form-inputs.md](form-inputs.md) | 五态交互 + Focus外光环 + .input-field 类名 | ☐ |
| 3 | 🎯 **按钮** | [buttons.md](buttons.md) | 四态 + 四类型（提交/取消按钮） | ☐ |
| 4 | 🔣 **图标** | [icons.md](icons.md) | 场景化尺寸 + 颜色控制 | ☐ |
| 5 | 📦 **卡片** | [cards.md](cards.md) | 两层规则：表单容器用.page-card(无阴影无边框) + 内容包裹 | ☐ |
| 6 | 🔍 **查询栏** | [query-bar.md](query-bar.md) | 如有筛选条件时必读 | ☐ |

**📚 必读视觉参考**

| # | 资源 | 路径 | 查阅内容 | 状态 |
|---|------|------|---------|------|
| 7 | 输入框参考图 | `ASSETS/component-reference/单行文本.png` | 输入框五态 + 前后缀 + 字数统计 | ☐ |
| 8 | 选择器参考图 | `ASSETS/component-reference/选择器.png` | 下拉选择/单选/多选/搜索选择 | ☐ |
| 9 | 表单页示例图 | `ASSETS/page-examples/表单页/上下布局.png` | 整体布局参考 | ☐ |

**✅ 通过标准**：9项全部查阅完毕（状态均为 ☑）

---

#### 4️⃣ 弹窗/对话框 (Modal)

> **典型场景**：确认提示、内联编辑、简单表单、详情预览
>
> **详细规范** → [modal.md](modal.md) | **页面模板** → [pages/modal.js](../ASSETS/page-shells/pages/modal.js)

**🎯 必读核心组件（按优先级排序）**

| # | 组件 | 文档路径 | 关键查阅点 | 状态 |
|---|------|---------|-----------|------|
| 1 | 🎯 **按钮** | [buttons.md](buttons.md) | 四态 + 四类型（确定/取消/关闭按钮） | ☐ |
| 2 | 🔣 **图标** | [icons.md](icons.md) | 场景化尺寸（关闭X图标）+ 颜色控制 | ☐ |
| 3 | ✏️ **表单输入框** | [form-inputs.md](form-inputs.md) | 五态交互（如弹窗内有表单） | ☐ |
| 4 | 📦 **卡片** | [cards.md](cards.md) | 两层规则：弹窗内部无阴影大卡片 + 内容包裹 | ☐ |
| 5 | 🏷️ **标签** | [tags.md](tags.md) | 5色变体（用于状态展示） | ☐ |
| 6 | 🔘 **操作按钮组** | [action-buttons.md](action-buttons.md) | 按钮组规则（弹窗底部操作区） | ☐ |

**📚 必读视觉参考**

| # | 资源 | 路径 | 查阅内容 | 状态 |
|---|------|------|---------|------|
| 7 | 弹窗参考图 | `ASSETS/component-reference/弹窗（对话框）.png` | 3种尺寸（588px/908px/100vw）+ 底部操作区 | ☐ |
| 8 | 输入框参考图 | `ASSETS/component-reference/单行文本.png` | 输入框五态（如弹窗内有表单） | ☐ |
| 9 | 选择器参考图 | `ASSETS/component-reference/选择器.png` | 下拉选择/单选/多选（如弹窗内有表单） | ☐ |
| 10 | 弹窗示例图 | `ASSETS/page-examples/表单弹窗/上下布局/中号弹窗（3列）.png` | 整体布局参考 | ☐ |

**✅ 通过标准**：10项全部查阅完毕（状态均为 ☑）

---

#### ⚠️ 通用规则（所有场景适用）

1. **禁止跳过任何一项**："我之前看过"不算，**本次任务必须重新查阅并确认**
2. **最低要求**：以上各场景的清单为最低要求，如涉及其他组件（树形、上传、富文本等），**必须额外查阅** [ASSETS/README.md](../ASSETS/README.md)
3. **全局前置**：所有场景都建议先查阅 [Design Tokens](../ASSETS/design-tokens.css) 了解 CSS 变量定义
4. **参考图查看方式**：使用 Read 工具读取图片文件，或直接在文件系统中打开

#### 💡 完整组件扩展指引（48个补充组件）

> 以上4个场景清单仅覆盖**最常用的9个核心组件**。如涉及其他组件（数据录入/数据展示/反馈与导航/特殊场景共48个），请查阅 [ASSETS/README.md §3.1 完整清单](../ASSETS/README.md#31-完整清单48个组件) 获取组件名、触发场景、参考图路径与快速访问链接。

---

## 核心组件规范状态速查（15 个有 .md 文字规范）

> 下方仅列出"已规范"的核心组件（有独立 .md）。其余 36 个组件仅有 PNG 参考图，无独立文字规范，参考图即为视觉标准，完整清单见 [ASSETS/README.md §3.1](../ASSETS/README.md#31-完整清单48个组件)。

| # | 组件 | 文字规范 | 参考图 | 状态 |
|---|------|---------|--------|------|
| 1 | 按钮 | [buttons.md](buttons.md) | [按钮.png](../../ASSETS/component-reference/按钮.png) | 已规范 |
| 2 | 操作按钮组 | [action-buttons.md](action-buttons.md) | [按钮.png](../../ASSETS/component-reference/按钮.png) | 已规范 |
| 3 | 表格 | [tables.md](tables.md) | [表格.png](../../ASSETS/component-reference/表格.png) | 已规范 |
| 4 | 表单输入框 | [form-inputs.md](form-inputs.md) | [单行文本.png](../../ASSETS/component-reference/单行文本.png) | 已规范 |
| 5 | 复选框 | [checkboxes.md](checkboxes.md) | [多选框.png](../../ASSETS/component-reference/多选框.png) | 已规范 |
| 6 | 查询栏 | [query-bar.md](query-bar.md) | [查询栏.png](../../ASSETS/component-reference/查询栏.png) | 已规范 |
| 7 | 导航菜单 | [navigation.md](navigation.md) | [导航菜单.png](../../ASSETS/component-reference/导航菜单.png) | 已规范 |
| 8 | 卡片 | [cards.md](cards.md) | [卡片.png](../../ASSETS/component-reference/卡片.png) | 已规范 |
| 9 | 标签 | [tags.md](tags.md) | [标签.png](../../ASSETS/component-reference/标签.png) | 已规范 |
| 10 | 选项卡/标签页 | [tabs.md](tabs.md) | [标签页.png](../../ASSETS/component-reference/标签页.png) | 已规范 |
| 11 | 分页 | [Pagination.md](Pagination.md) | [分页.png](../../ASSETS/component-reference/分页.png) | 已规范 |
| 12 | 图标 | [icons.md](icons.md) | [icons-sprite.svg](../../ASSETS/icons/icons-sprite.svg) | 已规范 |
| 13 | 抽屉 | [drawer.md](drawer.md) | [抽屉.png](../../ASSETS/component-reference/抽屉.png) | 已规范 |
| 14 | 弹窗 | [modal.md](modal.md) | [弹窗（对话框）.png](../../ASSETS/component-reference/弹窗（对话框）.png) | 已规范 |
| 15 | 确认对话框 | [confirm-dialog.md](confirm-dialog.md) | [弹窗（对话框）.png](../../ASSETS/component-reference/弹窗（对话框）.png) | 已规范 |

> **统计**：已规范 15 个（含 .md）+ 仅参考图 36 个 = **48 张 PNG + 1 个 SVG**，共覆盖 51 个组件条目（按钮.png 被 buttons.md 和 action-buttons.md 共享；弹窗（对话框）.png 被 modal.md 和 confirm-dialog.md 共享）

---

*版本历史见 [META/CHANGELOG.md](../../META/CHANGELOG.md)*
