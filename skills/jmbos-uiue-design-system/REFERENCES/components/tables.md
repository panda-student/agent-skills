# 表格样式 Tables

📌 **重要**: 所有数值必须引用 [design-tokens.css](../ASSETS/design-tokens.css) 中的 CSS 变量

---

## 表格样式 - 完整代码库

### 目录

- [列宽与布局策略](#列宽与布局策略)
- [类型1：基础默认表格](#类型1基础默认表格)
- [类型2：可选择表格](#类型2可选择表格)
- [类型3：带操作列表格](#类型3带操作列表格) ⭐⭐⭐ 最常用
  - [增强特性：固定操作列](#增强特性固定操作列)
  - [增强特性：列排序](#增强特性列排序)

***

### 列宽与布局策略

> **核心原则**：表格列宽使用**固定 px**，配合 `table-layout: fixed`，确保列宽不受屏幕宽度影响。

#### 问题说明

`table-layout: fixed` 下若使用百分比列宽，列宽会随表格总宽度等比缩放，宽屏下每列都被拉伸，导致内容稀疏、排版失控。

#### 解决方案

改为**固定 px 列宽**后：
- 列宽不受屏幕宽度影响，保持稳定排版
- 表格总宽度固定
- 超出容器的部分由 `.table-container` 的 `overflow-x: auto` 处理（横向滚动）

#### 列宽三档规则 ⭐

> 所有列宽均受以下三档约束（复选框列除外）。

| 档位 | 值 | 说明 |
|------|-----|------|
| **最小列宽** | `48px` | 任何列不得低于此值（复选框列除外） |
| **默认列宽** | 自适应 | 单列前后各保留 `12px` 固定间距，即 `12 + 字段宽度 + 12 = 列宽` |
| **最大列宽** | `540px` | 超出此值截断显示「…」，鼠标进入（hover）显示全部文字 |

**溢出交互**：单元格内容超出列宽时，显示省略号「…」；鼠标进入该单元格时显示完整文字（通过 `title` 属性或自定义 tooltip 实现）。

**手动调整**：允许用户手动拖拽调整列宽，调整范围仍受最小/最大列宽约束（48px ~ 540px）。

#### 固定列宽项标准 ⭐

> **性质**：这是**标准**，不是示例。当表格中识别到以下列类型时，必须按此固定列宽设置；表格中没有该列则不适用。
>
> **宽屏分配**：在宽屏下以此基准分配列宽即可。

| 列类型 | 固定列宽 | 对齐方式 | 溢出处理 |
|--------|---------|---------|---------|
| 序号 | `48px` | 居中 | 省略「…」+ hover 显示全部 |
| 姓名 | `84px` | 居中 | 省略「…」+ hover 显示全部 |
| 手机号码 | `104px` | 居中 | 省略「…」+ hover 显示全部 |
| 身份证 | `154px` | 居中 | 省略「…」+ hover 显示全部 |
| 日期时间 | `154px` | 居中 | 省略「…」+ hover 显示全部 |
| 日期 | `98px` | 居中 | 省略「…」+ hover 显示全部 |
| 国内电话号码 | `138px` | 居中 | 省略「…」+ hover 显示全部 |
| 中国邮政编码 | `136px` | 居中 | 省略「…」+ hover 显示全部 |

**规则**：
- 所有固定列宽项均为**居中对齐**（`text-align: center`）
- 内容超出固定列宽时省略展示，鼠标进入显示全部文字
- 固定列宽项优先级高于默认列宽和参考列宽

#### 示例代码

```css
/* ====== 列宽布局策略 ====== */
.data-table {
  width: 100%;
  table-layout: fixed;                            /* ⭐ 固定布局 */
  border-collapse: collapse;
  font-size: var(--font-size-body);               /* 12px */
  background-color: var(--color-bg-card);         /* #FFFFFF */
  margin: 0;
}

/* 列宽使用固定 px，不使用百分比 */
.data-table th,
.data-table td {
  /* 具体列宽在 HTML 的 th style 中按 px 指定 */
  /* 固定列宽项见上方「固定列宽项标准」表格 */
  /* 示例：<th style="width:48px;text-align:center"> 序号 */
  /* 示例：<th style="width:154px;text-align:center"> 身份证 */
  /* 示例：<th style="min-width:150px"> 产品名称（非固定项，参考列宽）*/
  /* 列宽范围：48px（最小）~ 540px（最大）*/
}
```

> ⚠️ **注意**：使用固定 px 列宽时，所有列宽之和应等于表格总宽度，避免出现剩余空间自动分配导致的不可预期拉伸。

***

### 类型1：基础默认表格

**定义**: 纯数据展示，无交互功能

#### 完整HTML结构

```html
<div class="table-container">
  <table class="data-table table-basic">
    <thead>
      <tr>
        <th style="width:60px;text-align:center">序号</th>
        <th style="min-width:150px">产品名称</th>
        <th style="width:140px">创建时间</th>
        <th style="width:140px;text-align:right">单价（元）</th>  <!-- 金额右对齐 -->
        <th style="width:100px;text-align:center">状态</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="text-align:center">1</td>
        <td>智能手表 Pro Max</td>
        <td>2024-01-15 14:30</td>
        <td style="text-align:right">¥2,999.00</td>           <!-- 金额右对齐 -->
        <td style="text-align:center"><span class="tag tag-success">在售</span></td>
      </tr>
      <tr>
        <td style="text-align:center">2</td>
        <td>无线蓝牙耳机</td>
        <td>2024-01-16 09:20</td>
        <td style="text-align:right">¥599.00</td>
        <td style="text-align:center"><span class="tag tag-warning">缺货</span></td>
      </tr>
    </tbody>
  </table>
</div>
```

#### 完整CSS代码

```css
/* ====== 基础默认表格样式 ====== */

/* 表格外层容器 */
.table-container {
  background-color: var(--color-bg-card);         /* #FFFFFF */
  border-radius: var(--radius-r2);                /* 4px */
  width: 100%;
  max-width: 100%;
  overflow-x: auto;                               /* 小屏允许横向滚动 */
  overflow-y: visible;
}

/* 数据表格本身 */
.data-table {
  width: 100%;
  table-layout: fixed;                            /* ⭐ 固定布局（见列宽与布局策略）*/
  border-collapse: collapse;
  font-size: var(--font-size-body);               /* 12px */
  background-color: var(--color-bg-card);         /* #FFFFFF */
  margin: 0;
}

/* 表头单元格 */
.data-table th {
  padding: 10px 12px;
  text-align: left;
  font-weight: var(--font-weight-semibold);       /* 600 */
  color: var(--color-text-primary);               /* #141b24 */
  font-size: var(--font-size-body);               /* 12px */
  line-height: var(--line-height-body);           /* 16px */
  background-color: var(--color-bg-header);       /* #F4F7F9 */
  height: var(--table-header-height);             /* 36px */
  border-right: 1px solid var(--color-bg-divider); /* 垂直分割线 */
  border-bottom: none;                            /* 无水平分割线 */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 540px;                               /* ⭐ 最大列宽 540px（见列宽三档规则）*/
}

/* 数据单元格 */
.data-table td {
  padding: 10px 12px;
  color: var(--color-text-primary);               /* #141b24 */
  vertical-align: middle;
  height: var(--table-row-height);                /* 36px */
  border-right: none;                             /* 无垂直分割线 */
  border-bottom: 1px solid var(--color-bg-divider); /* 水平分割线 */
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 540px;                               /* ⭐ 最大列宽 540px（见列宽三档规则）*/
}

/* ⭐ 溢出交互：鼠标进入显示全部文字 */
/* 实现方式1：原生 title 属性（最简）*/
/* <td title="完整内容">截断内容…</td> */
/* 实现方式2：自定义 tooltip（样式可控）*/
.data-table td:hover {
  position: relative;
}
/* tooltip 交互逻辑详见页面 JS 实现 */

/* 行悬停效果 */
.data-table tr:hover {
  background-color: var(--color-bg-hover);        /* #EDF3FA */
}
```

***

### 类型2：可选择表格

**定义**: 复选框选择 + 批量操作（无固定背景高亮，保留hover交互）

> ⚠️ **优先级冲突说明**：
>
> 基础表格的 `.data-table th` / `.data-table td` 优先级为 **0-1-1**，会覆盖低优先级选择器的 `padding`、`text-align`、`max-width` 等属性。
> 因此复选框列必须使用 `.data-table .col-checkbox`（优先级 **0-2-0**），确保以下属性不被基础表格样式覆盖：
>
> | 属性 | 基础表格 th/td 值 | 复选框列值 | 说明 |
> |------|-------------------|-----------|------|
> | `padding` | `10px 12px` | `10px 8px` | 复选框列左右间距更窄 |
> | `text-align` | `left` | `center` | 复选框列居中对齐 |
> | `max-width` | `540px` | `40px` | 复选框列宽固定，不受最大列宽限制 |
>
> **规则**：所有特殊列（复选框列、序号列等）若需覆盖基础 th/td 样式，选择器必须以 `.data-table` 为前缀，确保优先级 ≥ 0-2-0。

#### 完整HTML结构

```html
<div class="selectable-table-container">
  <!-- 批量操作栏：始终显示 -->
  <div class="batch-actions-bar">
    <div class="batch-info">
      已选择 <span class="count">0</span> 项
    </div>
    <div class="batch-buttons">
      <button class="btn-primary" disabled>批量删除</button>
      <button class="btn-secondary" disabled>批量导出</button>
      <button class="btn-secondary" disabled>批量启用</button>
    </div>
  </div>

  <!-- 表格本体 -->
  <div class="table-container">
    <table class="data-table table-selectable">
      <thead>
        <tr>
          <th class="col-checkbox" style="width:40px;text-align:center;padding:10px 8px">
            <input type="checkbox" id="select-all">
          </th>
          <th style="min-width:150px">产品名称</th>
          <th style="width:140px">创建时间</th>
          <th style="width:100px;text-align:center">状态</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="text-align:center;padding:10px 8px">
            <input type="checkbox" class="row-select">
          </td>
          <td>智能手表 Pro Max</td>
          <td>2024-01-15 14:30</td>
          <td style="text-align:center"><span class="tag tag-success">在售</span></td>
        </tr>
        <tr class="selected">
          <td style="text-align:center;padding:10px 8px;border-left:2px solid #3685F2">
            <input type="checkbox" class="row-select" checked>
          </td>
          <td>无线蓝牙耳机</td>
          <td>2024-01-16 09:20</td>
          <td style="text-align:center"><span class="tag tag-success">在售</span></td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
```

#### 完整CSS代码

```css
/* ====== 可选择表格样式 ====== */

/* 批量操作栏（始终显示）*/
.batch-actions-bar {
  display: flex;                                  /* 始终可见 */
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  margin-bottom: 12px;
  /* 无背景色 - 透明/融入页面 */
  border-radius: var(--radius-r2);                /* 4px */
}

.batch-info {
  font-size: var(--font-size-body);               /* 12px */
  color: var(--color-text-secondary);             /* #7C8493 */
}

.batch-info .count {
  color: var(--color-primary);                    /* #3685F2 */
  font-weight: var(--font-weight-semibold);       /* 600 */
}

.batch-buttons {
  display: flex;
  gap: 8px;
}

/* 按钮禁用态（未选中时）*/
.batch-buttons button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

/* 按钮启用态（选中后）*/
.batch-buttons button:not(:disabled) {
  cursor: pointer;
  opacity: 1;
}

/* 复选框列（⭐ 优先级 0-2-0，需高于 .data-table th/td 的 0-1-1）*/
.data-table .col-checkbox,
.data-table .table-selectable td:first-child {
  width: 40px;
  max-width: 40px;                                /* ⭐ 与 width 一致，防止被 th/td 的 max-width:540px 覆盖 */
  text-align: center;
  padding: 10px 8px;
}

/* 复选框样式详见 [checkboxes.md](checkboxes.md)，表格仅保留列样式 `.col-checkbox` */

/* 选中行状态 */
/* 无固定背景高亮，但保留hover交互效果 */
tr.selected td { background-color: transparent !important; }   /* 默认透明 */
tr.selected td:first-child {
  border-left: none;                              /* 删除左侧蓝色边框 */
}
/* 选中行也响应hover交互 */
tr.selected:hover td { background-color: var(--color-bg-hover) !important; }
```

***

### 类型3：带操作列表格 ⭐⭐⭐ **（最常用）**

**定义**: 包含操作按钮的标准CRUD表格

> **实施修正（基于 DESIGN.md §4.3.4 对齐）**：
>
> | 差异项    | 修正前            | 修正后（符合 DESIGN.md）    | 规则来源             |
> | ------ | -------------- | -------------------- | ---------------- |
> | 按钮形式   | 图标 + 文字混用      | **纯文字**（图标与文字二选一）    | DESIGN.md 规则1 🚫 |
> | 对齐方向   | 右对齐 `flex-end` | **左对齐** `flex-start` | DESIGN.md 规则4    |
> | 删除按钮颜色 | 危险红 `#FF4D5D`  | **统一主题蓝** `#3685F2`（已删除 .link-btn-danger 类）| 设计决策 ✅ |
> | 列宽     | 200-220px      | 120-160px（纯文字更窄）     | 适配调整             |

#### 操作列展示规则

> **核心规则**：
> - 操作总数 **≤ 3**：全部用文字按钮正常展示，无需"更多"
> - 操作总数 **> 3**：前 **2** 个操作用文字按钮展示，第 **3** 个位置放"更多"图标按钮，第 3 个及以后的所有操作收进更多下拉菜单

| 操作总数 | 展示方式 | 示意 |
|---------|---------|------|
| 1~3 个 | 全部文字按钮 | `[编辑] [查看] [删除]` |
| >3 个 | 前2个文字按钮 + 更多图标 | `[编辑] [查看] [更多图标 ▾]` → 下拉：删除/复制/导出... |

#### 场景A：操作总数 ≤ 3（全部正常展示）

```html
<td class="action-col">
  <div class="action-links">
    <button class="link-btn">编辑</button>
    <button class="link-btn">查看</button>
    <button class="link-btn">删除</button>
  </div>
</td>
```

#### 场景B：操作总数 > 3（前2个 + 更多图标）

> **规则**：当操作总数超过 3 个时，**前 2 个操作**用文字按钮正常显示，**第 3 个位置**放"更多"图标按钮，第 3 个及以后的所有操作收进更多下拉菜单。

```html
<td class="action-col">
  <div class="action-links">
    <button class="link-btn">编辑</button>
    <button class="link-btn">查看</button>
    <!-- ✅ "更多"按钮：第3个位置，用图标库 #icon-more -->
    <div class="more-action-wrap">
      <button class="more-action-btn" title="更多操作" onclick="toggleActionDropdown(event, 'row-id')">
        <svg class="icon"><use href="#icon-more"></use></svg>
      </button>
      <div class="action-dropdown" id="dropdown-row-id">
        <button class="action-dropdown-item">删除</button>
        <button class="action-dropdown-item">复制</button>
        <button class="action-dropdown-item">导出</button>
      </div>
    </div>
  </div>
</td>
```

> ⚠️ **HTML 注意**：`<button>` 内不能嵌套 `<button>`，"更多"按钮和下拉菜单必须用 `<div class="more-action-wrap">` 容器包裹（`position: relative`），下拉菜单作为容器的子元素绝对定位。

**JS 逻辑（动态判断）**:

```javascript
var ROW_ACTIONS = [
  { name: '编辑', handler: 'handleEdit' },
  { name: '查看', handler: 'handleView' },
  { name: '删除', handler: 'handleDelete' },
  { name: '复制', handler: 'handleCopy' },
  { name: '导出', handler: 'handleExportRow' }
];
var ACTION_THRESHOLD = 3;                           // ⭐ 阈值：>3 时触发更多

function renderActionLinks(id) {
  var html = '<div class="action-links">';
  if (ROW_ACTIONS.length <= ACTION_THRESHOLD) {
    // ≤ 3：全部文字按钮显示
    ROW_ACTIONS.forEach(function(act) {
      html += '<button class="link-btn" onclick="' + act.handler + '(\'' + id + '\')">' + act.name + '</button>';
    });
  } else {
    // > 3：前2个文字按钮 + 更多图标（第3个起收进下拉菜单）
    for (var i = 0; i < 2; i++) {
      html += '<button class="link-btn" onclick="' + ROW_ACTIONS[i].handler + '(\'' + id + '\')">' + ROW_ACTIONS[i].name + '</button>';
    }
    html += '<div class="more-action-wrap">' +
      '<button class="more-action-btn" title="更多操作" onclick="toggleActionDropdown(event, \'' + id + '\')">' +
        '<svg class="icon"><use href="#icon-more"></use></svg>' +
      '</button>' +
      '<div class="action-dropdown" id="dropdown-' + id + '">';
    for (var j = 2; j < ROW_ACTIONS.length; j++) {
      html += '<button class="action-dropdown-item" onclick="' + ROW_ACTIONS[j].handler + '(\'' + id + '\'); closeAllDropdowns()">' + ROW_ACTIONS[j].name + '</button>';
    }
    html += '</div></div>';
  }
  html += '</div>';
  return html;
}
```

#### 完整CSS代码（对齐 DESIGN.md §4.3.4 三态交互）

```css
/* ====== 带操作列表格样式 ====== */

/* 操作列单元格 */
.action-col {
  width: 13%;
  min-width: 120px;                               /* padding:0 后更窄 */
  max-width: 160px;
}

/* 操作按钮组容器 ⭐ 左对齐！（DESIGN.md 规则4）*/
.action-links {
  display: flex;
  align-items: center;
  justify-content: flex-start;                   /* ⬅️ 左对齐！*/
  gap: 12px;                                    /* ⭐ DESIGN.md：间距12px */
}

/* ✅ 操作按钮 - 纯文字（DESIGN.md 规则1 + 样式规范 L652-L666）*/
.link-btn {
  display: inline-flex;
  align-items: center;
  border: none;
  background: none;
  color: var(--color-primary);                   /* ⭐ 默认态：主色-1 #3685F2 */
  font-size: 12px;
  font-weight: 400;
  padding: 0;                                    /* ⭐ DESIGN.md：无内边距！*/
  margin: 0;
  cursor: pointer;
  border-radius: 2px;                            /* R1 */
  transition: color var(--transition-fast);      /* 仅颜色过渡（无背景变化）*/
  white-space: nowrap;
  line-height: 20px;
}

/* ⭐ Hover 态：主色-2 #5E9DF5（无背景色！仅变色）DESIGN.md L656*/
.link-btn:hover {
  color: var(--color-primary-hover);             /* #5E9DF5 */
}

/* ⭐ Active/点击态：主色-3 #2364CC（DESIGN.md 三态）L658*/
.link-btn:active {
  color: var(--color-primary-active);            /* #2364CC */
}

/* "更多"按钮（DESIGN.md 规则2：必须是图标）*/
.more-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  padding: 4px;
  cursor: pointer;
  border-radius: 2px;
  transition: all 0.15s ease-in-out;
}

.more-action-btn svg {
  width: 16px;
  height: 16px;
  color: var(--color-primary);                    /* #3685F2 主题蓝 */
}
```

/* 下拉菜单 */
.dropdown-menu {
position: absolute;
right: 0;
top: 100%;
margin-top: 4px;
background-color: var(--color-bg-card);        /* #FFFFFF */
border: 1px solid var(--color-bg-border);      /* #D2D7E1 */
border-radius: var(--radius-r2);              /* 4px */
box-shadow: var(--shadow-s2);                  /* S2阴影 */
min-width: 120px;
padding: 4px 0;
z-index: 1000;
}

.dropdown-item {
display: block;
width: 100%;
padding: 8px 16px;
background: none;
border: none;
color: var(--color-text-primary);              /* #141b24 */
font-size: var(--font-size-body);              /* 12px */
text-align: left;
cursor: pointer;
transition: all var(--transition-fast);
}

.dropdown-item:hover {
background-color: var(--color-bg-hover);       /* #EDF3FA */
color: var(--color-primary);                   /* #3685F2 */
}

````

---

### 增强特性：固定操作列

> **定义**: 当表格内容无法在一屏内完整显示时，**操作列固定展示**（作为增强特性）

#### 触发条件
- 表格宽度超出容器（列数超过10-12列）
- 需要始终显示操作按钮

#### 完整HTML结构

```html
<!-- 固定操作列表格容器（必须限制宽度触发滚动）-->
<div class="table-fixed-container">
  <table class="data-table table-fixed">
    <thead>
      <tr>
        <th class="sticky-left" style="width:40px;text-align:center">
          <input type="checkbox">
        </th>
        <th style="min-width:150px">产品名称</th>
        <th style="width:120px">分类</th>
        <th style="width:100px">库存</th>
        <th style="width:120px;text-align:right">单价</th>
        <th style="width:100px;text-align:center">状态</th>
        <th style="width:140px">创建时间</th>
        <th style="width:200px">备注说明</th>
        <th class="sticky-right action-column" style="min-width:180px">操作</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="sticky-left" style="text-align:center">
          <input type="checkbox">
        </td>
        <td>智能手表 Pro Max</td>
        <td>数码电子</td>
        <td style="text-align:center">156</td>
        <td style="text-align:right">¥2,999.00</td>
        <td style="text-align:center"><span class="tag tag-success">在售</span></td>
        <td>2024-01-15 14:30</td>
        <td>高端旗舰智能穿戴设备</td>
        <td class="sticky-right action-column" style="padding-left:12px">
          <div class="action-links">
            <button class="link-btn-text">编辑</button>
            <button class="link-btn-text">查看</button>
          </div>
        </td>
      </tr>
    </tbody>
  </table>
</div>
````

#### 完整CSS代码

```css
/* ====== 固定操作列表格样式 =====
 * 作为带操作列表格的增强特性
 */

/* 表格容器（⭐ 必须限制宽度才能触发固定效果）*/
.table-fixed-container {
  overflow-x: auto;
  overflow-y: visible;
  max-width: 100%;
  width: 900px;  /* 强制限制宽度，确保出现横向滚动 */
}

/* 左侧固定列（如复选框、序号）- 强制背景色 + S2规范阴影*/
.sticky-left {
  position: sticky;
  left: 0;
  z-index: 10;
  background-color: #FFFFFF !important;          /* ⭐ 数据行强制白色 */
  box-shadow: var(--shadow-s2);                /* S2规范阴影 */
}

/* 右侧固定列（操作列）- 强制背景色 + S2规范阴影*/
.sticky-right {
  position: sticky;
  right: 0;
  z-index: 10;
  background-color: #FFFFFF !important;          /* ⭐ 数据行强制白色 */
  box-shadow: var(--shadow-s2);                /* S2规范阴影 */
}

/* 表头固定列 - 强制表头背景色 */
thead th.sticky-left,
thead th.sticky-right {
  background-color: #F4F7F9 !important;         /* ⭐ 表头强制灰色 */
}

/* ⭐ 关键修复：固定列所在行hover时，整行显示背景色 */
tbody tr:hover td.sticky-left,
tbody tr:hover td.sticky-right {
  background-color: var(--color-bg-hover) !important;  /* hover背景联动 */
}
```
***

### 增强特性：列排序

> **定义**: 表头列支持点击排序（升序/降序），作为表格增强特性，可叠加在任意基础表格类型上

#### 排序状态说明

| 状态 | 类名 | 图标表现 | 说明 |
|------|------|---------|------|
| **默认（未排序）** | 无 | 上下箭头均为次要灰色 `--color-text-secondary` | 初始状态或非当前排序列 |
| **升序** | `.asc` | 上箭头变为主色 `--color-primary`，下箭头保持灰色 | 点击后升序排列 |
| **降序** | `.desc` | 下箭头变为主色 `--color-primary`，上箭头保持灰色 | 再次点击切换为降序 |

#### 交互规则

> - 点击未排序列 → 默认升序（`.asc`）
> - 再次点击同一列 → 切换为降序（`.desc`）
> - 再次点击 → 切回升序（`.asc`），循环往复
> - 点击新列 → 清除其他列排序状态，新列默认升序
> - 同一时间只有一列处于排序状态
> - 页面加载时可设置默认排序列

#### 完整HTML结构

```html
<!-- 基础排序列头 -->
<th>
  <span class="sortable">
    <span class="sortable-text">列名称</span>
    <span class="sort-icon">
      <span class="arrow-up"></span>
      <span class="arrow-down"></span>
    </span>
  </span>
</th>

<!-- 带副标题的排序列头（如"得分（实际值）"）-->
<th>
  <span class="sortable">
    <span class="sortable-text">
      严重缺陷占比
      <span class="indicator-desc">得分（实际值）</span>
    </span>
    <span class="sort-icon">
      <span class="arrow-up"></span>
      <span class="arrow-down"></span>
    </span>
  </span>
</th>

<!-- 升序状态：添加 .asc 类 -->
<th>
  <span class="sortable asc">
    <span class="sortable-text">排名</span>
    <span class="sort-icon">
      <span class="arrow-up"></span>
      <span class="arrow-down"></span>
    </span>
  </span>
</th>

<!-- 降序状态：添加 .desc 类 -->
<th>
  <span class="sortable desc">
    <span class="sortable-text">综合得分</span>
    <span class="sort-icon">
      <span class="arrow-up"></span>
      <span class="arrow-down"></span>
    </span>
  </span>
</th>
```

#### 完整CSS代码

```css
/* ====== 列排序样式 ====== */

/* 可排序表头容器 */
.sortable {
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  max-width: 100%;
  box-sizing: border-box;
}

/* 排序列文字区域（支持主标题+副标题纵向排列）*/
.sortable-text {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  flex: 0 0 auto;
  min-width: 0;
}

/* 排序图标容器（上下双箭头纵向排列）*/
.sort-icon {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 10px;
  height: auto;
  min-height: 24px;
  gap: 3px;
  flex-shrink: 0;
}

/* 上下箭头：CSS border 三角形（零图片/SVG依赖）*/
.sort-icon .arrow-up,
.sort-icon .arrow-down {
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  transition: all 0.2s ease;
}

/* 上箭头：底部边框形成向上三角 */
.sort-icon .arrow-up {
  border-bottom: 5px solid var(--color-text-secondary);    /* #7C8493 */
}

/* 下箭头：顶部边框形成向下三角 */
.sort-icon .arrow-down {
  border-top: 5px solid var(--color-text-secondary);       /* #7C8493 */
}

/* 副标题描述（如"得分（实际值）"）*/
.indicator-desc {
  font-size: var(--font-size-xs);                          /* 11px */
  color: var(--color-text-tertiary);                       /* #B9BFCB */
  font-weight: normal;
  margin-left: 2px;
  white-space: nowrap;
}

/* 升序状态：上箭头高亮为主色 */
.sortable.asc .sort-icon .arrow-up {
  border-bottom-color: var(--color-primary);              /* #3685F2 */
}

/* 降序状态：下箭头高亮为主色 */
.sortable.desc .sort-icon .arrow-down {
  border-top-color: var(--color-primary);                 /* #3685F2 */
}
```

#### JS 交互逻辑

```javascript
// 排序状态变量
var currentSortColumn = -1;
var currentSortDirection = 'asc';

// 获取列索引
function getColumnIndex(thElement) {
  return Array.from(thElement.parentElement.children).indexOf(thElement);
}

// 执行排序（数值排序）
function sortTable(columnIndex, direction) {
  var tbody = document.querySelector('tbody');
  if (!tbody) return;
  var rows = Array.from(tbody.querySelectorAll('tr'));
  rows.sort(function(rowA, rowB) {
    var cellA = rowA.cells[columnIndex].textContent.trim();
    var cellB = rowB.cells[columnIndex].textContent.trim();
    var numA = parseFloat(cellA.replace(/[^\d.\-+]/g, '')) || 0;
    var numB = parseFloat(cellB.replace(/[^\d.\-+]/g, '')) || 0;
    if (direction === 'asc') { return numA - numB; }
    else { return numB - numA; }
  });
  rows.forEach(function(row) { tbody.appendChild(row); });
}

// 绑定排序点击事件
document.querySelectorAll('.sortable').forEach(function(sortableEl) {
  sortableEl.addEventListener('click', function() {
    var th = this.closest('th');
    var columnIndex = getColumnIndex(th);
    if (currentSortColumn === columnIndex) {
      currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      currentSortColumn = columnIndex;
      currentSortDirection = 'asc';
    }
    document.querySelectorAll('.sortable').forEach(function(el) {
      el.classList.remove('asc', 'desc');
    });
    this.classList.add(currentSortDirection);
    sortTable(columnIndex, currentSortDirection);
  });
});

// 默认排序初始化（可选：页面加载后按指定列降序）
(function initDefaultSort() {
  var defaultColumnIndex = 3;
  var defaultDirection = 'desc';
  currentSortColumn = defaultColumnIndex;
  currentSortDirection = defaultDirection;
  var headerRow = document.querySelector('thead tr');
  if (headerRow && headerRow.children[defaultColumnIndex]) {
    var targetTh = headerRow.children[defaultColumnIndex];
    var sortableEl = targetTh.querySelector('.sortable');
    if (sortableEl) sortableEl.classList.add(defaultDirection);
  }
  sortTable(defaultColumnIndex, defaultDirection);
})();
```

#### Design Token 映射

| 属性 | Token | 值 | 用途 |
|------|-------|-----|------|
| 默认箭头颜色 | `--color-text-secondary` | `#7C8493` | 未排序/非激活箭头 |
| 激活箭头颜色 | `--color-primary` | `#3685F2` | 当前排序列的激活箭头 |
| 副标题颜色 | `--color-text-tertiary` | `#B9BFCB` | 列名下方的辅助说明文字 |
| 副标题字号 | `--font-size-xs` | `11px` | 副标题文字大小 |
| 过渡动画 | `0.2s ease` | — | 箭头颜色切换过渡 |

#### 核心特点

1. **CSS border 三角形**：零图片/SVG 依赖，箭头尺寸 `4px×5px`（底4px高5px）
2. **双箭头常显**：上下箭头始终可见，通过颜色区分激活状态（主色 vs 次要灰）
3. **副标题可选**：`.indicator-desc` 用于"得分（实际值）"等辅助说明
4. **单列排序**：同一时间只有一列处于排序状态，点击新列自动清除旧列状态

***
