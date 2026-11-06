# GitLab CI 模板规范

本文档定义了 `jmbos-ops-configure-ci` skill 生成 GitLab CI 配置的统一规范，只覆盖 CI（持续集成），不覆盖 CD（持续部署）。

**当前支持语言**：Java、Node.js

---

## 引用文档

| 文档路径 | 说明 |
|----------|------|
| `references/image-naming-rules.md` | 镜像命名规则 |
| `references/internal-base-images.md` | 基础镜像白名单 |
| `references/ci-snippets/java.md` | Java 语言构建模板 |
| `references/ci-snippets/nodejs.md` | Node.js 语言构建模板 |
| `references/ci-snippets/docker.md` | Docker 构建流程模板 |

---

## 1. CI 阶段定义

`.gitlab-ci.yml` 只允许包含以下阶段：

| 阶段 | 说明 |
|------|------|
| `build` | 代码构建、依赖安装、测试、校验、产物生成 |
| `docker-build` | Docker 镜像构建与推送 |

**禁止包含以下阶段或逻辑**：

- `install`、`install_dependencies`
- `deploy`、`release`
- `gitops-update`、`argocd-sync`、`k8s-apply`
- 任何 GitOps、ArgoCD、Kubernetes 发布逻辑

**依赖安装必须放在语言 build job 中**，不拆分为独立步骤。

---

## 2. 默认配置

### 2.1 Runner Tag

默认使用 `jmbos` runner：

```yaml
default:
  tags:
    - jmbos
```

只有用户明确要求或仓库已有 CI 已证明其他 tag 时，才可以覆盖。

### 2.2 触发规则

所有生成的 CI job 默认包含以下 `rules:`：

```yaml
rules:
  - if: '$CI_COMMIT_BRANCH == "develop" || $CI_COMMIT_BRANCH == "test"'
    when: on_success
  - when: manual
```

**含义**：
- `develop` 和 `test` 分支：自动触发
- 其他分支：手动触发

只有用户明确要求或仓库已有 CI 已证明其他触发策略时，才可以覆盖。

---

## 3. 变量约定

### 3.1 平台变量

以下变量由 GitLab 平台预先定义，CI 文件必须直接引用，**不允许在 `.gitlab-ci.yml` 的 `variables:` 中再次定义**：

| 变量 | 说明 |
|------|------|
| `HARBOR_REGISTRY` | 内部镜像仓库地址 |
| `HARBOR_USERNAME` | 内部镜像仓库用户名 |
| `HARBOR_PASSWORD` | 内部镜像仓库密码 |
| `NPM_REGISTRY` | Node.js 仓库源（Node.js 项目使用） |

**Node.js 项目使用方式**：
```yaml
before_script:
  - npm config set registry "$NPM_REGISTRY"
```

**禁止使用的 CD 变量**：
- `GITOPS_USERNAME`、`GITOPS_TOKEN`、`GITOPS_REPO_URL`、`GITOPS_MANIFEST_FILE` 等属于 CD/GitOps 范围，本 skill 不使用。

### 3.2 项目变量

以下变量可以按项目配置，只有用户明确给出或仓库已有文件能证明真实值时，才写入 `.gitlab-ci.yml`：

| 变量 | 说明 |
|------|------|
| `APP_NAME` | 应用名和镜像名，默认对应 GitLab Project |
| `IMAGE_PATH` | 不含 tag 的业务镜像路径，按 GitLab 仓库路径与 Harbor 路径对应关系推导 |
| `BUILD_CONTEXT` | Docker 构建上下文路径 |
| `DOCKERFILE_PATH` | Dockerfile 路径 |
| `BUILD_TARGET_DIR` | 构建产物目录，单模块 Java 为 `target`，多模块 Java 为 `<子模块名>/target`，Node.js 为 `dist` 或 `build` |
| `EXTRA_DOCKER_BUILD_ARGS` | 额外 Docker 构建参数 |

**APP_NAME 定义规则**：

必须在 `variables:` 中定义 `APP_NAME`，默认值为 `$CI_PROJECT_NAME`（GitLab 自动提供）：
```yaml
variables:
  APP_NAME: "$CI_PROJECT_NAME"
```

**IMAGE_PATH 推导规则**：

必须先定义 `APP_NAME`，再定义 `IMAGE_PATH`，确保变量引用顺序正确。

`IMAGE_PATH` 统一采用以下格式：

```yaml
variables:
  APP_NAME: "$CI_PROJECT_NAME"
  IMAGE_PATH: "$HARBOR_REGISTRY/<项目名>/$APP_NAME"
```

**`<项目名>` 推导规则**（参考 `references/image-naming-rules.md`）：
- 从 `git remote -v` 解析 GitLab 仓库路径
- 按 `/` 分割路径，最后一段为 GitLab Project（对应 `APP_NAME`）
- 倒数第二段即为 `<项目名>`（最后一个 subgroup，或无 subgroup 时为 group）

