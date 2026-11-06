# 操作按钮组规范 (Action Button Group)

> 版本: v4.3.0 | 来源: components.md | 最后更新: 2026-06-02

📌 **重要**: 所有数值必须引用 [design-tokens.css](../ASSETS/design-tokens.css) 中的 CSS 变量

---

## 📖 文档定位

**本文件专注**：操作按钮组的**业务使用规范**、HTML 结构示例、排列规则、最佳实践等。

📌 **按钮基础 CSS 样式代码**（`.btn-primary`、`.btn-secondary`、`.btn-default`、`.btn-danger`）请参阅：[**按钮样式 Buttons**](./buttons.md)

---

## 操作按钮组规范 (Action Button Group) ⭐ v4.1.0 新增

> **核心概念**：操作按钮组是位于页面工具栏的按钮集合，与表格内的**操作列**是完全不同的两个概念！
>
> **关键区别**：
>
> - **操作列**：表格行内，最多3个可见按钮，**纯图标或纯文字（默认纯文字）**，统一主题蓝色
> - **操作按钮组**：页面工具栏，最多6个可见按钮，纯文字（可选图标），按类型决定颜色

### ⚠️ 重要：操作按钮组的两种样式模式

> **根据使用场景不同，操作按钮组有两种不同的按钮组合方式**：

| 场景 | 按钮组合 | CSS类名 | 尺寸 | 适用位置 |
|------|---------|---------|------|---------|
| **列表页工具栏** | **普通按钮** | `.btn-default` | **小号** (`4px 8px`) | 页面顶部工具栏、表格上方 |
| **表单/弹窗等** | 主按钮 + **次按钮** | `.btn-primary` + `.btn-secondary` | **默认尺寸** (`6px 12px`) | 弹窗底部、表单操作区、查询栏 |

**📌 规则说明**：
- ✅ **列表页操作按钮组**：整组都使用**普通按钮（.btn-default）**样式，视觉更轻量，适合多按钮并排
- ✅ **其他位置**：使用**次按钮（.btn-secondary）**样式，有边框，视觉更重，适合独立强调
- ✅ 两种场景下的**主按钮（.btn-primary）**保持一致

### 概念定义与区别对比

#### 什么是操作按钮组？

**位置**：

- 页面顶部工具栏
- 卡片标题栏右侧
- 表格上方区域
- 弹窗底部操作区

**用途**：

- 页面级操作（新增、导出、导入等）
- 批量操作（批量删除、批量启用等）
- 全局功能入口（刷新、筛选、排序等）

#### 操作列 vs 操作按钮组完整对比表

| 特征维度          | **操作列 (Action Column)** | **操作按钮组 (Action Button Group)** |
| ------------- | ----------------------- | ------------------------------- |
| **所在位置**      | 表格数据行最右侧列               | 页面顶部/卡片标题栏/表格上方                 |
| **作用范围**      | 单行数据操作                  | 页面级或批量操作                        |
| **最大可见数**     | **3 个按钮**               | **6 个按钮**                       |
| **第 N+1 个处理** | 第4个起收纳至 `···` 图标按钮      | 第6个起收纳至 **"更多"文字按钮**            |
| **按钮样式**      | **纯图标或纯文字（默认纯文字）**               | 纯文字按钮（可选带图标）                    |
| **颜色规则**      | 统一使用主题蓝 #3685F2         | 按按钮类型决定颜色                       |
| **主按钮样式**     | 不适用（操作列不分主/次）        | 蓝色背景 #3685F2 + 白色文字             |
| **次按钮样式**     | 不适用（同上）           | 有边框（`#D2D7E1`）白色背景 + 灰色文字 #7C8493      |
| **更多按钮**      | 水平三点图标 `···`            | 文字"更多操作" + `#icon-chevron-down`（右侧），透明背景/无边框             |
| **典型场景**      | 编辑、查看、删除单条数据            | 新增、导出、导入、批量操作                   |
| **间距**        | 12px                    | **8px**         |

### 显示规则

#### 核心规则（v4.1.0）

✅ **最多 6 个可见按钮**

- 当操作项 ≤ 6 个时：全部显示为独立按钮
- 当操作项 > 6 个时：前 5 个显示为独立按钮，第 6 个起收纳至"更多"


#### 尺寸规范

