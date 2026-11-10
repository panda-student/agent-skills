# codescan

确定性代码质量扫描 CLI,供 **codescan 技能**(`~/.agents/skills/codescan`)调用。统一脚本语言 **Node.js(纯内置模块,零第三方依赖)**。

## 集成的工具(6 个)

| 工具 | 方式 | 语言 | 维度 |
|------|------|------|------|
| jscpd | `npx --yes jscpd` | 全部 | reuse(重复代码) |
| ast-grep | `npx --yes --package @ast-grep/cli ast-grep` | 全部 | performance(N+1/循环内await/嵌套循环,规则在 `rules/astgrep/`) |
| PMD 6.55 | **按需自动下载**(首次 Java 扫描时从 PMD 官方 release 拉取约 50MB 到包内 `pmd-bin-6.55.0/`,已 gitignore 不入库;升级=删目录+改 `lib/runners/pmd.js` 的 `PMD_VERSION`;Java 8 兼容,PMD 7 需 JDK11+) | Java | quality + srp + kiss(规则精选在 `rules/pmd-codescan.xml`) |
| ESLint | 仓库本地 `node_modules`(自动兜底 `@babel/eslint-parser`→`babel-eslint` 解析器坑) | JS/Vue | quality(已过滤风格规则) |
| vue-tsc/tsc | 仓库本地,依赖未安装时优雅跳过 | TS | quality(类型错误) |
| knip | `npx --yes knip`,仓库根执行+目标范围过滤 | JS/TS | kiss(死文件/未使用导出/未使用依赖) |

## 用法

```bash
# 全局命令(npm link 注册,任意目录可用)
codescan <目标> --diff --format json

# 人读报告
codescan src/ --format text

# 全局命令异常时兜底
node C:/Users/Administrator/.agents/cli/codescan/cli.js src/ --format text
```

输出 finding 统一字段:`tool / rule / dimension(reuse|srp|quality|performance|kiss) / severity(high|medium|low|info) / file / line / message`。
`--diff [ref]` 只保留新增行上的发现(PMD 类级规则按文件级匹配;jscpd 重复对任一侧命中即保留)。

## 维护

- 新增 ast-grep 规则:往 `rules/astgrep/` 放单规则 yml,规则 id 前缀 `perf-`/`kiss-` 决定维度,severity: error/warning/info/hint → high/medium/low/info
- 调整 PMD 规则:改 `rules/pmd-codescan.xml`,维度映射在 `lib/runners/pmd.js` 的 `DIMENSION`
- ESLint 风格规则黑名单:改 `lib/runners/eslint.js` 的 `STYLE_PATTERNS`
