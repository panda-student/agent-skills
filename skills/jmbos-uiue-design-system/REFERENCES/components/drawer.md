# 抽屉 Drawer

> JMBOS UIUE Design System | 详情抽屉独立规范 | v1.0.0
>
> 📌 所有数值必须引用 [design-tokens.css](../../ASSETS/design-tokens.css) 中的 CSS 变量
>
> 🔗 **关联规范**：
> - 描述列表布局 → [page-types.md §2 描述列表](../page-types.md#描述列表-detail-list--键值对展示)
> - 标题区样式 → 与弹窗一致，参考 [page-types.md §4 弹窗](../page-types.md#4-弹窗对话框-modal)
> - 图标规范 → [icons.md](icons.md)

---

## 1. 组件定位

| 属性 | 说明 |
|------|------|
| **使用场景** | 仅限详情查看场景（从右侧滑入展示记录详情） |
| **禁止场景** | ❌ 禁止用于表单编辑/新增；❌ 禁止用于确认提示（用弹窗）；❌ 禁止用于复杂数据录入 |
| **触发方式** | 列表页"查看"操作 → 调用 `openDrawer(id)` |
| **滑入方向** | 从右侧滑入（`translateX(100%)` → `translateX(0)`） |
| **层级** | 高于弹窗（`z-index: calc(var(--z-index-modal) + 1)`） |

---

## 2. 结构组成

```
┌─────────────────────────────────────────────┐
│  遮罩层 .drawer-overlay                      │ ← rgba(20,27,36,0.45)
│  ┌───────────────────────────────────────┐  │
│  │  标题区 .drawer-header (固定)          │  │ ← 主题蓝色背景，文字反白
│  │  [标题文字]        [放大/缩小] [关闭X]  │  │
│  ├───────────────────────────────────────┤  │
│  │                                       │  │
│  │  内容区 .drawer-body (可滚动)          │  │ ← 20px 留白
│  │  ┌─────────────────────────────┐     │  │
│  │  │ 区块标题                     │     │  │
│  │  │ ┌──────┐ ┌──────┐ ┌──────┐ │     │  │ ← 描述列表默认3列
│  │  │ │标签：值│ │标签：值│ │标签：值│ │     │  │
│  │  │ └──────┘ └──────┘ └──────┘ │     │  │
│  │  └─────────────────────────────┘     │  │
│  │                                       │  │
│  ├───────────────────────────────────────┤  │
│  │  底部操作栏 .drawer-footer (可选)      │  │ ← 默认不提供
│  │                    [取消] [确定]      │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

**结构清单**：

| # | 区域 | 类名 | 必需 | 说明 |
|---|------|------|------|------|
| 1 | 遮罩层 | `.drawer-overlay` | ✅ 必需 | 半透明遮罩，点击可关闭 |
| 2 | 面板 | `.drawer` | ✅ 必需 | 右侧滑入面板容器 |
| 3 | 标题区 | `.drawer-header` | ✅ 必需 | 主题蓝色背景，固定在顶部 |
| 4 | 标题文字 | `.drawer-title` | ✅ 必需 | 反白显示 |
| 5 | 尺寸切换 | `.drawer-toggle` | ✅ 必需 | 放大/缩小按钮，关闭按钮左侧 |
| 6 | 关闭按钮 | `.drawer-close` | ✅ 必需 | 关闭X图标 |
| 7 | 内容区 | `.drawer-body` | ✅ 必需 | 20px留白，可滚动 |
| 8 | 底部操作栏 | `.drawer-footer` | ❌ 可选 | 默认不提供，需求要求时才加 |

---

## 3. 尺寸规范

### 3.1 两档尺寸

| 模式 | 宽度 | 高度 | 触发方式 | 说明 |
|------|------|------|---------|------|
| **默认模式** | `800px` | `100vh`（铺满高度） | 默认状态 | 常规详情查看 |
| **全屏模式** | `100vw`（铺满宽度） | `100vh` | 点击放大按钮 | 复杂详情、大量信息 |

> **尺寸切换规则**：放大则全屏（100vw），缩小则 800px 宽度。两档之间无中间尺寸。
>
> **窄屏适配**：当屏幕宽度 < 800px 时，默认模式宽度自动收缩为 `90vw`（`max-width: 90vw`），避免超出屏幕。

### 3.2 尺寸切换按钮

| 属性 | 默认模式显示 | 全屏模式显示 |
|------|------------|------------|
| **图标** | `goaway`（放大图标） | `towards`（收回图标） |
| **title** | "放大" | "缩小" |
| **位置** | 标题区右侧，关闭按钮**左边** | 同左 |

---

## 4. 样式规范

### 4.1 标题区（与弹窗一致）

> 抽屉标题区与弹窗标题区（`.modal-header`）样式统一：主题蓝色背景 + 文字/图标反白。

| 属性 | 值 | 说明 |
|------|---|------|
| **背景色** | `var(--color-primary)` → `#3685F2` | 主题蓝色 |
| **文字色** | `var(--color-text-white)` → `#FFFFFF` | 反白 |
| **整体高度** | `40px` | 固定高度（与弹窗一致） |
| **水平内边距** | `20px` | 左右内边距 |
| **布局** | `flex; align-items: center; justify-content: space-between` | 标题左 + 按钮右 |
| **底部边框** | 无 | 蓝色背景无需分割线 |
| **固定方式** | `flex-shrink: 0` | 不随内容滚动 |
| **标题字号** | `var(--font-size-lg)` → `14px` | 与弹窗标题一致 |
| **标题字重** | `var(--font-weight-semibold)` → `600` | 半粗体 |

### 4.2 标题区按钮

| 按钮 | 图标 | 图标尺寸 | 颜色 | Hover 背景 |
|------|------|---------|------|-----------|
| 尺寸切换 `.drawer-toggle` | `goaway` / `towards` | `16px` | `#FFFFFF` | `rgba(255,255,255,0.15)` |
| 关闭 `.drawer-close` | `remove` | `16px` | `#FFFFFF` | `rgba(255,255,255,0.15)` |

> 按钮容器尺寸 `24px × 24px`，圆角 `var(--radius-r2)`（4px）。图标统一使用图标库 SVG Sprite（`#icon-goaway` / `#icon-towards` / `#icon-remove`）。

### 4.3 内容区

| 属性 | 值 | 说明 |
|------|---|------|
| **内边距** | `20px` | 上下左右统一 20px |
| **滚动行为** | `overflow-y: auto; overflow-x: hidden` | 仅纵向滚动 |
| **弹性** | `flex: 1` | 撑满标题区与底栏之间的空间 |
| **背景色** | `var(--color-bg-card)` → `#FFFFFF` | 白色 |

### 4.4 描述列表（抽屉内默认3列）

> 与 [page-types.md §2 描述列表](../page-types.md#描述列表-detail-list--键值对展示) 规范一致，但抽屉内**默认3列**（非2列）。

| 属性 | 值 | 说明 |
|------|---|------|
| **布局** | CSS Grid `repeat(3, 1fr)` | 默认3列等宽 |
| **行列间距** | `20px` | 统一 20px |
| **Label 字号** | `var(--font-size-sm)` → `12px` | 小字号 |
| **Label 颜色** | `var(--color-text-secondary)` → `#7C8493` | 次要文字色 |
| **Value 字号** | `var(--font-size-sm)` → `12px` | 小字号 |
| **Value 颜色** | `var(--color-text-primary)` → `#141b24` | 主文字色 |
| **Value 溢出** | 单行省略（`text-overflow: ellipsis`） | 超长自动截断 |
| **Label 后缀** | 全角冒号 `：` | `::after` 伪元素 |

### 4.5 底部操作栏（默认不提供，启用时固定屏幕底部）

> ⭐ **固定规则**：当配置了底部操作栏时，不论抽屉内容多少，操作栏始终固定在屏幕高度底部，按钮在行内居右排列。内容区（`.drawer-body`）独立滚动，操作栏不随内容滚动。

| 属性 | 默认状态 | 启用状态（需求要求时） |
|------|---------|---------------------|
| **是否渲染** | ❌ 不渲染 `.drawer-footer` | ✅ 渲染 |
| **固定位置** | — | 固定在抽屉底部（屏幕底部），不随内容滚动 |
| **内边距** | — | `20px` |
| **顶部边框** | — | `1px solid var(--color-bg-divider)` |
| **对齐** | — | `justify-content: flex-end`（按钮居右） |
| **按钮间距** | — | `var(--spacing-md)` → `12px` |
| **固定方式** | — | `flex-shrink: 0`（flex 布局下不被压缩，始终贴底） |

> **实现原理**：抽屉面板 `.drawer` 为 `position: fixed; top: 0; bottom: 0; display: flex; flex-direction: column`，高度撑满屏幕。标题区 `flex-shrink: 0` 固定顶部，内容区 `flex: 1; overflow-y: auto` 独立滚动，底栏 `flex-shrink: 0` 固定底部。三者互不影响。

### 4.6 区块标题（内容区内）

| 属性 | 值 | 说明 |
|------|---|------|
| **字号** | `var(--font-size-base)` → `13px` | 二级标题字号 |
| **字重** | `var(--font-weight-semibold)` → `600` | 半粗体 |
| **颜色** | `var(--color-primary)` → `#3685F2` | 主题色 |
| **下边距** | `12px` | 与描述列表间距 |

### 4.7 遮罩层

| 属性 | 值 | 说明 |
|------|---|------|
| **背景色** | `rgba(20, 27, 36, 0.45)` | 半透明深色 |
| **层级** | `calc(var(--z-index-modal) + 1)` | 高于弹窗 |
| **过渡** | `opacity + visibility`，`var(--transition-base)` | 淡入淡出 |

### 4.8 面板

| 属性 | 默认模式 | 全屏模式 |
|------|---------|---------|
| **宽度** | `800px`（`max-width: 90vw`） | `100vw` |
| **高度** | `100vh` | `100vh` |
| **定位** | `fixed; top: 0; right: 0; bottom: 0` | 同左 |
| **背景色** | `var(--color-bg-card)` → `#FFFFFF` | 同左 |
| **层级** | `calc(var(--z-index-modal) + 2)` | 同左 |
| **阴影** | `var(--shadow-s3)` | 全屏时无阴影（铺满） |
| **滑入动画** | `translateX(100%) → translateX(0)` | 同左 |
| **过渡** | `transform var(--transition-base) ease-in-out` | 同左 |
| **布局** | `flex; flex-direction: column` | 同左 |

---

## 5. 设计令牌引用表

| 令牌 | 变量名 | 值 | 用途 |
|------|--------|---|------|
| 主题色 | `--color-primary` | `#3685F2` | 标题区背景 |
| 白色文字 | `--color-text-white` | `#FFFFFF` | 标题/图标反白 |
| 卡片背景 | `--color-bg-card` | `#FFFFFF` | 面板/内容区背景 |
| 分割线 | `--color-bg-divider` | `#E4E7F0` | 底栏顶部边框 |
| 主文字 | `--color-text-primary` | `#141b24` | 描述列表值 |
| 次要文字 | `--color-text-secondary` | `#7C8493` | 描述列表标签 |
| 大间距 | `--spacing-lg` | `20px` | 内部留白/行列间距 |
| 中间距 | `--spacing-md` | `12px` | 底栏按钮间距 |
| 标题字号 | `--font-size-lg` | `14px` | 标题文字 |
| 区块标题字号 | `--font-size-base` | `13px` | 区块标题 |
| 小字号 | `--font-size-sm` | `12px` | 描述列表标签/值 |
| 半粗 | `--font-weight-semibold` | `600` | 标题字重 |
| 中圆角 | `--radius-r2` | `4px` | 按钮容器圆角 |
| 强阴影 | `--shadow-s3` | `0 12px 30px rgba(20,27,36,0.18)` | 面板阴影 |
| 弹窗层级 | `--z-index-modal` | `1001` | 层级基准 |
| 基础过渡 | `--transition-base` | `250ms ease-in-out` | 滑入/淡入动画 |

---

## 6. 完整 CSS 代码

> 以下代码可直接复制到页面 `.html` 的 `<style>` 块中。所有值使用 CSS 变量，禁止硬编码。

```css
/* ===== 抽屉详情样式（从右侧滑入，仅详情场景）===== */

/* 遮罩层 */
.drawer-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background-color: rgba(20, 27, 36, 0.45);
  z-index: calc(var(--z-index-modal, 1001) + 1);
  opacity: 0; visibility: hidden;
  transition: opacity var(--transition-base, 0.25s), visibility var(--transition-base, 0.25s);
}
.drawer-overlay.show { opacity: 1; visibility: visible; }

/* 面板 - 固定全屏高度，flex 列布局（标题区固定顶部，内容区滚动，底栏固定底部）*/
.drawer {
  position: fixed; top: 0; right: 0; bottom: 0;
  height: 100vh;                                  /* ⭐ 显式全屏高度，确保底栏固定屏幕底部 */
  width: 800px; max-width: 90vw;
  background-color: var(--color-bg-card);
  z-index: calc(var(--z-index-modal, 1001) + 2);
  display: flex; flex-direction: column;
  transform: translateX(100%);
  transition: transform var(--transition-base, 0.25s) ease-in-out, width var(--transition-base, 0.25s) ease-in-out;
  box-shadow: var(--shadow-s3, 0 12px 30px rgba(20, 27, 36, 0.18));
}
.drawer.show { transform: translateX(0); }

/* 全屏模式 */
.drawer.drawer-fullscreen {
  width: 100vw; max-width: 100vw;
  box-shadow: none;
}

/* 标题区 - 主题蓝色背景，文字/图标反白（与弹窗一致）*/
.drawer-header {
  display: flex; align-items: center; justify-content: space-between;
  height: 40px; padding: 0 20px;
  background-color: var(--color-primary);
  color: var(--color-text-white);
  flex-shrink: 0;
}
.drawer-title {
  font-size: var(--font-size-lg, 14px);
  font-weight: var(--font-weight-semibold, 600);
  color: var(--color-text-white);
  margin: 0; flex: 1;
}
.drawer-header-actions {
  display: flex; align-items: center; gap: 4px; flex-shrink: 0;
}

/* 标题区按钮（切换/关闭）- 反白 */
.drawer-toggle, .drawer-close {
  display: inline-flex; align-items: center; justify-content: center;
  width: 24px; height: 24px;
  border: none; background: none; cursor: pointer; padding: 0;
  border-radius: var(--radius-r2, 4px);
  color: var(--color-text-white);
  transition: background-color var(--transition-fast, 0.15s);
}
.drawer-toggle svg, .drawer-close svg { width: 16px; height: 16px; }
.drawer-toggle:hover, .drawer-close:hover {
  background-color: rgba(255, 255, 255, 0.15);
}

/* 内容区 - 20px留白，可滚动 */
.drawer-body {
  flex: 1;
  overflow-y: auto; overflow-x: hidden;
  padding: 20px;
  background-color: var(--color-bg-card);
}

/* 底部操作栏 - 默认不渲染，需求要求时才加 */
.drawer-footer {
  display: flex; justify-content: flex-end; gap: var(--spacing-md, 12px);
  padding: 20px;
  border-top: 1px solid var(--color-bg-divider);
  flex-shrink: 0;
}

/* ===== 抽屉内描述列表（默认3列）===== */
.detail-section { margin-bottom: 24px; }
.detail-section:last-child { margin-bottom: 0; }
.detail-section-title {
  font-size: var(--font-size-base, 13px);
  font-weight: var(--font-weight-semibold, 600);
  color: var(--color-primary, #3685F2);
  margin-bottom: 12px;
}

/* 描述列表网格 - 默认3列（抽屉专用）*/
.detail-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

/* 单个描述项 */
.detail-item {
  display: flex; flex-direction: row; align-items: baseline;
  gap: 4px; min-width: 0; overflow: hidden;
}
.detail-label {
  font-size: var(--font-size-sm, 12px);
  color: var(--color-text-secondary, #7C8493);
  font-weight: var(--font-weight-regular, 400);
  white-space: nowrap; flex-shrink: 0;
}
.detail-label::after { content: "："; }
.detail-value {
  font-size: var(--font-size-sm, 12px);
  color: var(--color-text-primary, #141b24);
  font-weight: var(--font-weight-regular, 400);
  flex: 1; min-width: 0;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
```

---

## 7. 完整 HTML 结构

```html
<!-- ========== 抽屉详情：查看记录（从右侧滑入）========== -->
<div class="drawer-overlay" id="drawerOverlay" onclick="closeDrawer()"></div>
<aside class="drawer" id="detailDrawer">
  <!-- 标题区：主题蓝色背景 + 反白 -->
  <div class="drawer-header">
    <h2 class="drawer-title">详情标题</h2>
    <div class="drawer-header-actions">
      <!-- 尺寸切换按钮（关闭按钮左边）-->
      <button class="drawer-toggle" onclick="toggleDrawerSize()" title="放大">
        <svg class="icon"><use href="#icon-goaway"></use></svg>
      </button>
      <!-- 关闭按钮 -->
      <button class="drawer-close" onclick="closeDrawer()" title="关闭">
        <svg class="icon"><use href="#icon-remove"></use></svg>
      </button>
    </div>
  </div>
  <!-- 内容区：20px留白，可滚动 -->
  <div class="drawer-body" id="drawerBody">
    <!-- 动态填充详情内容 -->
  </div>
  <!-- 底部操作栏：默认不渲染，需求要求时才加 -->
  <!-- 取消下方注释即可启用
  <div class="drawer-footer">
    <button class="btn btn-secondary" onclick="closeDrawer()">取消</button>
    <button class="btn btn-primary" onclick="handleDrawerAction()">确定</button>
  </div>
  -->
</aside>
```

---

## 8. 完整 JS 交互代码

```javascript
/* ============================================================
 * 抽屉交互（打开/关闭/尺寸切换）
 * ============================================================ */

// 打开抽屉并填充详情内容
function openDrawer(id) {
  var data = MOCK_DATA.find(function(item) { return item.id === id; });
  var body = document.getElementById('drawerBody');
  if (!data) {
    body.innerHTML = '<p style="color:var(--color-text-secondary);text-align:center;padding:40px 0;">未找到数据</p>';
  } else {
    body.innerHTML =
      '<div class="detail-section">' +
        '<h3 class="detail-section-title">基本信息</h3>' +
        '<div class="detail-grid">' +
          '<div class="detail-item"><span class="detail-label">编号</span><span class="detail-value">' + data.id + '</span></div>' +
          '<div class="detail-item"><span class="detail-label">名称</span><span class="detail-value">' + data.name + '</span></div>' +
          '<div class="detail-item"><span class="detail-label">状态</span><span class="detail-value">' + data.status + '</span></div>' +
        '</div>' +
      '</div>';
  }
  document.getElementById('drawerOverlay').classList.add('show');
  document.getElementById('detailDrawer').classList.add('show');
}

// 关闭抽屉
function closeDrawer() {
  document.getElementById('drawerOverlay').classList.remove('show');
  document.getElementById('detailDrawer').classList.remove('show');
}

// 尺寸切换：放大→全屏，缩小→800px
function toggleDrawerSize() {
  var drawer = document.getElementById('detailDrawer');
  var btn = drawer.querySelector('.drawer-toggle');
  if (drawer.classList.contains('drawer-fullscreen')) {
    // 当前全屏 → 缩小为800px
    drawer.classList.remove('drawer-fullscreen');
    btn.title = '放大';
    btn.innerHTML = '<svg class="icon"><use href="#icon-goaway"></use></svg>';
  } else {
    // 当前800px → 放大为全屏
    drawer.classList.add('drawer-fullscreen');
    btn.title = '缩小';
    btn.innerHTML = '<svg class="icon"><use href="#icon-towards"></use></svg>';
  }
}

// ESC 关闭抽屉
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    var drawer = document.getElementById('detailDrawer');
    if (drawer && drawer.classList.contains('show')) closeDrawer();
  }
});

// 挂载到 window
window.openDrawer = openDrawer;
window.closeDrawer = closeDrawer;
window.toggleDrawerSize = toggleDrawerSize;
```

---

## 9. 使用指引

### 9.1 何时使用抽屉

| 场景 | 推荐组件 | 原因 |
|------|---------|------|
| 查看记录详情（不离开列表页） | ✅ 抽屉 | 快速查看，关闭即回列表 |
| 新增/编辑表单 | ❌ 弹窗或表单页 | 抽屉仅限详情 |
| 确认提示（删除确认等） | ❌ 弹窗 | 轻量操作用弹窗 |
| 复杂数据录入 | ❌ 表单页 | 独立页面更合适 |
| 详情内容较多、需全屏查看 | ✅ 抽屉（全屏模式） | 支持尺寸切换 |

### 9.2 与弹窗的区别

| 对比项 | 抽屉 | 弹窗 |
|--------|------|------|
| 滑入方向 | 右侧滑入 | 居中弹出 |
| 使用场景 | 详情查看 | 确认/简单表单 |
| 底部操作栏 | 默认不提供 | 默认提供 |
| 尺寸切换 | 支持（800px ↔ 全屏） | 不支持（固定三档） |
| 标题区样式 | 主题蓝色背景 + 反白 | 主题蓝色背景 + 反白（一致） |

---

## 10. 质量检查清单

> 每次使用抽屉时逐项检查，全部通过后方可交付。

### 10.1 结构检查
- [ ] 包含 `.drawer-overlay` 遮罩层
- [ ] 包含 `.drawer` 面板容器
- [ ] 标题区使用 `.drawer-header`，背景为 `var(--color-primary)`
- [ ] 标题文字和图标颜色为 `var(--color-text-white)`（反白）
- [ ] 包含尺寸切换按钮 `.drawer-toggle`（关闭按钮左边）
- [ ] 包含关闭按钮 `.drawer-close`
- [ ] 内容区使用 `.drawer-body`，padding 为 20px
- [ ] 默认不渲染 `.drawer-footer`（除非需求明确要求）

### 10.2 尺寸检查
- [ ] 默认宽度为 `800px`（非 480px）
- [ ] `max-width: 90vw`（窄屏适配）
- [ ] 全屏模式宽度为 `100vw`
- [ ] 尺寸切换按钮图标正确（放大 `goaway` / 缩小 `towards`）

### 10.3 内容检查
- [ ] 描述列表 `.detail-grid` 默认 3 列（`repeat(3, 1fr)`）
- [ ] 描述列表行列间距为 `20px`
- [ ] 区块标题 `.detail-section-title` 颜色为主题色 `#3685F2`
- [ ] 内容区仅纵向滚动（`overflow-y: auto`），标题区固定不动

### 10.4 交互检查
- [ ] `openDrawer(id)` 能正确打开并填充内容
- [ ] `closeDrawer()` 能正确关闭
- [ ] 点击遮罩层可关闭
- [ ] ESC 键可关闭
- [ ] 尺寸切换按钮可在 800px ↔ 全屏 之间切换
- [ ] 所有样式值使用 CSS 变量，无硬编码

---

## 11. 视觉参考

| 参考图 | 路径 | 说明 |
|--------|------|------|
| 抽屉组件参考 | `ASSETS/component-reference/抽屉.png` | 组件视觉规范 |
| 抽屉示例 | `ASSETS/page-examples/详情页/抽屉.png` | 默认抽屉效果 |
| 抽屉有操作按钮 | `ASSETS/page-examples/详情页/抽屉 有操作按钮.png` | 含底部操作栏 |
| 抽屉最大化 | `ASSETS/page-examples/详情页/抽屉最大化.png` | 全屏模式效果 |

---

## 12. 版本历史

| 版本 | 日期 | 变更内容 |
|------|------|---------|
| **v1.0.0** | 2026-07-30 | **初始独立规范**：从 page-list.md / list.js 散落内容中抽取整合，查缺补漏。修正标题区为主题蓝色背景+反白；默认宽度 480px→800px；新增全屏尺寸+切换按钮；内部留白统一 20px；描述列表默认 2 列→3 列；底部操作栏改为默认不提供；明确仅限详情场景 |

---

*最后更新: 2026-07-30 | v1.0.0 | 详情抽屉独立规范*