| 属性       | 数值                             | 说明            |
| -------- | ------------------------------ | ------------- |
| **按钮高度** | `24px`                         | 固定高度          |
| **按钮宽度** | `60px`（带图标）或自适应（纯文字）           | 根据内容调整        |
| **图标尺寸** | `16px × 16px`                  | 统一尺寸          |
| **图标位置** | 左侧，距左边 `8px`，距顶部 `4px`         | 统一定位          |
| **文字大小** | `12px`                         | 统一字号          |
| **文字颜色** | `#7C8493`| 按类型决定         |
| **按钮间距** | **`8px`**                      | ⭐ 蓝湖标准（非12px） |
| **圆角**   | `4px`                          | 统一圆角          |

#### 显示示例

```
场景 1：≤ 6 个操作（全部显示）
┌─────────────────────────────────────────────┐
│ [新增] [导出] [导入] [打印] [刷新] [筛选] │
└─────────────────────────────────────────────┘

场景 2：> 6 个操作（第6个起收至"更多"）
┌───────────────────────────────────────────────────┐
│ [新增] [导出] [导入] [打印] [刷新] [更多] │
└───────────────────────────────────────────────────┘
                                  ↓ 点击展开下拉菜单
                                  ┌─────────────────┐
                                  │ 批量删除         │
                                  │ 批量导出         │
                                  │ 数据同步         │
                                  └─────────────────┘
```

### 按钮类型与颜色

#### 三种按钮类型定义

| 按钮类型     | CSS 类名           | 背景色             | 文字/图标色          | 边框        | 典型示例        | 使用场景        |
| -------- | ---------------- | --------------- | --------------- | --------- | ----------- | ----------- |
| **主按钮**  | `.btn-primary`   | `#3685F2` (主题蓝) | `#FFFFFF` (白色)  | 无         | 新增、创建、保存    | 所有场景通用     |
| **普通按钮**⭐ | `.btn-default`   | `#FFFFFF` (白色)  | `#7C8493` (默认灰) | **无**（无边框）| 导出、导入、打印、刷新 | **列表页工具栏**（小号尺寸）|
| **次按钮**  | `.btn-secondary` | `#FFFFFF` (白色)  | `#7C8493` (默认灰) | `#D2D7E1`  | 取消、重置、返回    | **表单/弹窗**（默认尺寸）|
| **更多按钮** | `.btn-more-text` | 透明/白色           | 根据场景判断          | 无         | 超过6个时出现     | 按需          |

#### 颜色使用原则

1. **主按钮**：每个操作按钮组**最多 1 个**
   - 用于最重要、最高频的操作
   - 始终放在按钮组最左侧
   - 可选配图标增强识别度
2. **普通按钮（列表页专用）**：
   - 用于**列表页工具栏**的次级操作
   - **无边框**，视觉更轻量
   - Hover 时背景变为主题蓝 10% 不透明度 tint
   - 使用**小号尺寸** (`padding: 4px 8px`)
3. **次按钮（表单/弹窗/查询栏专用）**：
   - 用于**表单、弹窗、查询栏等**的次要确认操作
   - **有边框** (`1px solid #D2D7E1`)，视觉更重
   - Hover 时边框和文字变为主题蓝 #5E9DF5
   - 使用**默认尺寸** (`padding: 6px 12px`)
4. **危险按钮**（可选）：
   - 使用 `.btn-danger` 样式（红色背景 #FF4D5D）
   - **每组最多 1 个**
   - 放在主按钮后面次按钮前面
   - 建议配合二次确认弹窗
5. **"更多"按钮**：
   - **文字按钮，下拉箭头图标**
   - 文字内容固定为"更多操作"
   - 颜色默认为灰色 #7C8493
   - Hover 时仅背景色变化为 `rgba(54, 133, 242, 0.10)`（主题蓝 10% 透明度），文字和图标颜色保持不变
   - Active 时仅背景色变化为 `rgba(54, 133, 242, 0.20)`（主题蓝 20% 透明度），文字和图标颜色保持不变
   - **下拉菜单选项为纯文字，不带图标**

### 代码示例

#### 完整 HTML 结构（列表页工具栏 - 使用普通按钮 .btn-default）

