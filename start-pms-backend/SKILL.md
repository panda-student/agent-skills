---
name: start-pms-backend
description: 在本地正确启动 PMS 后端（pms-service）。核心结论：禁止 mvn spring-boot:run（fork JVM 导致 Nacos config 静默拉取失败、拿不到数据源 URL），必须用 java -cp 直接跑主类（等价 IDEA 启动）。含前端本地转发三件套（vite /service、/api、sso.js hostname 的 dev/uat 环境对照与 vite deps define、代理缓存、localhost cookie 跨端口三大坑）。通过斜杠命令 /start-pms-backend 触发，或在需要启动/调试 PMS 后端、跑通本地接口、E2E 联调、验证后端启动、修复 pms_frontend 本地转发/登录引导问题、配置 PMS 登录（账号凭据/token/登录链路排查）时使用。
user-invocable: true
allowed-tools:
  - Read
  - Bash
  - Glob
  - Grep
---

# 启动 PMS 后端（start-pms-backend）

> 在本地把 `pms-service` 正确跑起来（等价 IDEA 的启动方式），供接口联调 / E2E 验证。
> **已实测验证**：`java -cp` 方式 16s 启动成功、DruidDataSource 正常初始化、接口返回 `success:true`。

## ⚠️ 核心结论（先看这条）

**禁止用 `mvn spring-boot:run` 启动 pms-service。**

根因：spring-boot 插件 fork 出的 JVM 里，spring-cloud-alibaba 的 Nacos config 拉取**静默失败**——`bootstrap.yml` 的 `config.import` 用了 `optional:nacos:common.yaml` / `optional:nacos:pms-service.yaml`，`optional:` 前缀把拉取失败吞掉不报错，导致 `spring.datasource.url` 拿不到，启动报：

```
Failed to configure a DataSource: 'url' attribute is not specified
Reason: Failed to determine a suitable driver class
```

这与 `-DPMS_NACOS_NAMESPACE` 参数**无关**——参数是对的，是 `spring-boot:run` 的 fork 机制与 spring-cloud-alibaba Nacos config 的兼容问题。

**正确方式 = 等价 IDEA 的 `java -cp` 直接跑主类。**

---

## 启动步骤

### 0. 前置：Redis 必须可用

pms-szq 命名空间 `redis.host` 占位符解析为 `localhost`。本机无 Redis 则启动报 `Connection refused: localhost/127.0.0.1:6379`。

```bash
# 检测；不通则启一个（本机已有 D:/Redis-x64-5.0.14.1）
timeout 2 bash -c "echo > /dev/tcp/127.0.0.1/6379" && echo "Redis OK" \
  || ( /d/Redis-x64-5.0.14.1/redis-server.exe --port 6379 --bind 127.0.0.1 & )
```

### 1. 导出 classpath（一次性；依赖变更后重跑）

classpath 只能来自 `dependency:build-classpath` 生成的文件。**禁止引用 `pms_lib\*`**——该扁平依赖目录已删除（2026-10-12），且 Maven 仓库的嵌套目录结构无法用 `-cp` 通配符加载。

```bash
cd D:/IdeaProjects/jomoo-ai-coding/code_workspace/pms
mvn dependency:build-classpath -pl pms-service -Dmdep.outputFile=/tmp/pms_cp.txt -q
```

### 2. 若改过 pms-common，先编译（禁止 install）

```bash
mvn -pl pms-common -am clean compile -q
```

启动命令里 `pms-common/target/classes` 前置于 cp.txt（仓库 jar 被 target/classes 遮蔽），改动即生效，**无需也不得 install**（规约：日常校验禁止 install 往 D:\mavenRepository 写快照 jar）。

### 3. 直接跑主类（等价 IDEA）

```bash
cd D:/IdeaProjects/jomoo-ai-coding/code_workspace/pms
java -DPMS_NACOS_NAMESPACE=pms-szq -Dfile.encoding=UTF-8 \
  -Dspring.devtools.restart.enabled=false \
  -cp "pms-service/target/classes;pms-common/target/classes;$(cat /tmp/pms_cp.txt)" \
  com.jomoo.pms.IntegrationApplication
```

`-Dfile.encoding=UTF-8` **必须加**：否则含中文的配置/日志在 Windows 默认 GBK 下报 `MalformedInputException`。

