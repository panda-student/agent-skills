# codescan

确定性代码质量扫描 CLI:把 **jscpd / ast-grep / PMD / ESLint / vue-tsc / knip** 六个工具编排成一次扫描,输出统一的 finding 结构和**显式的工具状态**,面向 diff 审查与 AI Agent 调用。

设计原则:

- **确定性优先**:类型错误、死代码、重复代码、规则命中由工具产出,可复现。
- **失败可见**:工具没跑起来 ≠ 没问题。`error` / `partial` 会出现在报告里,不会被 `0 findings` 掩盖。
- **按 diff 审查**:默认只报告新增行;未跟踪文件整体纳入。
- **零额外依赖**:CLI 本身只用 Node 内置模块;linter 按需安装/下载。

## 要求

- Node.js >= 18
- Git(diff 模式需要)
- PMD 需要 JDK(PMD 6.55 可在 Java 8 上运行)
- 首次运行 jscpd / ast-grep / knip 时 `npx` 需要能访问 npm;PMD 需要能访问 GitHub Release

## 安装

```bash
# 本地开发
npm install
npm link          # 注册全局 codescan 命令

# 或直接运行
node cli.js <目标> [选项]
```

## 用法

```bash
# 审查未提交变更(含未跟踪的新文件)
codescan src --diff --format text

# 审查某个提交自身
codescan . --diff-commit HEAD~1 --format text

# 审查暂存区
codescan . --staged --format json

# 全量扫描
codescan src --format text

# 只跑指定工具
codescan src --tools eslint,tsc --format json
```

### 审查范围

| 参数 | 含义 |
|---|---|
| `--diff` / `--diff HEAD` | `HEAD` → 工作区,包含未跟踪文件 |
| `--diff <base>` | `<base>` → 工作区(此后全部变更),包含未跟踪文件 |
| `--diff-commit <ref>` | 仅该提交自身(`git diff ref^ ref`;根提交用 `git show`) |
| `--staged` | `<ref>` → 暂存区 |
| 不传 | 全量扫描 |

### 其他选项

| 参数 | 说明 |
|---|---|
| `--format json\|text` | 输出格式,默认 `json` |
| `--tools a,b,c` | 工具子集:`jscpd,astgrep,pmd,eslint,tsc,knip` |
| `--jobs N` | 并发工具数,默认 4 |
| `--min-tokens N` | jscpd 重复判定阈值,默认 70 |
| `--pmd-home PATH` | 指定已有 PMD 安装 |
| `--timeout ms` | 单工具超时,默认 300000 |
| `--max-findings N` | finding 上限,默认 200 |
| `--fail-on-tool-error` | 有工具 `error`/`partial` 时退出码 4 |

## 输出契约

```json
{
  "ok": false,
  "detected": ["java", "js", "ts"],
  "hasVue": true,
  "files": { "total": 120, "truncated": false },
  "diff": { "mode": "worktree", "ref": "HEAD", "files": 8, "error": null },
  "tools": {
    "eslint": { "status": "ok", "detail": "lint 42 个文件(2 批次)", "ms": 5321, "findings": 7 },
    "knip": { "status": "partial", "detail": "knip 退出码 2: ...", "ms": 14002, "findings": 3 }
  },
  "summary": { "total": 6, "ok": 4, "skipped": 1, "partial": 1, "error": 0, "findings": 10 },
  "truncated": 0,
  "findings": [
    {
      "tool": "pmd",
      "rule": "AvoidThrowingRawExceptionTypes",
      "dimension": "quality",
      "severity": "high",
      "file": "/repo/src/main/java/Foo.java",
      "line": 33,
      "message": "Avoid throwing raw exception types."
    }
  ]
}
```

### 工具状态

| status | 含义 |
|---|---|
| `ok` | 成功执行 |
| `skipped` | 前置条件不满足(未安装依赖、无配置),本次未检查 |
| `partial` | 执行了但部分文件/批次失败,结果不完整 |
| `error` | 执行失败,结果不可用 |