```html
<!-- 操作按钮组容器（列表页工具栏：全部使用小号普通按钮 .btn-default）-->
<div class="action-button-group">
  <!-- 新增按钮（列表页专用）：带图标 + 文字 -->
  <button class="btn-default btn-with-icon">
    <svg class="icon">
      <use href="#icon-plus"></use>
    </svg>
    新增
  </button>

  <!-- 普通按钮（列表页专用）：纯文字 -->
  <button class="btn-default">导出</button>

  <!-- 普通按钮（列表页专用）：带图标 + 文字 -->
  <button class="btn-default btn-with-icon">
    <svg class="icon">
      <use href="#icon-download-file"></use>
    </svg>
    导入
  </button>

  <!-- 更多普通按钮... 最多6个可见（5个独立+1个"更多"），第6个起收纳至"更多" -->
  <button class="btn-default">打印</button>
  <button class="btn-default">刷新</button>
  <button class="btn-default">筛选</button>

  <!-- 第6个起收纳至"更多"（文字+下拉箭头图标在右侧）-->
  <button class="btn-more-text btn-with-icon">
    更多操作
    <svg class="icon">
      <use href="#icon-chevron-down"></use>
    </svg>
  </button>
</div>

<!-- 下拉菜单（点击"更多"时显示）-->
<div class="dropdown-menu" id="more-dropdown" style="display: none;">
  <button class="dropdown-item">批量删除</button>
  <button class="dropdown-item">批量导出</button>
  <button class="dropdown-item">数据同步</button>
</div>
```

#### 实际应用场景示例

**场景 1：列表页工具栏**

```html
<div class="page-toolbar">
  <div class="toolbar-left">
    <h2 class="page-title">用户管理</h2>
  </div>
  <div class="toolbar-right">
    <div class="action-button-group">
      <!-- 列表页工具栏：全部使用 .btn-default（包括新增）-->
      <button class="btn-default btn-with-icon">
        <svg class="icon">
          <use href="#icon-plus"></use>
        </svg>
        新增用户
      </button>
      <button class="btn-default btn-with-icon">
        <svg class="icon">
          <use href="#icon-download-file"></use>
        </svg>
        导出
      </button>
      <button class="btn-default btn-with-icon">
        <svg class="icon">
          <use href="#icon-import"></use>
        </svg>
        导入
      </button>
      <button class="btn-default">刷新</button>
    </div>
  </div>
</div>
```

**场景 2：超过6个操作的情况**

```html
<div class="action-button-group">
  <!-- 列表页工具栏：全部使用 .btn-default（包括新增）-->
  <button class="btn-default btn-with-icon">
    <svg class="icon">
      <use href="#icon-plus"></use>
    </svg>
    新建订单
  </button>
  <button class="btn-default">审核</button>
  <button class="btn-default">导出报表</button>
  <button class="btn-default">打印</button>
  <button class="btn-default">批量发货</button>
  <!-- 前5个普通按钮可见，第6个起收纳至"更多" -->
  <button class="btn-more-text btn-with-icon" onclick="toggleDropdown()">
    更多操作
    <svg class="icon">
      <use href="#icon-chevron-down"></use>
    </svg>
  </button>
</div>

<!-- 下拉菜单（点击"更多"时显示）-->
<div class="dropdown-menu" id="more-dropdown" style="display: none;">
  <button class="dropdown-item">数据同步</button>
  <!-- 更多操作项... -->
</div>
```

**场景 3：表单/弹窗操作按钮组（使用次按钮 .btn-secondary）**

```html
<!-- 弹窗底部操作区：使用默认尺寸次按钮 -->
<div class="modal-footer">
  <div class="action-button-group">
    <button class="btn-secondary">取消</button>           <!-- 次按钮：有边框 -->
    <button class="btn-primary">保存</button>              <!-- 主按钮 -->
  </div>
</div>

<!-- 表单操作区：多个次按钮 + 主按钮 -->
<div class="form-actions">
  <div class="action-button-group">
    <button class="btn-primary">提交</button>             <!-- 主按钮 -->
    <button class="btn-secondary">重置</button>            <!-- 次按钮：有边框 -->
    <button class="btn-secondary">返回</button>           <!-- 次按钮：有边框 -->
  </div>
</div>
```

### CSS 样式

> 📌 **按钮基础样式代码**（`.btn-primary`、`.btn-secondary`、`.btn-default`）请参阅 [按钮样式 Buttons](./buttons.md)
>
> 本章节仅包含**操作按钮组特有**的容器布局和组件样式。

#### 容器样式