`-Dspring.devtools.restart.enabled=false` **必须加**：项目引入了 spring-boot-devtools，若不禁用它，`RestartClassLoader` 的类加载隔离会使 Mapper 的 `@SelectProvider` 中 `new SQL(){{...}}` 生成的匿名内部类（如 `XxxSqlProvider$1`）运行时抛 `ClassNotFoundException: ...$1`（.class 文件明明存在却加载不到）。这是**运行环境问题，不是 SQL 写法问题**，不要去改业务代码——只改单个 SqlProvider 无意义，其余同类写法仍会踩坑，正确做法就是禁用 devtools restart。

**PowerShell 环境版本**（上方是 bash 语法；PowerShell 直用会按点号拆分 `-D` 参数，报「找不到或无法加载主类 .encoding=UTF-8」）：

```powershell
java "-DPMS_NACOS_NAMESPACE=pms-szq" "-Dfile.encoding=UTF-8" "-Dspring.devtools.restart.enabled=false" `
  -cp "pms-service/target/classes;pms-common/target/classes;$(Get-Content C:\Users\JOMOO\AppData\Local\Temp\pms_cp.txt -Raw)" `
  com.jomoo.pms.IntegrationApplication
```

要点：所有 `-D` 参数必须用双引号包裹（与 mvn `-D` 参数加引号规约同理）；classpath 里的 `$(cat /tmp/pms_cp.txt)` 换成 `$(Get-Content <cp.txt 路径> -Raw)`。

### 4. 验证启动成功

```bash
# 端口开放（上下文 /pms，端口 8098）
timeout 3 bash -c "echo > /dev/tcp/127.0.0.1/8098" && echo "8098 OPEN"

# 日志出现
#   DruidDataSource.init ... inited
#   Started IntegrationApplication in ~16 seconds

# 接口冒烟（dev 免认证直连）
curl -s -X POST "http://127.0.0.1:8098/pms/project/benefit/month/page" \
  -H "Content-Type: application/json" -d '{"currentPage":1,"pageSize":3}'
```

成功标志：返回 `{"success":true,...}`。

---

## 关键信息速查

| 项 | 值 |
|---|---|
| 主类 | `com.jomoo.pms.IntegrationApplication` |
| 命名空间参数 | `-DPMS_NACOS_NAMESPACE=pms-szq` |
| 上下文路径 | `/pms` |
| 端口 | `8098` |
| Nacos | `10.1.12.33:36032`（namespace `pms-szq`） |
| 数据源 | `jdbc:mysql://10.1.5.86:3306/sys`（从 Nacos `pms-service.yaml` 拉取；**sys 即 UAT 业务库**，pms_test 是测试库——本地后端读的就是 UAT 数据：E2E 断言 total 与数据核对基准以 UAT 库为准，存量数据回填 SQL 也打到 sys） |
| Redis | 本机 `127.0.0.1:6379`（`D:/Redis-x64-5.0.14.1/`） |

---

## 常见启动失败排查

| 报错 | 根因 | 解决 |
|---|---|---|
| `Failed to configure a DataSource: 'url' attribute is not specified` | 用了 `mvn spring-boot:run`，Nacos config 静默拉取失败 | 改用本技能的 `java -cp` 方式 |
| `Connection refused: localhost/127.0.0.1:6379` | 本机无 Redis | 先启本机 Redis（步骤 0） |
| `MalformedInputException` | 缺 `-Dfile.encoding=UTF-8`，GBK 读 UTF-8 配置 | 启动参数补 `-Dfile.encoding=UTF-8` |
| `ClassNotFoundException: ...$1` | 未禁用 devtools restart，RestartClassLoader 与 `new SQL(){{...}}` 匿名内部类不兼容 | 启动命令加 `-Dspring.devtools.restart.enabled=false`（见步骤3） |
| 端口被占 | 旧进程未停，**或用户已自行启动后端实例** | 先查占用进程命令行：`Get-CimInstance Win32_Process -Filter "ProcessId=<pid>"`——若已是本技能方式启动的后端（跑 target/classes 最新代码），**直接复用勿杀**（按 `-DPMS_NACOS_NAMESPACE` 区分配置环境）；确需清理用 `taskkill /PID <pid> /F`（PowerShell 单斜杠，`//PID` 报错） |
| pms-common 改动不生效 | target/classes 未重新编译 | `mvn -pl pms-common -am clean compile -q` 后重启（classpath 前置 target/classes，无需 install） |

