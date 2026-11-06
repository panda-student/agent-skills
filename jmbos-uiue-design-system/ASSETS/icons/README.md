# 图标库 (Icons) — 快速指南

> JMBOS UIUE Design System 图标规范 **速查手册**
>
> **版本**: v7.1.0 | 最后更新: 2026-05-29
>
> 📌 **定位**: 本文件为**快速参考指南**，提供规则速查表和场景索引。
> 📖 **完整规范**: 详细代码示例、完整颜色规范、检查清单请查阅 [icons.md](../../REFERENCES/components/icons.md)
> 🎨 **CSS样式**: 图标基础样式已内置到 [design-tokens.css v4.19.0+](../design-tokens.css)（第10章），引入该文件后自动生效，**无需手动复制CSS代码**。

## 目录结构

```
icons/
├── README.md              ← 本文件（快速指南）
├── icons-sprite.svg       ← ⭐ SVG Sprite 文件（图标库）
├── sprite-preview.html    ← ⭐ SVG Sprite 预览页面（需要本地服务器）
├── preview-offline.html   ← 离线版图标预览（双击即可打开）
├── individual/            ← 单个图标文件（SVG 源文件，仅供参考）
│   ├── edit.svg              (= 编辑)
│   ├── trash.svg             (= 删除)
│   ├── eye.svg               (= 查看)
│   ├── search.svg
│   ├── more.svg              ← ⭐ 水平三点 (···) 无需旋转！
│   ├── chevron-down.svg
│   └── ... (共 113 个)
```

---

## 核心规则速查表

图标核心规则详见 [implementation-guide.md](../../REFERENCES/implementation-guide.md) Phase 2 图标合规

---

## 重要概念区分：操作列 vs 操作按钮组

> **v4.1 更新**：这是两个完全不同的概念，使用规则也不同！

