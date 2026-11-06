# Pipeline 日志分析

这个参考文件用于帮助 `jmbos-ops-ci-config` 分析 GitLab CI 失败日志。范围只限 CI，不分析 CD、部署、GitOps 或 ArgoCD。

## 分析范围

只分析以下失败类型：

- `.gitlab-ci.yml` 语法错误
- GitLab 平台变量缺失：`HARBOR_REGISTRY`、`HARBOR_USERNAME`、`HARBOR_PASSWORD`、`NPM_REGISTRY`
- runner tag 不匹配，默认应使用 `nisbos`
- 远程仓库路径无法解析，导致业务镜像路径无法确认
- 构建镜像拉取失败
- 依赖安装失败
- 编译、测试、打包失败
- Docker build 失败
- Docker login / push 失败
- 构建产物路径不匹配

不分析以下失败类型：

- GitOps 更新失败
- ArgoCD 同步失败
- Kubernetes apply 失败
- 运行时健康检查失败
- 环境发布或回滚失败

## 常见判断

### 1. 平台变量缺失

典型现象：

- `HARBOR_REGISTRY` 为空
- `HARBOR_USERNAME` 为空
- `HARBOR_PASSWORD` 为空
- Node.js 依赖安装时 `$NPM_REGISTRY` 为空或无法访问
- Docker login 认证失败

处理：

- 不在 CI 文件中给这些变量默认值。
- 提醒用户到 GitLab 组/项目变量中确认平台变量。

### 2. 构建镜像不存在

典型现象：

- `manifest unknown`
- `pull access denied`
- `not found`

处理：

- 检查 job `image:` 是否来自内部镜像白名单或已确认的内部构建镜像。
- Docker 构建 job 默认应使用 `$HARBOR_REGISTRY/base-ext/docker:29.5.2-dind`。
- Java 8 Maven 构建应使用 `$HARBOR_REGISTRY/devops/maven:3.6.3-openjdk-8-slim`。
- 其他 JDK 版本如果没有已确认构建镜像，应提示缺口。

### 3. 构建产物路径不匹配

典型现象：

- Docker build 时 `COPY` 找不到文件
- artifacts 为空
- `dist/`、`target/` 等目录不存在

处理：

- 根据项目构建脚本确认真实产物目录。
- 只把仓库事实能确认的路径写进 `variables:`。
- 不用猜测路径替代项目事实。

### 4. CI 步骤过度拆分

典型现象：

- 存在 `install` 或 `install_dependencies` stage/job。
- 依赖安装 job 只为后续 build job 提供 node_modules 或本地缓存。

处理：

- 删除独立安装步骤。
- 把依赖安装放进语言 build job。
- 保留必要 cache，但不要为了 cache 增加独立 stage。

## 输出格式

分析 pipeline 日志时，输出：

- 失败阶段：build / docker-build
- 失败类型：配置 / 构建 / 镜像 / 制品 / 认证
- 直接证据：引用关键错误行
- 修复建议：只给 CI 范围内的修改建议