---

## 本地 E2E 导出验证（浏览器 UI 全链路）

启动后端 + 前端 vite dev（`pms_frontend` 的 proxy 已指向 `localhost:8098`；注意本机常见**既有 vite 实例跑在 7153**，重复启动会落到 7154——先 `netstat -ano | Select-String ":7153"` 查复用，多余实例按端口找 PID taskkill 清理）：

1. **UI 操作**：浏览器（Trae 桥接已登录态）打开 `https://localhost:7153/<目标页面路由>`，纯 UI 勾选表格行 → 点导出按钮
2. **网络层裁决**：`browser_network_requests` 过滤 export 请求——验证请求体 `{ids:[...]}` 与响应 200；`browser_console_messages` 里拦截器 log 含完整响应头，`content-disposition` 文件名应含日期后缀
3. **下载产物**：文件落在**用户实际下载目录**（如 `D:\JOMOO\Downloads`，非系统默认 `%USERPROFILE%\Downloads`）——校验文件名「业务名称+yyyyMMdd.xlsx」
4. **内容核对**：xlsx 复制改 `.zip` 后 `Expand-Archive` 解压，直读 `xl/worksheets/sheet1.xml` 核对数据行与勾选过滤（EasyExcel 内联字符串 `t="inlineStr"` **不走 sharedStrings.xml**；数值带 `.0` 后缀，contains 判断用无小数前缀）
5. **陷阱**：`downloadFileBlob` 的成功 toast 会因内部 `this.$message` TypeError 静默失败（console 报 `Unhandled Promise rejection`）——**toast 不出现不代表下载失败**，以下载目录文件与网络请求为准；表格勾选状态裁决用 vxe-table 组件的 `getCheckboxRecords()` 只读核实，勿凭截图视觉（勾选框 hover/半选渲染易误读）
6. **低代码页面请求前缀陷阱**：`bos-saas-page` 页面的列表/导出 URL 由 **cookie `url`** 拼接（`getRequestUrl()`），本地登录后 cookie url 仍指 UAT 域（如 `api-uat-pms.jomoo.com`）→ 请求根本不走本地 proxy。须先把 cookie url 改为 `localhost:7153/service`（`document.cookie = 'url=' + encodeURIComponent('localhost:7153/service') + '; path=/'`）再刷新页面。同时 vite proxy rewrite 必须**剥 `^/service/pms-service`**（页面结构 api 自带服务前缀，剥后剩 `/pms/xxx` 恰好命中本地 context-path）；若 replace 成 `'/pms'` 会变成双 `/pms` 404。页面真实路由从菜单动态挂载，从浏览器 network 面板 `getRouters` 响应解析真实 path（如 `/benefit/manage/ledger`），勿按 views 目录路径猜
7. **勾选类 UI 验证的环境差异与闭环策略**：本地 vite dev 模式下 vxe-table 复选框自动化点击可能完全不生效（隐藏 input 0×0、`.vxe-checkbox--icon` 点击后状态不变、无「已选 N 条」提示，多种选择器均失败），而 UAT 生产 dist 页面同类操作正常。勾选导出验证推荐闭环：接口层本地实证（`{ids:[...]}` → 返回选中行）→ 合并推送后**轮询 UAT 同请求探测部署生效**（修复前必 500 的请求，直到 200 + xlsx 魔数 `504b0304`）→ 到 UAT 真实页面做 UI 终验。另注意低代码导出语义：未勾选发 `queryParams` 全量导出是**正确行为**，勿误判为缺陷

---

## 前端本地转发的环境三件套（2026-10-22 双环境实测）

pms_frontend 的 vite.config.js 有三处环境指向必须**环境自洽**：`/service` 代理、`/api` 代理、`public/sso.js` 的 `hostname`。配置随分支走（dev 分支指 dev、uat 分支指 UAT），**勿用 skip-worktree 本地覆盖**——曾因 E2E 提交把双分支全改成 UAT 指向导致本地 dev 转发错乱。

| 环境 | /service | /api（注册查询） | sso.js hostname |
|---|---|---|---|
| dev | `https://test-pms.jomoo.com/pms` | `https://test-pms.jomoo.com/api`（**唯一可用入口**；api-application-test-jmbos、api-test-pms 均查无注册） | `test-pms.jomoo.com` |
| UAT | `https://uat-pms.jomoo.com/pms` | `https://api-application-uat-jmbos.jomoo.com` | `uat-pms.jomoo.com` |