```css
/* ===== 操作按钮组容器 ===== */
.action-button-group {
  display: flex;
  gap: 8px;                     /* ⭐ v4.2 更新：按钮间距 8px（蓝湖标准）*/
  align-items: center;          /* 垂直居中对齐 */
  flex-wrap: nowrap;            /* 不换行 */
}

/* 工具栏布局示例 */
.page-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 0;
  border-bottom: 1px solid var(--color-bg-divider); /* #E4E7F0 */
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 16px;
}
```

#### "更多操作"按钮样式（带下拉箭头图标）

```css
/* ===== "更多操作"按钮（文字 + chevron-down 图标）===== */
.btn-more-text {
  background: none;                                 /* 透明背景 */
  border: none;                                     /* 无边框 */
  color: var(--color-text-secondary);               /* #7C8493 默认灰 */
  padding: 4px 8px;                                 /* ⭐ 小号尺寸（与 .btn-default 一致）*/
  font-size: var(--font-size-body);                 /* 12px */
  font-weight: var(--font-weight-regular);          /* 400 */
  cursor: pointer;
  border-radius: var(--radius-r2);                  /* 4px */
  transition: all var(--transition-fast);           /* 150ms ease-in-out */
  display: inline-flex;                             /* 支持图标+文字 */
  align-items: center;
  gap: 4px;                                         /* 图标与文字间距 */
  white-space: nowrap;
}

.btn-more-text:hover {
  background-color: rgba(54, 133, 242, 0.10);       /* ⭐ 与 .btn-default:hover 一致：仅背景色变化，文字/图标颜色不变 */
}

.btn-more-text:active {
  background-color: rgba(54, 133, 242, 0.20);       /* ⭐ 与 .btn-default:active 一致：仅背景色变化 */
}

/* "更多"按钮内的 chevron-down 图标 */
.btn-more-text .icon {
  width: 16px;
  height: 16px;
  color: inherit;                                   /* 继承文字颜色 */
  flex-shrink: 0;
}
```

#### 下拉菜单样式（可选）

```css
/* ===== 下拉菜单（"更多"按钮触发）===== */
.dropdown-menu {
  position: absolute;
  right: 0;
  top: 100%;
  margin-top: 4px;
  background-color: var(--color-bg-card);           /* #FFFFFF */
  border: 1px solid var(--color-bg-border);         /* #D2D7E1 */
  border-radius: var(--radius-r2);                  /* 4px */
  box-shadow: var(--shadow-s2);                     /* S2阴影 */
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
  color: var(--color-text-primary);                /* #141b24 */
  font-size: var(--font-size-body);                /* 12px */
  text-align: left;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.dropdown-item:hover {
  background-color: var(--color-bg-hover);          /* #EDF3FA */
  color: var(--color-primary);                      /* #3685F2 */
}
```

#### 图标相关样式

```css
/* ===== 图标样式（操作按钮组内）===== */
.btn-with-icon .icon {
  width: 16px;                                      /* 按钮内图标 16px */
  height: 16px;
  flex-shrink: 0;                                   /* 防止被压缩 */
  pointer-events: none;                             /* 不干扰点击 */
}

/* 主按钮内图标：白色 */
.btn-primary .icon {
  color: var(--color-text-white);                   /* #FFFFFF */
}

/* 普通按钮内图标（列表页）：继承文字颜色（灰色）*/
.btn-default .icon {
  color: inherit;                                   /* 继承 #7C8493 */
}

/* 次按钮内图标（表单/弹窗）：继承文字颜色（灰色）*/
.btn-secondary .icon {
  color: inherit;                                   /* 继承 #7C8493 */
}
```

### 使用最佳实践

#### ✅ 推荐做法

1. **列表页工具栏：全部使用 .btn-default（包括新增）**
   ```html
   <div class="action-button-group">
     <!-- 列表页：所有按钮都是 .btn-default，新增放在最前面 -->
     <button class="btn-default btn-with-icon">
       <svg class="icon">
         <use href="#icon-plus"></use>
       </svg>
       新增
     </button>
     <button class="btn-default">导出</button>   <!-- 高频操作在前 -->
     <button class="btn-default">打印</button>
     <button class="btn-default btn-with-icon">
       <svg class="icon">
         <use href="#icon-import"></use>
       </svg>
       导入
     </button>
     <button class="btn-more-text btn-with-icon">
       更多操作
       <svg class="icon">
         <use href="#icon-chevron-down"></use>
       </svg>
     </button>
   </div>
   ```
