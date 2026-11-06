# 查询栏 Query Bar

> 版本: v4.10.0 | 来源: components.md | 最后更新: 2026-06-02

> 📌 **重要提示**: 本文档中的所有 CSS 变量（如 `var(--color-bg-border)`、`var(--radius-r2)` 等）均定义在 `design-tokens.css` 中，使用时需确保正确引入该文件。

## 查询栏 Query Bar

### 定位

查询栏是列表页顶部的筛选条件区域，用于快速过滤数据。它由**查询项**（标签+输入控件）和**操作按钮区**组成。

### 核心规范（⭐ 用户澄清8要点）

#### 1. 背景色：强制白色

```css
.query-bar {
  background-color: #FFFFFF;        /* ⚠️ 禁止使用 #F4F7F9 或变量 */
}
```

#### 2. 标签：固定宽度 6 个中文字符

```css
.query-label {
  width: 72px;                      /* 12px × 6 = 72px */
  min-width: 72px;                  /* 防止 flex 收缩 */
  text-align: right;                /* 右对齐 */
  white-space: nowrap;              /* 禁止换行 */
}
```

#### 3. 输入控件：复用表单输入框标准规范

查询栏中的**文本输入框**和**下拉选择器**必须完全遵循 [表单输入框](./form-inputs.md) 的五态交互规范：

| 属性       | 文本输入框               | 下拉选择器                                      | 差异说明                  |
| -------- | ------------------- | ------------------------------------------ | --------------------- |
| 边框       | `1px solid #D2D7E1` | `1px solid #D2D7E1`                        | 无差异                   |
| 圆角       | `4px`               | `4px`                                      | 无差异                   |
| 内边距      | `6px 8px`           | `6px 8px`                                  | 无差异                   |
| 高度       | `28px`              | `28px`                                     | 无差异                   |
| 字体       | `12px / #141b24`    | `12px / #141b24`                           | 无差异                   |
| Hover 边框 | `#5E9DF5`           | `#5E9DF5`                                  | 无差异                   |
| Focus 效果 | `#2364CC + 外发光环`    | `#2364CC + 外发光环`                           | 无差异                   |
| 特殊处理     | -                   | `appearance: none` + `padding-right: 28px` | 为 chevron-down 箭头预留空间 |

**CSS 实现（统一选择器）**:

```css
/* ⭐ 输入框和选择器共享相同的基础样式（复用表单输入框规范）*/
.query-input,
.query-select {
  flex: 1;                                   /* 自适应宽度：填满列内剩余空间 */
  min-width: 0;                              /* 防止内容撑破 flex 容器 */
  height: 28px;
  border: 1px solid var(--color-bg-border);      /* #D2D7E1 */
  border-radius: var(--radius-r2);               /* 4px */
  padding: 6px 8px;                               /* 表单输入框标准内边距 */
  font-size: 12px;
  color: #141b24;                                 /* 文字1-1 */
  background-color: var(--color-bg-card);         /* #FFFFFF */
  outline: none;
  transition: all var(--transition-fast);
  box-sizing: border-box;
}

/* 选择器特殊处理：隐藏原生箭头 + 预留右侧空间 */
.query-select {
  appearance: none;
  -webkit-appearance: none;
  padding-right: 28px;                            /* 为内联 SVG 箭头预留 */
}

/* 选择器下拉箭头：内联 SVG chevron-down（v4.6.0 规范）*/
.query-select-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
}

.query-select-arrow {
  position: absolute;
  right: 8px;
  pointer-events: none;
  width: 12px;
  height: 12px;
  color: #B9BFCB;                                  /* 文字-3 */
}
```

#### 4. 布局模式：2 种列数 + 多行扩展（⭐ 列数包含按钮区）

> **关键规则**：以下所有模式中的"N列"均包含**操作按钮区**作为独立的一列。
>
> **重要约束**：查询栏只提供 **3 列或 4 列** 两种布局，默认使用 **4 列**。

##### 模式 A：3 列 — 2 查询条件 + 1 按钮区

```
┌───────────────────────────────────────────────────────────┐
│ [标签] [输入框]  [标签] [选择器]            [重置] [查询] │
│  (列1)          (列2)                 (按钮区列3)        │
└───────────────────────────────────────────────────────────┘
适用场景：简洁筛选（≤2个条件）
```

##### ⭐ 模式 B：4 列（默认推荐）— 3 查询条件 + 1 按钮区