### sso.js：环境配置文件（登录链路的源头）

`public/sso.js` 是前端运行时环境配置，文件头部 `window.config` 定义登录与全局行为；**登录链路第①跳 `getCheckTenant` 的 hostname 入参即取自 `window.config.hostname`**——bootstrap.js 仅在 `location.hostname === 'localhost'` 时读取该值，部署环境按真实域名走（改它不影响部署，dist 里残留旧值无需处理）。登录相关关键字段速查（以本仓库文件实测为准）：

| 字段 | 值 | 作用 |
|---|---|---|
| hostname | 随分支走：dev=`test-pms.jomoo.com` / uat=`uat-pms.jomoo.com`（见上表） | 本地联调环境指向，三件套之一，环境串台防护同前 |
| loginType | 1 | 登录方式：用户名密码+手机验证码 |
| isRefreshToken | 1 | 登录请求头是否添加（开启 token 无感刷新，对应 Cookie `nisbos_refresh_token`） |
| refreshTokenAdvanceTime / refreshTokenStopTime / refreshTokenExpiredTime | 30 / 30 / '23:00' | 提前刷新分钟数 / 无操作静置上限 / 每日刷新失效时刻 |
| ucenterUrl / uaccount | `ucenter-www.jmbos-uat.jomoo.cn` / `ucenter-uat-jmbos.jomoo.com` | ucenter 项目路径与账号服务地址 |
| isTenant | false | 是否租户模式 |

### 登录链路三跳与账号配置（登录失败排查总纲）

- **登录链路三跳**（任何一跳坏都表现为「登录失败」，逐跳核实）：① `getCheckTenant(hostname)` 走 `/api` 代理查系统注册（hostname 取自 sso.js `window.config.hostname`，见上节）→ 写 Cookie `systemId`/`url`(=domainApi)；② `loginNew` **不走代理、直连** Cookie `url` 指向的认证网关发 token（`systemid` 请求头取自①）；③ PMS 业务接口走 `/service` 代理（低代码页面引擎按 Cookie `url` 拼绝对地址，见「低代码页面请求前缀陷阱」）
- **loginNew API 契约**：`GET /oauth2/api/system/getSystemByDomain/<domain>` 取 `data.systemId` → `POST /oauth2/api/niscommon/noAuth/loginNew`，body `{domain,userCode,usePwd,loginType:1}`，**必须带 `systemId` 请求头**；多公司账号带 `companyId` 头重登；成功写 Cookie `nisbos_auth_token`
- **时好时坏机理与修复纪律**：有效 token/companyObj Cookie 会掩盖坏点，清 Cookie 或 token 过期即暴露；修复登录问题禁止只修单跳就宣布完成，**必须实测完整登录进首页**才算闭环
- **凭据统一从 vault 取**（local-password-manager MCP，禁止硬编码）：测试超管「PMS 平台测试超管账号」、UAT 超管「PMS 平台 UAT 超管账号」、普通账号「PMS 平台普通账号」（00098962）；浏览器场景用 `fill_credential` 注入；password 类条目不回明文，脚本读不到密码只能本地代填；`pms_frontend/e2e/.env.local` 是注入落盘产物
- **密码事实**：dev 网关拒绝 UAT 密码（错误码 12003），两环境密码不同；浏览器记住密码会回填旧密码，登录前必须核对/清空
- **token 有效期边界**：`nisbos_auth_token` 约 2h 过期；过期后 UAT 平台登录强制 iJOMOO APP 扫码/手机验证码，用户不在场无法自主重登 → 需登录态的 E2E 趁会话有效期内尽早做完；路由守卫只验 token 存在性（`!!getToken()`），有效性由平台接口校验
- **token 传递捷径**：路由守卫支持 `https://localhost:<端口>/?nisbos_auth_token=<token>` URL 参数直接种 cookie（IBPM 待办新开页同机制）
- **登录链路偶发 POST 挂起**：vite(node) 默认 keepAliveTimeout=5s，页面闲置（如输账号密码）后 POST 复用已被服务端关闭的 keep-alive 连接，响应静默丢失、xhr 永久 pending（GET 有重试所以正常）；修复：vite.config plugins 加 configureServer 钩子设 `httpServer.keepAliveTimeout=300000`/`headersTimeout=310000`，重启 dev server 后需重新导航重建连接
- **环境串台防护**：sso.js/vite.config.js 随分支走（dev 分支=dev 三件套、uat 分支=UAT 三件套），uat↔dev 同步时这两个文件**按各自分支保留、禁止互相搬运**，跨分支提交前必核查其环境指向（b00332c3 曾把双分支误提交成 UAT 指向）；sso.js hostname 仅在 localhost 生效（bootstrap.js 判断 `location.hostname === 'localhost'`），对部署环境无影响