**推导示例**：

| GitLab 仓库路径 | 项目名 | IMAGE_PATH |
|----------------|--------|------------|
| `isc/isc/iscais/iscais-service` | `iscais` | `$HARBOR_REGISTRY/iscais/$APP_NAME` |
| `nisbos/jis/jmbos-jis-external-front` | `jis` | `$HARBOR_REGISTRY/jis/$APP_NAME` |
| `nisbos/jmbos-admin` | `nisbos` | `$HARBOR_REGISTRY/nisbos/$APP_NAME` |

无法解析远程仓库路径时，必须提示用户确认 `<项目名>`，不要猜测。

**重要约束**：
- `IMAGE_PATH` 的应用名段必须保留 `$APP_NAME` 引用，不得内联为具体应用名
- 完整镜像地址在 job 中通过 `${IMAGE_PATH}:${IMAGE_TAG}` 生成
- 不要在 job 脚本里重复定义 `IMAGE_PATH`

### 3.3 运行时变量

`IMAGE_TAG` 是运行期派生值，推荐在 job 内生成：

```yaml
script:
  - export IMAGE_TAG="${CI_COMMIT_SHORT_SHA}-${CI_PIPELINE_IID}"
```

**说明**：
- 默认不要拼接 `${CI_COMMIT_REF_SLUG}`，避免 tag 过长
- 如用户明确需要在镜像 tag 中体现分支，再追加分支 slug

### 3.4 禁止使用的变量

- `IMAGE_NAMESPACE`：不是平台约定变量
- `PROJECT_NAME`：与 `APP_NAME` 语义重复
- `SVC_NAME`：不使用，统一使用 `APP_NAME`

---

## 4. 语言支持策略

### 4.1 多语言识别流程

#### 识别步骤

1. **扫描项目根目录**，检测语言标识文件：
   - **Node.js**：`package.json`
   - **Java Maven**：`pom.xml`
   - **Java Gradle**：`build.gradle` 或 `build.gradle.kts`

2. **子目录扫描**（根目录未找到时）：
   - 自动扫描一级子目录，查找语言标识文件
   - 优先扫描常见目录名：`frontend/`、`backend/`、`src/`、`app/`、`project/`、`web/`、`server/`
   - 记录找到的配置文件相对路径（记为 `APP_DIR`）

3. **识别结果处理**：
   | 场景 | 处理方式 |
   |------|----------|
   | 只识别到一种语言（单个位置） | 直接生成对应语言的 CI 配置 |
   | 识别到多种语言 | 提示用户选择要处理的语言和目录 |
   | 识别到同一语言多个位置 | 提示用户选择具体目录 |
   | 未识别到任何支持的语言 | 提示暂不支持 |

#### 多模块项目场景处理

| 项目结构 | 检测结果 | 处理方式 |
|----------|----------|----------|
| `frontend/package.json` + `backend/pom.xml` | Node.js + Java | 提示用户选择处理哪个 |
| `web/package.json` + `api/package.json` | 两个 Node.js | 提示用户选择处理哪个目录 |
| `app/package.json` | 单个 Node.js | 直接生成 CI，APP_DIR="app/" |
| `server/pom.xml` | 单个 Java | 直接生成 CI，APP_DIR="server/" |
| 根目录 `pom.xml`（packaging=pom + modules） | Java Maven 多模块 | 自动识别产物子模块，BUILD_TARGET_DIR 设为 `<子模块名>/target`，参考 `references/ci-snippets/java.md` 的「多模块 Maven 项目检测」 |

**Java Maven 多模块项目处理流程**：

1. 检测根目录 `pom.xml` 的 `<packaging>` 是否为 `pom` 且存在 `<modules>` 标签
2. 如果是多模块项目，按优先级规则自动识别产物所在子模块（参考 `references/ci-snippets/java.md`）
3. 将 `BUILD_TARGET_DIR` 设为 `<子模块名>/target`
4. 将 `artifacts.paths` 设为 `<子模块名>/target/`
5. 无法自动识别时，提示用户从 `<modules>` 列表中选择

### 4.2 版本识别

#### Node.js 版本识别

参考 `references/ci-snippets/nodejs.md`

#### Java 版本识别

参考 `references/ci-snippets/java.md`

### 4.3 公共 CI 骨架

所有支持语言共享以下规则：

- 平台变量引用规则
- 默认 runner tag：`jmbos`
- `build` / `docker-build` stages
- 默认 job 触发规则
- Docker 登录、构建、推送逻辑
- 内部镜像约束
- `git remote -v` 远程仓库检查
- 业务镜像路径推导规则

**公共骨架不包含**：
- 独立 `install` 或 `install_dependencies` stage
- GitOps 更新、ArgoCD 同步、Kubernetes 发布、环境部署、回滚策略

### 4.4 语言专属片段

语言差异只放在语言片段中：