`ok: false` 表示至少有一个工具是 `partial` 或 `error` —— **不要把这种报告当成"没有发现问题"**。

### 退出码

| code | 含义 |
|---|---|
| 0 | 成功(即使有 finding) |
| 1 | 用法错误 |
| 2 | 目标不存在 / 无可识别源码 |
| 3 | 内部异常 |
| 4 | `--fail-on-tool-error` 且有工具未完整执行 |

## 工具覆盖

| 工具 | 语言 | 维度 | 说明 |
|---|---|---|---|
| jscpd | 全部 | reuse | 重复代码 |
| ast-grep | Java/JS/TS | performance/kiss | 循环内 await、嵌套循环、循环内 DB 调用 |
| PMD | Java | quality/srp/kiss | 异常处理、复杂度、GodClass;版本从 pom/gradle 推断 |
| ESLint | JS/TS/Vue | quality/kiss | 自动识别 flat config 与 eslintrc;解析失败会显式上报 |
| vue-tsc / tsc | TS/Vue | quality | 优先目标最近的 tsconfig;若存在 Vue 文件优先 vue-tsc |
| knip | JS/TS | kiss | 未使用文件/导出/依赖 |

## 扩展与替换工具

`scan` 只依赖工具接口(`lib/tool.js`),具体实现通过注册表(`lib/registry.js`)注入。新增或替换工具不需要改 `lib/scan.js`。

适配器契约:

```js
// my-eslint.js (CommonJS)
module.exports = {
  name: 'my-eslint',
  languages: ['js', 'ts', 'vue'],   // 或 ['*'] 表示不限
  dimensions: ['quality'],           // reuse/srp/quality/performance/kiss
  description: '自定义 ESLint 封装',
  async run(ctx) {
    return {
      status: 'ok',                  // ok | skipped | partial | error
      detail: '...',
      findings: [{
        file: 'D:/repo/a.js',
        line: 1,
        message: '...',
        // 可选: tool/rule/dimension/severity/fileLevel/evidence
      }],
    };
  },
};
```

使用:

```bash
# 加载外部适配器并用它替换同名内置工具
codescan src --tool-module ./my-eslint.js --tools my-eslint --format text

# 查看当前注册的工具(含外部模块)
codescan --list-tools
codescan --tool-module ./my-eslint.js --list-tools
```

- 同名模块会覆盖内置工具;新增工具按 `name` 出现在 `--tools` 中。
- `run` 的返回值会经过 `normalizeResult` 校验,非法 status/字段不会让整个扫描崩溃。
- 语言路由由适配器的 `languages` 声明,`scan` 不再硬编码"语言→工具"映射。
- 内置实现位于 `lib/runners/`,注册表位于 `lib/registry.js`。

## 行为说明

- **monorepo**:ESLint 按每个文件最近的配置文件分组执行;tsc 使用离目标最近的 `tsconfig.json`;不再只认仓库根。
- **并发**:工具通过子进程并发执行,`--jobs` 控制并发度。
- **截断可见**:文件收集上限 3000,达到上限时 `files.truncated=true`;finding 截断时 `truncated>0`。
- **版本可复现**:jscpd/ast-grep/knip 固定版本,可用环境变量覆盖:
  `CODESCAN_JSCPD_VERSION`、`CODESCAN_AST_GREP_VERSION`、`CODESCAN_KNIP_VERSION`、`CODESCAN_PMD_VERSION`。

## 已知限制

- PMD 6.55 最高解析 Java 19;检测到更高版本时会收敛到 19 并在 `detail` 中说明。
- Vue 单文件组件的 lint 依赖仓库自己的 `eslint-plugin-vue` 配置;类型检查依赖 `vue-tsc`,未安装则 `skipped`。
- knip 始终在全项目范围运行(死代码分析无法只按 diff 切片),再按目标范围过滤结果。

## 开发

```bash
npm test        # node:test,零第三方依赖
```

测试覆盖:命令失败语义、diff 区间解析/未跟踪文件、重复块区间匹配、monorepo 检测、Java 版本归一化。

## 许可

MIT。发布前请确认版权归属与公司开源审批。