### PMS_LOCAL_BACKEND 开关：E2E 直连本地后端（免改配置）

vite.config.js 内置环境变量开关：设 `PMS_LOCAL_BACKEND=http://localhost:8098` 启动 vite dev，`/service` 代理即直连本地后端（rewrite 剥前缀 `^/service/pms-service`），**无需修改 vite 配置文件**——E2E/UI 联调本地代码的标准姿势，避免配置文件随分支漂移问题。

### 坑：vite 顶层 define 不作用于预打包 deps

顶层 `define` 的 `process.env.VUE_APP_*` **不会注入 node_modules 预打包产物**（bos-pc/bos-login）——包内该变量在浏览器为 undefined → 包内 `getCheckTenant` 丢 `/api` 前缀、请求打到 vite SPA fallback 拿回 HTML → 引导静默失败 → cookie `url=null` → loginNew 打到字面量 `https://null/`。本地 dev 平时「能用」只是浏览器残留旧 cookie 掩盖，清 cookie 后必复现。**修复**：vite.config 加 `optimizeDeps.esbuildOptions.define` 同步注入 `VUE_APP_*`（NODE_ENV/BASE_API/SERVICE_API/SUB_DOMAIN）。

### 坑：网关响应无缓存头被浏览器启发式缓存

网关 200 响应无 `Cache-Control` 时浏览器可能缓存旧响应（特征：`performance.getEntriesByType('resource')` 里 `transferSize=0`），data:null 的旧响应会持续污染登录引导。**修复**：vite proxy 对 `/api`、`/service` 加 `configure: (proxy) => proxy.on('proxyRes', (res) => { res.headers['cache-control'] = 'no-store' })`。

### 坑：localhost cookie 跨端口共享

`localhost:7153` 与 `:7154` 共享 cookie——双环境并行验证会互相污染：dev 登录态会让「UAT 登录」实际打 dev 认证网关（用户视角「密码对了但不是 UAT 在验」）。并行验证需每步清 cookie、只留单标签页、不再需要的端口服务立即停。**裁决依据 = loginNew 目标域名**（api-test-pms vs api-uat-pms），不以「登录成功」为准。

### 独立 dev 引导的真实链路

`src/main.js` 的 `bootstrapApp` 是孤儿代码（从未被调用）。实际引导：路由守卫 `permission-helpers.js` 的 `checkAppLoaded` → dispatch bos-pc 内置 action `app/checkTenant`（localhost 时取 `window.config.hostname` 查注册 → `setCookieInfo` 写 url/systemId cookie），**失败静默返回 false 无任何提示**。诊断引导问题优先看两处：cookie `url` 值、loginNew 实际目标域名。

### 登录页报错文案→根因速查表（2026-10-28 实测）

- `Network Error`：cookie url=null → loginNew 打字面量 `https://null/`（引导查无注册写 null，典型诱因见下条 hostname 坑）
- `密码错误`/12003：环境错配——UAT 凭据打 dev 认证网关（核对 sso.js hostname 与 vite `/api`、`/service` 三件套是否同环境）
- `参数类型数据解析异常`：loginNew 直连的 cookie url 是脏值（如被设成 `localhost:7153/service/pms-service` 代理前缀）→ 拼出的 URL 经 `/service` 代理打到 PMS 业务网关的认证路径，业务网关不认平台认证参数
- 排障第一动作：F12 看 loginNew 实际请求 URL 与目标域名，再查 `document.cookie` 的 `url`/`commonUrl` 值；凭据核对 `pms_frontend/e2e/.env.local`

### 坑：sso.js hostname 严禁指向本地域名（2026-10-28 实证）