| 语言 | 构建工具 | 片段文件 |
|------|----------|----------|
| Java | Maven/Gradle | `references/ci-snippets/java.md` |
| Node.js | yarn/npm/pnpm | `references/ci-snippets/nodejs.md` |

**Node.js 包管理器选择规则**：
- 有 `yarn.lock`：使用 `yarn install --frozen-lockfile --no-progress` 和 `yarn build`
- 有 `package-lock.json`：使用 `npm ci` 和 `npm run build`
- 有 `pnpm-lock.yaml`：使用 `pnpm install --frozen-lockfile` 和 `pnpm build`
- 没有 lockfile：默认使用 `yarn install --frozen-lockfile --no-progress` 和 `yarn build`，并在交付说明中提示用户确认

**不支持的语言**：Golang、Python 或其他语言暂不支持。

---

## 5. 镜像选择规则

### 5.1 CI Job 镜像

CI job 镜像必须来自内部仓库，例如：
- `$HARBOR_REGISTRY/devops/...`
- `$HARBOR_REGISTRY/base-int/...`

**禁止使用公网镜像**：
- 不得使用 `node:*`、`maven:*`、`golang:*`、`python:*`、`docker:*` 等公网镜像

### 5.2 Docker 构建镜像

Docker 镜像构建 job 使用的镜像参考 `references/ci-snippets/docker.md`。

### 5.3 业务基础镜像

业务基础镜像只允许使用 `references/internal-base-images.md` 中列出的镜像。

**注意**：
- Java 8 以外没有已确认的打包镜像，遇到其他 JDK 版本必须提示缺口
- 不得擅自替换为公网镜像或假设内部镜像

---

## 6. 远程仓库要求

### 6.1 检查要求

生成 CI 前必须检查 `git remote -v`：

```sh
git remote -v
```

### 6.2 解析规则

如果存在远程仓库地址，必须解析 GitLab 仓库路径，提取**项目名**（最后一个 subgroup，或无 subgroup 时为 group），并用于业务镜像路径说明。

**解析步骤**：
1. 从远程仓库地址解析出 GitLab 仓库路径（去除域名部分和 `.git` 后缀）
2. 按 `/` 分割路径
3. 最后一段为 GitLab Project（对应 `APP_NAME`）
4. 倒数第二段即为**项目名**

**示例**：
```
origin  https://gitlab.jomoo.cn/isc/isc/iscais/iscais-service.git
```

解析结果：
- 仓库路径：`isc/isc/iscais/iscais-service`
- Project（APP_NAME）：`iscais-service`
- 项目名：`iscais`（倒数第二段，最后一个 subgroup）

对应业务镜像路径：
```yaml
variables:
  IMAGE_PATH: "$HARBOR_REGISTRY/iscais/$APP_NAME"
```

### 6.3 无法解析的处理

如果没有远程仓库地址或无法可靠解析，必须提示用户确认**项目名**，不要猜测。确认后写入 `IMAGE_PATH` 变量：

```yaml
variables:
  IMAGE_PATH: "$HARBOR_REGISTRY/<项目名>/$APP_NAME"
```

---

## 7. 生成规则

### 7.1 强制检查清单

生成 `.gitlab-ci.yml` 前必须完成以下检查：

- [ ] 已检查 `git remote -v` 或说明无法检查的原因
- [ ] 已读取 `references/internal-base-images.md` 确认镜像白名单
- [ ] 已读取 `references/image-naming-rules.md` 确认镜像命名规则
- [ ] 已读取对应语言片段（`java.md` 或 `nodejs.md`）

### 7.2 强制约束

- `variables:` 不得包含 `HARBOR_REGISTRY`、`HARBOR_USERNAME`、`HARBOR_PASSWORD`、`NPM_REGISTRY`
- `variables:` 只放仓库事实能确认的非敏感项目常量
- Docker 登录使用 `$HARBOR_USERNAME` 和 `$HARBOR_PASSWORD`
- 镜像地址必须按 `references/image-naming-rules.md` 生成
- 不得写入未经确认的 registry 实际地址、服务名、镜像命名空间或分支名
- 不生成 `install_dependencies` job
- 每个生成的 job 默认包含 `rules:`
- 只支持 Java 和 Node.js；其他语言不生成 CI 文件

### 7.3 输出前检查

- [ ] 不存在 `IMAGE_NAMESPACE`
- [ ] 不存在 `PROJECT_NAME`
- [ ] 不存在 `SVC_NAME`
- [ ] 镜像路径使用 `$HARBOR_REGISTRY`
- [ ] `IMAGE_PATH` 已放在顶层 `variables:`，job 中使用 `${IMAGE_PATH}:${IMAGE_TAG}`
- [ ] `IMAGE_PATH` 路径格式为 `$HARBOR_REGISTRY/<项目名>/$APP_NAME`，其中 `<项目名>` 为 GitLab 仓库路径的最后一个 subgroup（或无 subgroup 时为 group）