| 规范项 | **操作列 (Action Column)** | **操作按钮组 (Action Button Group)** |
|--------|---------------------------|-------------------------------------|
| **位置** | 表格**行内**最右侧 | 页面/**工具栏**（表格上方/卡片顶部） |
| **用途** | 单行数据的操作 | 页面级/批量操作 |
| **最多可见数** | **3 个** | **6 个** |
| **超出处理** | 第 4 个 → ··· 图标按钮 | 第 7 个 → "更多" **文字按钮** |
| **更多按钮类型** | **图标** (more.svg) | **文字** ("更多") |
| **默认样式** | **图标+文字** | **纯文字按钮** |
| **默认颜色** | **主题蓝 #3685F2** | **按按钮类型** |
| **主按钮图标色** | 不适用 | **白色** (#FFFFFF) |
| **次按钮颜色** | 不适用 | **默认灰** (#7C8493) |

**快速判断**：
```
问自己：这个按钮是在表格每一行的右边吗？
✅ 是 → 操作列 → 见下方场景索引 #1
❌ 否 → 操作按钮组 → 见下方场景索引 #1.5
```

> 📖 完整代码示例和详细规则请查阅 [icons.md — 操作列 vs 操作按钮组](../../REFERENCES/components/icons.md)

---

## 颜色控制速查

颜色控制详见 [implementation-guide.md](../../REFERENCES/implementation-guide.md) I8 颜色检查清单

---

## 场景索引（快速定位）

> 下方每个场景均提供**简要规则要点**，**完整代码示例**请点击链接查看完整规范文档。

### #1 操作列（表格行内）⭐

**位置**：表格每一行的最右侧
**特点**：图标+文字混合，统一使用主题蓝色

| 要点 | 值 |
|------|-----|
| 最多可见按钮 | **3 个** |
| 第 4 个起 | 收纳至"更多"（**图标按钮** more.svg）|
| 图标尺寸 | 16×16px (`.icon`) |
| 图标+文字间距 | 4px |
| 按钮之间间距 | 12px |
| 默认颜色 | 主题蓝 `#3685F2` |

📖 [→ 查看完整代码示例](../../REFERENCES/components/icons.md)

---

### #1.5 操作按钮组（页面工具栏）⭐⭐ [v4.1]

**位置**：页面顶部工具栏 / 卡片标题栏 / 表格上方操作区
**特点**：默认使用纯文字按钮，按按钮类型决定样式

| 要点 | 值 |
|------|-----|
| 最多可见按钮 | **6 个**（比操作列多！）|
| 第 7 个起 | 收纳至"更多"（**文字按钮**，不是图标！）|
| 主按钮 | 白色图标 + 主题蓝背景 (`#FFFFFF` on `#3685F2`) |
| 次按钮 | 默认灰文字 (`#7C8493`) + 白色背景 + 描边 |
| 图标+文字间距 | 4px |
| 按钮之间间距 | 12px |

📖 [→ 查看完整代码示例](../../REFERENCES/components/icons.md)

---

### #2 搜索框图标 ⭐

| 要点 | 值 |
|------|-----|
| 位置 | 输入框**右侧** |
| 距右边界 | **8px**（不是 10px）|
| 默认颜色 | **#B9BFCB** 文字-3（**不是禁用色！**）|
| Focus 状态 | **无变色**（保持文字-3色不变）|
| pointer-events | none（不干扰输入）|

📖 [→ 查看完整代码示例](../../REFERENCES/components/icons.md)

---

### #3 带图标的按钮

| 要点 | 值 |
|------|-----|
| 布局方式 | `display: inline-flex` + `gap: 4px` |
| 图标在文字 | **左侧** |
| 图标尺寸 | 16×16px (`.icon`) |
| 主按钮图标色 | 白色 (`#FFFFFF`) |
| 次按钮图标色 | 继承父元素 color |

📖 [→ 查看完整代码示例](../../REFERENCES/components/icons.md)

---

### #4 弹窗关闭按钮

| 要点 | 值 |
|------|-----|
| 位置 | 标题栏**右侧** |
| 尺寸 | 16×16px 或 12×12px |
| 无障碍 | 必须 `aria-label="关闭"` |
| Hover 效果 | 背景变化 + 颜色加深 |

📖 [→ 查看完整代码示例](../../REFERENCES/components/icons.md)

---

### #5 导航菜单图标 ⭐（二级导航 + 顶部导航右侧功能区）

| 要点 | 值 |
|------|-----|
| 允许层级 | **仅二级导航** |
| 一级/三级/四级 | **禁止使用图标** |
| 图标位置 | 文字**左侧** |
| 间距 | 8px (`margin-right: 8px`) |
| 图标尺寸 | **20×20px** (`.icon-nav`，不是 16px) |
| 默认颜色 | 主题蓝 `#3685F2` |

📖 [→ 查看完整代码示例](../../REFERENCES/components/icons.md)

---

### #6 分页器图标

| 要点 | 值 |
|------|-----|
| 图标尺寸 | 16×16px (`.icon`) |
| 用途 | 翻页按钮（上一页/下一页）|

📖 [→ 查看完整代码示例](../../REFERENCES/components/icons.md)


---

## 引用方式速查

Sprite引用方式详见 [implementation-guide.md](../../REFERENCES/implementation-guide.md) I3 Sprite内联

---

### CSS 基础样式

CSS基础样式详见 [design-tokens.css](../design-tokens.css)

---

## 🎨 自定义图标规范（⭐ 扩展指南）

> **适用场景**：当 113 个标准图标不满足业务需求时
>
> **核心原则**：技术规范必须遵守，视觉风格尽量协调

### 自定义图标检查清单

| # | 检查项 | 要求 | 通过标准 |
|---|--------|------|---------|
| **T1** | **本地文件必须存在** | SVG 文件必须存入产出物 `2.UI/images/` 目录（含 AI 生成图标） | 本地有 `{name}.svg` 文件，禁止仅内联 path 无本地文件 |
| **T2** | **viewBox 属性** | `0 0 16 16`（或 20×20 / 24×24）| 必须包含且尺寸合理 |
| **T3** | **fill 属性** | `currentColor`（必须）| 禁止硬编码颜色值 |
| **T4** | **xmlns 声明** | `http://www.w3.org/2000/svg` | 标准 SVG 命名空间 |
| **T5** | **CSS 类名** | `.icon` + 场景类名 | 尺寸由类名控制，禁止 inline style |
| **T6** | **视觉风格** | 与标准库一致 | 线性/面性统一，避免混用 |
| **T7** | **线条粗细** | 1.5px - 2px（线性）| 与标准图标保持统一 |
| **T8** | **圆角处理** | 适度圆角 | 避免完全直角或过度圆润 |
| **T9** | **颜色支持** | 支持 hover/active 变色 | 通过 currentColor + 父元素 color 控制 |

### 自定义图标完整流程

```
步骤 1: 从 Iconfont/Feather/AI 工具获取符合规范的 SVG 图标
    ↓
步骤 2: 将 SVG 文件存入产出物 2.UI/images/ 目录（与标准库 individual/ 区分）
    ↓
步骤 3: 检查是否符合 T1-T9 检查清单
    ↓ （如不符合）
步骤 4: 调整 SVG 属性：
    • 确保 fill="currentColor"
    • 确保 viewBox 正确
    • 删除硬编码的 width/height/style
    ↓
步骤 5: Sprite 文件已预生成（icons-sprite.svg），新增图标需手动在 sprite 中添加对应的 <symbol> 定义
    ↓
步骤 6: 在页面中使用新图标
    → <svg class="icon"><use href="#icon-你的图标名"></use></svg>
```

### 推荐图标来源及使用建议

| 来源 | 特点 | 适用场景 | 风格匹配度 |
|------|------|---------|-----------|
| **[Iconfont](https://www.iconfont.cn/)** | 中文本土化，图标数量庞大（百万级）| 中文B端、国内业务 | ⭐⭐⭐⭐⭐ 高度推荐 |
| **[Feather Icons](https://feathericons.com/)** | 开源免费，线性风格，286个 | 通用 B 端、轻量应用 | ⭐⭐⭐⭐⭐ 完美匹配 |
| **[Heroicons](https://heroicons.com/)** | Tailwind CSS 官方，24×24 基准 | 现代 Web 应用 | ⭐⭐⭐⭐ 需调整尺寸 |
| **[Phosphor Icons](https://phosphoricons.com/)** | 多重量量级（thin/light/regular/bold/fill）| 需要多种粗细的场景 | ⭐⭐⭐⭐ 灵活选择 |
| **AI 生成工具** | 可生成独特图标 | 品牌/行业特定图标 | ⭐⭐⭐ 需后期处理 |

> ⚠️ **注意事项**：
> - 从 Iconfont 下载时，选择 **SVG 格式**（不是字体图标）
> - AI 生成的图标通常需要用 [Vector Magic](https://vectormagic.com/) 或 [SVGOMG](https://jakearchibald.github.io/svgomg/) 优化
> - 如果图标包含多色（如品牌 Logo），需特殊处理 fill 属性（保留原始颜色或分层控制）
> - **AI 生成图标必须在本地有对应 SVG 文件**：存入 `2.UI/images/{name}.svg`，禁止仅内联 path 数据到页面中而无本地文件
> - **新增图标后务必重新生成 Sprite 文件**

---

## 图标清单（113 个标准图标 + 无限扩展）

> **📌 重要说明**：以下 **113 个图标为系统提供的标准图标库**（覆盖 90%+ 的常见 B 端场景）。
>
> **当标准库不满足需求时**，请参阅上方 §✅允许的做法，按规范自定义图标。

### P0 - 必需图标（高频使用，15 个）

| 序号 | 文件名 | Sprite ID | 使用场景 | 备注 |
|------|--------|-----------|---------|------|
| 1 | `edit.svg` | `#icon-edit` | 操作列编辑按钮 | |
| 2 | `trash.svg` | `#icon-trash` | 操作列删除按钮 | = delete |
| 3 | `eye.svg` | `#icon-eye` | 操作列查看按钮 | = view |
| 4 | `search.svg` | `#icon-search` | 搜索框右侧 | 无 focus 状态 |
| **5** | **`more.svg`** | **`#icon-more`** | **"更多"操作按钮** | |
| 6 | `chevron-down.svg` | `#icon-chevron-down` | 下拉菜单/展开 | |
| 8 | `plus.svg` | `#icon-plus` | 新增按钮 | |
| 9 | `export.svg` | `#icon-export` | 导出数据 | |
| 10 | `copy.svg` | `#icon-copy` | 复制操作 | |
| 11 | `import.svg` | `#icon-import` | 导入数据 | |
| 12 | `refresh.svg` | `#icon-refresh` | 刷新列表 | |
| 13 | `filter.svg` | `#icon-filter` | 筛选器 | |
| 14 | `chevron-left.svg` | `#icon-chevron-left` | 返回/上一页 | |
| 15 | `chevron-right.svg` | `#icon-chevron-right` | 下一步/翻页 | |

### P1 - 常用图标（32 个）

| 序号 | 文件名 | Sprite ID | 使用场景 |
|------|--------|-----------|---------|
| 16 | `sort.svg` | `#icon-sort` | 表头排序 |
| 17 | `chevron-up.svg` | `#icon-chevron-up` | 收起/回到顶部 |
| 18 | `info.svg` / `information.svg` | `#icon-info` / `#icon-information` | 提示信息 |
| 19 | `warning.svg` | `#icon-warning` | 警告提示 |
| 20 | `circle-check.svg` | `#icon-circle-check` | 成功提示 |
| 21 | `circle-remove.svg` | `#icon-circle-remove` | 错误提示 |
| 24 | `save.svg` | `#icon-save` | 保存/提交 |
| 25 | `download-file.svg` | `#icon-download-file` | 下载附件 |
| 26 | `upload-file.svg` | `#icon-upload-file` | 上传文件 |
| 27 | `print.svg` | `#icon-print` | 打印功能 |
| 28 | `org-user.svg` | `#icon-org-user` | 用户/用户组 |
| 29 | `cog.svg` | `#icon-cog` | 设置入口 |
| 30 | `dashboard.svg` | `#icon-dashboard` | 工作台/仪表盘 |
| 31 | `users.svg` | `#icon-users` | 用户管理 |
| 32 | `product.svg` | `#icon-product` | 产品管理 |
| 33 | `project.svg` | `#icon-project` | 项目管理 |
| 34 | `component.svg` | `#icon-component` | 组件管理 |
| 35 | `scheme.svg` | `#icon-scheme` | 方案管理 |
| 36 | `token.svg` | `#icon-token` | 令牌管理 |
| 37 | `process.svg` | `#icon-process` | 流程管理 |
| 38 | `tag.svg` | `#icon-tag` | 标签管理 |
| 39 | `clock.svg` / `clock-o.svg` | `#icon-clock` / `#icon-clock-o` | 时间选择器 |
| 40 | `date.svg` | `#icon-date` | 日期选择器 |
| 41 | `file3.svg` | `#icon-file3` | 文件上传 |
| 44 | `folder.svg` | `#icon-folder` | 文件夹 |
| 45 | `paperclip.svg` | `#icon-paperclip` | 附件标识 |
| 46 | `eye-slash.svg` | `#icon-eye-slash` | 隐藏内容 |
| 48 | `switch.svg` | `#icon-switch` | 开关切换 |
| 49 | `checkbox.svg` | `#icon-checkbox` | 复选框 |
| 50 | `tick.svg` / `complete.svg` | `#icon-tick` / `#icon-complete` | 完成/确认 |

### P2 + 中文命名（其余 67 个）

包括：`TV`, `camera`, `pie chart`, `heart`, `star`, `comment`, `share`, `web`, `mobile`, `computer`、`历史记录`, `同步`, `已保存`, `运行`, `预览`, `验证码`, `投影仪`, `数据`, `智慧屏`, `暂停`, `取消编辑` 等。

完整列表请查看 [sprite-preview.html](sprite-preview.html)（推荐）或 [preview-offline.html](preview-offline.html)

---

## 特殊图标说明

### trash.svg / eye.svg

- `trash.svg` = 删除图标（文件名是 trash 不是 delete）
- `eye.svg` = 查看图标

---

## SVG 文件格式要求

| 属性 | 要求 | 说明 |
|------|------|------|
| `viewBox` | `0 0 16 16` | 统一 16×16 基准尺寸 |
| `width/height` | `16` 或不设置 | 默认 16px |
| `xmlns` | 必须包含 | 标准 SVG 命名空间 |
| `fill` | `currentColor` | 支持父元素颜色控制 |

**命名规则**：
- 小写英文 + 连字符：`chevron-down.svg`
- 中文命名也可保留：`历史记录.svg`
- ❌ 不要用空格或大写

---

## 相关文件

| 文件 | 用途 | 推荐度 |
|------|------|--------|
| **[icons.md](../../REFERENCES/components/icons.md)** | **完整规范文档**（详细代码、A/B/C/D颜色规范、检查清单） | ⭐⭐⭐ 必读 |
| **[sprite-preview.html](sprite-preview.html)** | **⭐ SVG Sprite 预览**（113 个图标，点击复制代码，需要服务器） | ⭐⭐⭐ **首选** |
| [preview-offline.html](preview-offline.html) | 离线版图标预览（双击即可打开，无需服务器） | ⭐⭐ 备选 |
| [design-tokens.css](../design-tokens.css) | 设计令牌（含 `.icon` 类定义） | 参考 |

> 💡 **提示**：推荐使用 `sprite-preview.html`（Sprite 版），可以直接查看所有图标并复制 Sprite 引用代码。

---

*最后更新: 2026-05-29 | 版本: v7.0.0（新增浏览器兼容性方案，修复 file:// 协议图标不显示问题）*