`hostname: 'localhost:7153'` 时 getSystemByDomain 查无注册 → checkTenant 把 cookie url 写成 **null**（是写 null，不是跳过不写）→ loginNew 打 `https://null/` 报 Network Error。且引导无论成败都会重写 url cookie——手动 `document.cookie` 设置的值**活不过一次整页刷新**，SPA 内跳转不重跑 checkAppLoaded（tenantLoaded 是内存态）才可保活。

### 低代码列表页同源化代理（bos-saas-page 数据请求不走 /service 代理）

bos-saas-page 页面引擎按 `'https://' + cookie url + domApi路径` 拼绝对地址调网关，从 localhost 发起会被 CORS 拦或打到线上旧代码——历次「本地列表页有表头无数据/数据是线上旧版」的真正根因。本地化标准姿势（2026-10-19 验证链路通）：

1. vite 增补两条代理：`/pms/pms-service` → `http://localhost:<后端端口>`（rewrite 剥该前缀，剩 `/pms/xxx` 命中本地 context-path）；`/app-system` → `https://api-uat-pms.jomoo.com`（结构请求，不重写）
2. 登录成功后 SPA 内 `document.cookie` 把 **`url` 和 `commonUrl` 两个 cookie 都**翻转为 `localhost:<前端端口>`（只翻 url 不够）
3. **纯 SPA 路由导航**切走再切回触发列表页 activated 重查；绝不整页刷新（必被 checkTenant 重写 cookie）

### 坑：obs-service 本地不可达——附件上传类接口的组合拳（2026-10-27 实证）

本地后端调 `/attachment/upload` 报 `UnknownHostException: obs-service`：OBS 文件服务是 K8s 集群内服务（Pod DNS `http://obs-service`），Nacos pms-szq/uat/dev/public 各命名空间均无注册，本地永远走不通。**组合拳**：上传走 UAT 网关 `https://uat-pms.jomoo.com/pms/pms-service/pms/attachment/upload`（multipart；UAT 登录链路：api-application-uat-jmbos.jomoo.com 的 `system/getSystemByDomain/<domain>` → `niscommon/noAuth/loginNew`，**必须带 header `systemId`**，token 字段名 `ssoToken`，凭据在 `pms_frontend/e2e/.env.local`）；绑定/详情等纯 DB 操作走本地后端——本地后端与 UAT 共用 sys 库（10.1.5.86:3306），同库一致性使该组合拳成立，可完整验证「上传→绑定→详情回显」链路。测后用 dbx 清理 t_pms_attachment 与业务单据测试行。

### 坑：改了 pms-common 后跑单测必须带 -am

`mvn -pl pms-service -am test`：不带 `-am` 时 pms-service 编译用的是本地 .m2 里的旧 pms-common 快照 jar，报缺字段/缺 setter 的编译错误——**假报错，与源码无关**（实例：BudgetChangeInfo 缺 setter，实为新字段在旧 jar 里不存在）。日常校验禁止 install 规约下，唯一正确姿势就是 `-am` 让 reactor 一起编译。

### 坑：Map.of 不兼容 Java 8（2026-10-28 实证）

本项目按 Java 8 编译，`Map.of` / `List.of` 是 Java 9+ API，测试或业务代码里直接用会编译失败（`cannot find symbol: method of(...)`）。mock 数据/构造测试夹具改用 `new HashMap<>()` + `put`（实例：字典翻译单测 mock CacheUtil 返回值用 `Map.of` 编译报错，换 HashMap 后 `Tests run: 1, Failures: 0`）。

### 既有实例判别：启动时间 vs 编译时间

8098 被占时，进程启动时间早于本次代码编译时间即旧代码，必须停掉重启；`java -cp` 启动命令在树内 cwd 执行即可（相对路径 `pms-service/target/classes` 自动取树内编译产物，无需改命令）。

---

## 本地接口验证配套（dev token / 环境速查）

本地缺登录态（`LoginUtil.getCurrentUserId()` 缺失）会让 Controller 报 500 NPE。若拦截器**只解析 JWT 的 `user.userCode` 而不验签**（如 PMS `UserContextInterceptor`），可直接构造 dev token 解锁：

- 账号来源：vault（local-password-manager MCP，条目见「登录链路三跳与账号配置」；超管 `00071763` / 普通 `00098962`）
- token 构造（Node，signature 随意）：

```javascript
const b64url = (s) => Buffer.from(s).toString('base64url');
const token = `${b64url(JSON.stringify({alg:'HS256',typ:'JWT'}))}.${b64url(JSON.stringify({user: JSON.stringify({userCode:'00071763', name:'admin'})}))}.${b64url('sig')}`;
```