```
┌───────────────────────────────────────────────────────────────┐
│ [标签] [输入]  [标签] [选择]  [标签] [输入]     [重置] [查询]   │
│  (列1)       (列2)       (列3)          (按钮区列4)           │
└───────────────────────────────────────────────────────────────┘
适用场景：常规筛选（3个条件），当前 list.html 采用此模式 ✅
```

##### 多行布局（通用规则，适用于 3 列和 4 列）

当查询条件超出单行容量时，查询栏自动换行。多行布局遵循以下通用规则：

**通用规则**：
- 换行前提：上一行查询条件已填满（3列模式=3个，4列模式=4个），才会换至下一行
- 使用 `.query-row` 显式分行，每个 `.query-row` 独占一行
- 每行子元素数量必须一致（3列模式=3个，4列模式=4个）
- 按钮区在最后一个 `.query-row` 的末列
- 末行结构：查询条件 + 占位补齐至(列数-1)个 + 按钮区1个 = 列数；用 `<div class="query-item" style="visibility:hidden"></div>` 占位，禁止留空或减少列数

**3 列多行示例**（4 查询条件 + 1 按钮区，2行）：

```
┌───────────────────────────────────────────────────────────┐
│ [标签] [输入]  [标签] [选择]  [标签] [输入]               │
│  (列1)          (列2)          (列3)                     │
├───────────────────────────────────────────────────────────┤
│ [标签] [输入]     [占位]            [重置] [查询]         │
│  (列1)          (列2-占位)        (按钮区列3)            │
└───────────────────────────────────────────────────────────┘
适用场景：4个条件（3列模式），第1行填满3个条件，按钮区在末行第3列
```

**4 列多行示例**（6 查询条件 + 1 按钮区，2行）：

```
┌───────────────────────────────────────────────────────────────┐
│ [标签] [输入]  [标签] [输入]  [标签] [输入]  [标签] [输入]      │
│  (列1)       (列2)       (列3)       (列4)                   │
├───────────────────────────────────────────────────────────────┤
│ [标签] [选择]  [标签] [输入]     [占位]    [重置] [查询]      │
│  (列1)       (列2)       (列3-占位)  (按钮区列4)              │
└───────────────────────────────────────────────────────────────┘
适用场景：6个条件（4列模式），按钮区在末行第4列
```

**布局实现 CSS**:

```css
.query-bar {
  display: flex;
  flex-wrap: wrap;                   /* ⭐ 允许换行 */
  align-items: flex-start;           /* 顶部对齐 */
  gap: 16px;                         /* 查询项水平间距 */
  row-gap: 12px;                     /* ⭐ 换行间距：行与行之间 12px */
  padding: 16px;
  background-color: #FFFFFF;         /* ⭐ 白色背景 */
  border-radius: 4px;
  border-bottom: 1px solid var(--color-bg-divider);  /* ⭐ 与工具栏视觉分隔 */
  margin-bottom: 0;                  /* ⭐ 由 border-bottom 分隔，不需要 margin */
}

/* ⭐ 行容器（多行场景推荐）：显式控制每行列数，确保布局一致性 */
.query-row {
  display: flex;
  align-items: flex-start;
  gap: 16px;                         /* 查询项水平间距（同 .query-bar gap） */
  width: 100%;                       /* 占满整行 */
  flex: 1 1 100%;                    /* 确保每个 .query-row 独占一行 */
}

.query-item {
  display: flex;
  align-items: center;
  gap: 8px;                          /* 标签与输入框间距 */
  flex: 1;                           /* ⭐ 均分剩余空间，自适应宽度 */
  min-width: 0;                      /* 允许收缩 */
}

/* ⭐ 按钮区：与查询项等分空间（N列模式下占1/N），内容右对齐 */
.query-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;                                   /* ⭐ 与查询项等分空间，占比由列数决定（3列=1/3，4列=1/4）*/
  min-width: 0;
  justify-content: flex-end;                 /* ⭐ 右对齐 */
}

/* ⭐ 工具栏：查询栏下方的独立分区，必须有顶部间距 */
.toolbar {
  margin-top: 16px;                  /* ⭐ 与查询栏分隔间距 */
  padding-top: 12px;                 /* ⭐ 内顶部间距 */
}
```

**HTML 结构模板**:

