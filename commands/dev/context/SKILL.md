---
name: context
description: 读取项目上下文和任务提示文件，通过斜杠命令 /context 触发
user-invocable: true
disable-model-invocation: true
allowed-tools:
  - Read
  - Write
  - Glob
  - AskUserQuestion
---

读取上下文配置文件到当前会话。

## 目录结构

```
.claude/
└── context/
    ├── context.md          # 项目通用信息（技术栈、结构）
    ├── prompt.md           # 任务信息（目标、约束）
    ├── config/             # (可选)
    │   └── common.yaml
    └── examples/           # (可选)
```

## 执行

1. 读取 `context.md` + `prompt.md`
2. 按需读取 `config/common.yaml` + `examples/`
3. AI 自动补充项目信息

## 自动补充

不限制项目类型，读取当前项目的关键文件：

- `package.json` / `pom.xml` / `go.mod` / `Cargo.toml` → 依赖
- `tsconfig.json` / `compiler-options` → 编译配置
- `vite.config.*` / `webpack.config.js` / `next.config.*` → 构建配置
- `.gitignore` → Git 配置
- `README.md` → 项目说明
- 根目录配置文件

**无需特定项目类型，任何项目都能提取关键信息。**

## 询问

使用 `multiSelect: true` 多选询问用户：

```
询问: "文件不存在，需要创建哪些文件?"
选项:
- context.md
- prompt.md
- config/common.yaml (可选)
- examples/ 示例目录 (可选)
- 全部都创建
```

**触发**: `/context`
