# 页面必备交互 (Page Interactions)

> JMBOS UIUE Design System 交互规范文档
>
> 📌 **核心目标**：消灭"死按钮"——任何可见的可点击元素必须绑定交互行为并给出反馈
>
> 🔗 **相关文档**：
> - 布局基础/防错/QA → [page-layout.md](./page-layout.md)
> - 页面类型详解 → [page-types.md](./page-types.md)
> - 索引入口 → [SKILL.md](../SKILL.md)
> - 组件级规范 → [components/](./components/)
> - 检查清单 → [implementation-guide.md §6.4 交互完整性检查（AC1-AC7）](./implementation-guide.md#64-交互完整性检查ac1-ac7--7项-v100-新增)

## 目录

1. [通用约定](#1-通用约定)
2. [列表页必备交互](#2-列表页必备交互对应-ac1-ac5)
3. [详情页必备交互](#3-详情页必备交互对应-d-区--ac)
4. [表单页必备交互](#4-表单页必备交互对应-ac6)
5. [弹窗必备交互](#5-弹窗必备交互对应-ac7)
6. [交互覆盖率自检](#6-交互覆盖率自检)
7. [switchPage 错误处理](#7-switchpage-错误处理迭代区按需拉取场景必备)

---

## 1. 通用约定

> **实现方式**：Mock 数据 + 原生 JS 模拟（不依赖后端）

### Mock 数据约定

```javascript
// 列表页：5-10 条符合业务场景的假数据
var MOCK_DATA = [
  { id: 1, name: '示例记录1', status: 'active', ... },
  // ...
];

// 详情页：根据 URL id 参数查找
var record = MOCK_DATA.find(function(item) {
  return item.id === parseInt(new URLSearchParams(location.search).get('id'));
});
```

### 交互反馈约定

| 场景 | 反馈方式 | 实现 |
|------|---------|------|
| 加载态 | loading 占位（≥500ms，避免闪烁过快） | `showLoading()` + `setTimeout` |
| 成功提示 | `alert('保存成功')` 或 toast | `alert()` |
| 失败提示 | `alert('请填写所有必填项')` + 错误项标红 | `field.style.borderColor = 'var(--color-error)'` |
| 二次确认（删除/禁用/启用等） | 确认对话框（四态变体） | `openConfirm(id)` → 见 [confirm-dialog.md](./components/confirm-dialog.md) |

### 多页面跳转约定

> MPA 下 `js/common.js` 的 `switchPage(pageId, module)` 通过 `location.href` 跳转到 `pages/D-XXX_{页面功能名称}.html`，`sessionStorage` 持久化页签/模块状态，业务数据用 `localStorage` 传递（也可用 URL 查询参数）

```javascript
// 列表 → 新增/编辑
localStorage.setItem('editId', id);
switchPage('user-form', 'user-list');
// 表单保存成功 → 返回列表
switchPage('user-list');
// 列表 → 详情
localStorage.setItem('detailId', id);
switchPage('user-detail', 'user-list');
```

---

## 2. 列表页必备交互（对应 AC1-AC5）

| 交互项 | 触发元素 | 行为 | 参考实现 |
|--------|---------|------|---------|
| **查询** | `.query-bar .btn-primary` | 显示加载态 → 渲染表格 | [pages/list.js](../ASSETS/page-shells/pages/list.js) `handleSearch()` |
| **重置** | `.query-bar .btn-secondary` | 清空所有查询条件 → 重新渲染 | `handleReset()` |
| **新增** | `.action-bar .btn-primary` | 打开新增弹窗 或 跳转表单页 | `openModal('addModal')` |
| **编辑** | 操作列 `.link-btn` | 打开编辑弹窗 或 跳转（携带 id） | `handleEdit(id)` |
| **查看** | 操作列 `.link-btn` | 跳转详情页（携带 id） | `handleView(id)` |
| **删除** | 操作列 `.link-btn` | 弹出确认对话框 → 确认后移除该行 | `openConfirm('confirmDelete')` + `row.remove()`（详见 [confirm-dialog.md](./components/confirm-dialog.md)） |
| **分页** | `.pagination .page-btn` | 切换页码 → 重渲染 + 高亮当前页（分页固定容器底部，不随表格滚动） | `handlePageChange(page)` |

---

## 3. 详情页必备交互（对应 D 区 + AC）

| 交互项 | 触发元素 | 行为 | 参考实现 |
|--------|---------|------|---------|
| **返回** | 返回按钮 | 返回列表页 | [pages/detail.js](../ASSETS/page-shells/pages/detail.js) `handleBack()` |
| **编辑** | 操作按钮 | 跳转表单页（携带 id） | `handleEdit()` |
| **Tab 切换** | `.inline-tab` | 切换内容区块显示 | `handleTabSwitch(target)` |

---

## 4. 表单页必备交互（对应 AC6）

| 交互项 | 触发元素 | 行为 | 参考实现 |
|--------|---------|------|---------|
| **提交** | `.btn-primary` | 校验必填项 → 通过则提示成功并返回；不通过则标红 | [pages/form.js](../ASSETS/page-shells/pages/form.js) `handleFormSave()` |
| **取消** | `.btn-default` | 返回上一页 | `handleCancel()` |
| **必填校验** | `[required]` 字段 | 空值时边框标红 + 提示 | `querySelectorAll('[required]')` |

**表单提交校验模板**：
```javascript
function handleFormSave() {
  var requiredFields = document.querySelectorAll('[required]');
  var isValid = true;
  requiredFields.forEach(function(field) {
    if (!field.value.trim()) {
      field.style.borderColor = 'var(--color-error)';
      isValid = false;
    } else {
      field.style.borderColor = '';
    }
  });
  if (!isValid) {
    alert('请填写所有必填项');
    return;
  }
  alert('保存成功');
  switchPage('user-list');
}
```

---

## 5. 弹窗必备交互（对应 AC7）

> **完整交互代码** → [components/modal.md §9-§10](./components/modal.md)（含 openModal/closeModal/ESC/遮罩关闭/保存校验）
>
> ⚠️ **二次确认场景**（删除/禁用/启用/提交确认等）请使用 [确认对话框](./components/confirm-dialog.md)（`openConfirm(id)`），不再使用 `confirm()` 或小号弹窗承载。

| 交互项 | 触发元素 | 行为 | 函数 |
|--------|---------|------|------|
| **打开** | 新增/编辑按钮 | 显示弹窗 + 遮罩 | `openModal(id)` |
| **关闭-×按钮** | 右上角关闭图标 | 隐藏弹窗 + 遮罩 | `closeModal(id)` |
| **关闭-遮罩** | `.modal-overlay` | 点击遮罩区域关闭 | `closeModalOnOverlay(event, id)` |
| **关闭-ESC** | `document` | 按 ESC 键关闭 | `keydown` 监听 |
| **关闭-取消** | `.btn-secondary` | 取消按钮关闭 | `closeModal(id)` |
| **保存** | `.btn-primary` | 校验 → 提示 → 关闭 | `saveModal(id)` |

### 5.1 确认对话框交互（删除/禁用/启用等二次确认）

> **完整规范** → [components/confirm-dialog.md](./components/confirm-dialog.md)（四态变体 + 完整 CSS/HTML/JS）

| 交互项 | 触发元素 | 行为 | 函数 |
|--------|---------|------|------|
| **打开** | 删除/禁用/启用等按钮 | 显示确认对话框 + 遮罩 | `openConfirm(id)` |
| **关闭-×按钮** | 右上角关闭图标 | 隐藏对话框 + 遮罩 | `closeConfirm(id)` |
| **关闭-遮罩** | `.confirm-overlay` | 点击遮罩区域关闭 | `closeConfirmOnOverlay(event, id)` |
| **关闭-ESC** | `document` | 按 ESC 键关闭 | `keydown` 监听 |
| **关闭-取消** | `.btn-secondary` | 取消按钮关闭 | `closeConfirm(id)` |
| **确定** | `.btn-primary` / `.btn-warning` / `.btn-danger` | 执行业务回调 + 关闭 | 业务函数（如 `handleDeleteConfirm()`） |

**类型选择**：
- 删除/批量删除/清空数据 → `.confirm-danger`（红色图标 + btn-danger）
- 禁用/取消操作 → `.confirm-warning`（橙色图标 + btn-warning）
- 启用/停用/提交确认 → `.confirm-info`（蓝色图标 + btn-primary）
- 操作成功后引导 → `.confirm-success`（蓝色图标 + btn-primary）

---

## 6. 交互覆盖率自检

> 交付前用 `node scripts/interaction-scan.mjs <页面文件>` 自动扫描交互覆盖率（详见 [scripts/README.md](../scripts/README.md)）

**人工自检清单**：
- [ ] 所有 `.btn-primary` / `.btn-secondary` / `.btn-default` / `.btn-danger` 都有 onclick 或事件绑定
- [ ] 所有 `.link-btn`（操作列）都可点击且有反馈
- [ ] 所有 `.page-btn`（分页器）都可切换
- [ ] 所有 `[required]` 字段都有提交校验
- [ ] 所有弹窗都可打开、可关闭（×、遮罩、ESC、取消 四种方式）
- [ ] 跨页面跳转使用 `switchPage(pageId, module)`，业务数据用 `localStorage` / URL 查询参数

---

## 7. switchPage 错误处理（迭代区按需拉取场景必备）

> **场景**：迭代区只拉取了部分页面时，点击未拉取的页面 .html 文件不存在，需通过 `pageRoute` 路由未命中或 fetch HEAD 检测显示提示文字，避免 404 白屏。

### 7.1 JS 实现

> `switchPage(pageId, module)` 在 MPA 下由 `js/common.js` 实现为 `location.href` 跳转到 `pages/D-XXX_{页面功能名称}.html`，并通过 `sessionStorage` 持久化页签和模块状态。`__pageId` 仍由各页面 HTML 内 `<script>` 声明。

```javascript
function switchPage(pageId, module) {
  // MPA：location.href 跳转 + sessionStorage 持久化页签/模块状态
  if (module) { sessionStorage.setItem('activeModule', module); }
  sessionStorage.setItem('activePage', pageId);
  // 通过 pageRoute 路由表查 pageId → D-XXX_{页面功能名称}.html
  var route = (window.pageRoute || {})[pageId];
  if (!route) {
    // 路由未命中（页面 .html 文件不存在）→ 显示提示
    showNonIterativeHint();
    return;
  }
  location.href = 'pages/' + route.file;
}

function showNonIterativeHint() {
  var mainContent = document.getElementById('main-content');
  // 样式用CSS类名 + design-tokens 变量，禁止内联硬编码
  mainContent.innerHTML = '<div class="non-iterative-hint">'
    + '<div class="hint-box">'
    + '<p class="hint-title">该页面非本次迭代范围</p>'
    + '<p class="hint-desc">页面 .html 文件不存在，请在知识图谱完整版中查看</p>'
    + '</div></div>';
}
```

### 7.2 CSS 样式（定义在 `css/common.css` 中）

```css
.non-iterative-hint { display: flex; align-items: center; justify-content: center; height: 100%; color: var(--color-text-secondary); }
.non-iterative-hint .hint-box { text-align: center; }
.non-iterative-hint .hint-title { font-size: var(--font-size-xl); margin-bottom: var(--spacing-sm); }
.non-iterative-hint .hint-desc { font-size: var(--font-size-base); color: var(--color-text-tertiary); }
```

> 此实现自动适应任何页面组合，无需维护"已拉取清单"。知识图谱区所有页面文件都存在，不会触发提示。样式遵循 design-tokens 变量，禁止内联硬编码颜色/字号。