```html
<!-- 查询栏（components.md §查询栏 - 单行N列模式：M查询条件 + 1按钮区）-->
<div class="query-bar">
  <!-- 第1列：查询条件 -->
  <div class="query-item">
    <label class="query-label">条件标题</label>
    <div class="query-select-wrapper">
      <select class="query-select">
        <option value="">请选择</option>
        <option value="1">选项A</option>
      </select>
      <svg class="icon query-select-arrow">
        <use href="#icon-chevron-down"></use>
      </svg>
    </div>
  </div>

  <!-- 更多查询条件... -->

  <!-- 操作按钮区（始终在查询栏末行右侧展示）-->
  <div class="query-actions">
    <button class="btn-reset" onclick="resetQuery()">重置</button>
    <button class="btn-query">
      <svg class="icon" style="color: white;">
        <use href="#icon-search"></use>
      </svg>
      查询
    </button>
  </div>
</div>
```

**HTML 结构模板（多行 — 3 列模式）**:

```html
<!-- 查询栏（3列多行模式：4查询条件 + 1按钮区，2行）-->
<div class="query-bar">
  <!-- 第1行：3个查询条件（填满整行） -->
  <div class="query-row">
    <div class="query-item">
      <label class="query-label">条件1</label>
      <input class="query-input" type="text" placeholder="请输入">
    </div>
    <div class="query-item">
      <label class="query-label">条件2</label>
      <div class="query-select-wrapper">
        <select class="query-select">
          <option value="">请选择</option>
          <option value="1">选项A</option>
        </select>
        <svg class="icon query-select-arrow">
          <use href="#icon-chevron-down"></use>
        </svg>
      </div>
    </div>
    <div class="query-item">
      <label class="query-label">条件3</label>
      <input class="query-input" type="text" placeholder="请输入">
    </div>
  </div>

  <!-- 第2行：1个查询条件 + 1个占位 + 按钮区（共3列） -->
  <div class="query-row">
    <div class="query-item">
      <label class="query-label">条件4</label>
      <input class="query-input" type="text" placeholder="请输入">
    </div>
    <!-- ⭐ 占位项：补齐至2个查询条件，保持3列对齐 -->
    <div class="query-item" style="visibility:hidden"></div>
    <!-- 操作按钮区（末行第3列） -->
    <div class="query-actions">
      <button class="btn-reset" onclick="resetQuery()">重置</button>
      <button class="btn-query">
        <svg class="icon" style="color: white;">
          <use href="#icon-search"></use>
        </svg>
        查询
      </button>
    </div>
  </div>
</div>
```

**HTML 结构模板（多行 — 4 列模式）**:

```html
<!-- 查询栏（4列多行模式：6查询条件 + 1按钮区，2行）-->
<div class="query-bar">
  <!-- 第1行：4个查询条件 -->
  <div class="query-row">
    <div class="query-item">
      <label class="query-label">条件1</label>
      <input class="query-input" type="text" placeholder="请输入">
    </div>
    <div class="query-item">
      <label class="query-label">条件2</label>
      <input class="query-input" type="text" placeholder="请输入">
    </div>
    <div class="query-item">
      <label class="query-label">条件3</label>
      <input class="query-input" type="text" placeholder="请输入">
    </div>
    <div class="query-item">
      <label class="query-label">条件4</label>
      <input class="query-input" type="text" placeholder="请输入">
    </div>
  </div>

  <!-- 第2行：2个查询条件 + 1个占位 + 按钮区（共4列） -->
  <div class="query-row">
    <div class="query-item">
      <label class="query-label">条件5</label>
      <div class="query-select-wrapper">
        <select class="query-select">
          <option value="">请选择</option>
          <option value="1">选项A</option>
        </select>
        <svg class="icon query-select-arrow">
          <use href="#icon-chevron-down"></use>
        </svg>
      </div>
    </div>
    <div class="query-item">
      <label class="query-label">条件6</label>
      <input class="query-input" type="text" placeholder="请输入">
    </div>
    <!-- ⭐ 占位项：补齐至3个查询条件，保持4列对齐 -->
    <div class="query-item" style="visibility:hidden"></div>
    <!-- 操作按钮区（末行第4列） -->
    <div class="query-actions">
      <button class="btn-reset" onclick="resetQuery()">重置</button>
      <button class="btn-query">
        <svg class="icon" style="color: white;">
          <use href="#icon-search"></use>
        </svg>
        查询
      </button>
    </div>
  </div>
</div>
```

#### 5. 换行间距：12px