- 先用 `GET {host}/auth/verify/current`（Authorization: Bearer <token>）验证 `userContext.currentUserId` 解析成功，再跑业务接口，避免盲目重试

### 浏览器 UI 验证的本地登录（表单登录）

需要登录态的 UI 验证（localhost 页面无既有登录态时）：

- **密码来源**：统一从 vault 取（见「登录链路三跳与账号配置」），UAT 网关登录密码注入落盘在 `pms_frontend/e2e/.env.local`（gitignore）；yaak dev 环境变量里的 `usePwd`（Welcome1）**不是** UAT 网关密码，用它登录会静默失败（loginNew 200 但不写 token cookie、页面不跳转、无任何提示）
- **登录成功标志**：cookie 出现 `nisbos_auth_token` / `nisbos_refresh_token`，URL 跳出 /login；仅写入 `url`/`systemId` cookie 不算登录成功
- **登录按钮点击无效时**：原生 browser_click 无反应（不触发 loginNew）→ JS 派发 mousedown/mouseup/click 事件序列可触发（实例：2026-10-23 效益排序验证）

### 既有实例新旧判别（重启前必做）

8098 被占用时（常见于用户或先前会话自行启动的后端），**运行实例可能跑的是旧代码**——直接对着旧实例验证接口会得出「改动无效」的假结论。判别方法：双 token 对照调同一查询接口（权限类改动）：

- 构造超管 token（00071763）与普通用户 token 各调一次（如 `/pms/project/info/statistics`）
- 两者返回**完全相同** = 旧代码（新代码下无规则用户应只见本人创建数据，数值必然不同）
- 判别为旧代码再 `taskkill /PID <pid> /F` 重启；是新代码（跑 target/classes 最新构建）则直接复用勿杀（按 `-DPMS_NACOS_NAMESPACE` 区分配置环境）

### PowerShell 请求陷阱：curl.exe 引号剥离

PowerShell 5.1 调用外部 `curl.exe` 时，字符串里的内嵌双引号会被剥离，JSON body 损坏，服务端报 400 + 日志 `JSON parse error: Unexpected character ('a' ...)`（`-d '{}'` 空对象不受影响，带字段必踩）。带 JSON body 的请求**改用 Invoke-RestMethod**（原生 cmdlet，单引号字符串原样传递）：

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8098/pms/benefit/report/ledger" -Method Post `
  -ContentType "application/json" -Headers @{ Authorization = "Bearer $token" } `
  -Body '{"applyType":"xxx"}'
```

### 坑：Invoke-RestMethod 响应 UTF-8 乱码——输出乱码≠数据错（2026-10-28 实证）

PowerShell 5.1 将服务端 UTF-8 响应按 GBK 解码，终端输出/落盘内容乱码，但**接口数据本身是正确的**，勿据此误判接口返回异常。裁决真实字节：用 Node `fetch` 直取响应文本，或落盘后 `Get-Content <文件> -Encoding UTF8` 读取（实例：本地 `/pms/projectChange/history` 返回中文显示乱码，Node 直取确认「采购阶段/设计阶段」翻译正确，排除后端问题）。

测试环境请求速查：

- 测试：前端 https://test-pms.jomoo.com（只服务页面，API 404）；网关 https://api-test-pms.jomoo.com/pms/pms-service/pms，必备头 authorization: Bearer <token> + systemid: 1108598
- UAT：前端 https://uat-pms.jomoo.com；网关 https://uat-pms.jomoo.com/pms/pms-service/pms；登录取 token 走 api-application-uat-jmbos.jomoo.com 的 `system/getSystemByDomain/<domain>` → `niscommon/noAuth/loginNew`（E2E 凭据在 pms_frontend/e2e/.env.local）
- 请求脚本模板与状态码诊断见 use-yaak 技能 examples.md

## 背景（为什么不是参数问题）

IDEA 的 `Spring Boot.IntegrationApplication` 运行配置 `VM_PARAMETERS` 就只有 `-DPMS_NACOS_NAMESPACE=pms-szq`，能正常启动——因为它用 `java -cp` 直接跑主类，Nacos config 加载链路正常。`spring-boot:run` 起不来纯粹是其 fork 机制问题，与命名空间参数无关。