2. **表单/弹窗：使用 .btn-secondary + .btn-primary**
   ```html
   <div class="action-button-group">
     <button class="btn-secondary">取消</button>    <!-- 次按钮：有边框 -->
     <button class="btn-primary">保存</button>      <!-- 主按钮（仅表单/弹窗）-->
   </div>
   ```
3. **次按钮按重要性排列**
   ```html
   <!-- 高频操作在前 -->
   <button class="btn-default">导出</button>   <!-- 高频 -->
   <button class="btn-default">打印</button>   <!-- 中频 -->
   <button class="btn-default">归档</button>   <!-- 低频 -->
   ```
4. **危险操作单独处理（仅表单/弹窗场景）**
   ```html
   <div class="action-button-group">
     <button class="btn-primary">保存</button>
     <button class="btn-secondary">取消</button>
   </div>
   <div class="action-button-group" style="margin-left: auto;">
     <button class="btn-danger">删除</button>    <!-- 单独成行或靠右 -->
   </div>
   ```
5. **合理使用图标**
   ```html
   <!-- 普通按钮可选加图标（列表页）-->
   <button class="btn-default btn-with-icon">
     <svg class="icon">
       <use href="#icon-download-file"></use>
     </svg>
     导出
   </button>

   <!-- 纯文字也可以 -->
   <button class="btn-default">刷新</button>

   <!-- "更多"按钮的箭头图标始终在右侧 -->
   <button class="btn-more-text btn-with-icon">
     更多操作
     <svg class="icon">
       <use href="#icon-chevron-down"></use>
     </svg>
   </button>
   ```

#### ❌ 常见错误

1. **❌ 超过6个可见按钮**
   ```html
   <!-- 错误：显示了7个按钮 -->
   <div class="action-button-group">
     <button>新建</button>
     <button>编辑</button>
     <button>删除</button>
     <button>导出</button>
     <button>导入</button>
     <button>打印</button>
     <button>刷新</button>  <!-- ❌ 应该收至"更多" -->
   </div>
   ```
2. **❌ "更多"按钮缺少图标或图标位置错误**
   ```html
   <!-- 错误：缺少 chevron-down 图标 -->
   <button class="btn-more-text">更多操作</button>  <!-- ❌ 缺少下拉箭头图标 -->

   <!-- 错误：图标在文字前面 -->
   <button class="btn-more-text btn-with-icon">
     <svg class="icon">
       <use href="#icon-chevron-down"></use>
     </svg>
     更多操作
   </button>  <!-- ❌ 图标应该在文字后面 -->

   <!-- 正确：文字 + chevron-down 图标（图标在右侧）-->
   <button class="btn-more-text btn-with-icon">  <!-- ✅ -->
     更多操作
     <svg class="icon">
       <use href="#icon-chevron-down"></use>
     </svg>
   </button>
   ```
3. **❌ 多个主按钮（仅适用于表单/弹窗场景）**
   ```html
   <!-- 错误：表单中有两个主按钮 -->
   <button class="btn-primary">提交</button>
   <button class="btn-primary">保存</button>  <!-- ❌ 只能有一个主按钮 -->

   <!-- 正确（表单/弹窗场景）-->
   <button class="btn-primary">保存</button>  <!-- ✅ 唯一主按钮 -->
   <button class="btn-secondary">取消</button> <!-- ✅ 其余用次按钮 */
   ```
4. **❌ 与操作列混淆**
   ```html
   <!-- 错误：在操作按钮组中使用操作列样式 -->
   <td class="action-col">
     <div class="action-links">  <!-- ❌ 这是操作列的类名 -->
       <button class="link-btn">编辑</button>  <!-- ❌ 操作列按钮样式 -->
     </div>
   </td>

   <!-- 正确：列表页操作按钮组应该用 .btn-default（包括新增）-->
   <div class="action-button-group">  <!-- ✅ 操作按钮组容器 -->
     <button class="btn-default btn-with-icon">  <!-- ✅ 新增使用 .btn-default -->
       <svg class="icon">
         <use href="#icon-plus"></use>
       </svg>
       新增
     </button>
     <button class="btn-default">编辑</button>  <!-- ✅ 使用 .btn-default */
     <button class="btn-default btn-with-icon">
       <svg class="icon">
         <use href="#icon-export"></use>
       </svg>
       导出
     </button>
     <button class="btn-more-text btn-with-icon">
       更多操作
       <svg class="icon">
         <use href="#icon-chevron-down"></use>
       </svg>
     </button>
   </div>
   ```