当查询条件数量超出单行容量时，查询栏自动换行，**行与行之间的间距固定为 12px**。

```css
.query-bar {
  flex-wrap: wrap;                   /* ⭐ 允许换行 */
  row-gap: 12px;                     /* ⭐ 换行间距：12px（区别于水平间距 16px）*/
}
```

> **注意**：水平间距（`gap`）为 16px，垂直换行间距（`row-gap`）为 12px，两者独立设置，不可混用。

#### 6. 操作按钮位置：始终在末行右侧

操作按钮区（重置/查询）**始终在查询栏最后一行的右侧展示**，不论前方有几个查询项：

- 单行场景：查询项未填满当前行时，按钮区紧跟最后一个查询项，位于同一行右侧
- 多行场景：上一行填满后换行，按钮区在末行末列；末行查询条件不足时用占位补齐至(列数-1)个，按钮区占末列
- 按钮区使用 `flex: 1` + `justify-content: flex-end` 确保内容右对齐

```css
/* ⭐ 按钮区：等分空间 + 右对齐，确保始终在末行右侧 */
.query-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;                                   /* 与查询项等分空间 */
  min-width: 0;
  justify-content: flex-end;                 /* ⭐ 内容右对齐 */
}
```

#### 7. 布局一致性：全行统一列数

选择一种布局模式后，**整个查询栏所有行必须保持相同的列数**，禁止混用不同列数布局：

| 规则 | 说明 | 示例 |
| --- | --- | --- |
| ✅ 正确 | 所有行列数一致 | 第一行 4 列，第二行也 4 列 |
| ❌ 错误 | 行间列数不一致 | 第一行 4 列，第二行 3 列 |

> **关键约束**：
> - 若选择 **4 列模式**，则每一行都必须按 4 列布局排列（满行=4个查询条件；末行=查询条件+占位补齐至3个+按钮区1个，共4列）
> - 若选择 **3 列模式**，则每一行都必须按 3 列布局排列（满行=3个查询条件；末行=查询条件+占位补齐至2个+按钮区1个，共3列）
> - 按钮区始终作为最后一列，占据末行剩余位置并右对齐
> - **多行场景**（≥2行）：必须使用 `.query-row` 显式分行，每个 `.query-row` 子元素数量必须一致（3列模式=3个，4列模式=4个）
> - **多行占位**：末行查询条件不足时，用 `<div class="query-item" style="visibility:hidden"></div>` 补齐，禁止留空或减少列数
> - **按钮区位置**：`.query-actions` 必须在最后一个 `.query-row` 内的末尾位置（3列模式=末列第3，4列模式=末列第4）

### 检查清单

| 编号   | 检查项         | 通过标准                                   | 不通过处理    |
| ---- | ----------- | -------------------------------------- | -------- |
| QB-1 | 背景色为白色      | `background-color === #FFFFFF`         | 移除灰背景引用  |
| QB-2 | 标签宽度固定 72px | `width === 72px && min-width === 72px` | 统一为 72px |
| QB-3 | 输入框/选择器样式统一 | 共享 `.query-input, .query-select`       | 合并重复规则   |
| QB-4 | 布局注释含按钮区    | 注释格式 `(N查询条件 + M按钮区)`                  | 更新注释     |
| QB-5 | 按钮区等分布局   | `.query-actions` 使用 `flex:1` 而非 `margin-left:auto`，与查询项等分空间（N列模式下占1/N），内容 `justify-content: flex-end` 右对齐 | 改为 flex:1 等分布局 |
| QB-6 | 换行间距 12px | `row-gap === 12px` 且 `flex-wrap: wrap` 已启用 | 设置 `row-gap: 12px` 并启用 `flex-wrap: wrap` |
| QB-7 | 按钮区末行右侧 | 按钮区始终在查询栏最后一行右侧展示，不论前方有几个查询项 | 确保按钮区使用 `flex:1` + `justify-content: flex-end`，位于末行 |
| QB-8 | 全行统一列数 | 整个查询栏所有行保持相同列数，禁止混用 3 列和 4 列布局 | 统一为相同列数模式 |
| QB-9 | 多行结构一致 | 多行场景（≥2行）使用 `.query-row` 分行，每个 `.query-row` 子元素数量一致（3列=3个，4列=4个），`.query-actions` 在末行末列，末行不足用占位补齐 | 增加 `.query-row` 分行 + 占位补齐 |

***
