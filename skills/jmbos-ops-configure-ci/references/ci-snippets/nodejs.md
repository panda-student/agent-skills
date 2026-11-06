# Node.js 语言片段

## 适用场景

- 前端静态资源构建项目
- Node.js 服务项目

## 项目目录检测

### package.json 查找顺序

1. **优先检查根目录**：`./package.json`
2. **根目录未找到时，扫描一级子目录**：
   - 优先扫描：`frontend/`、`web/`、`src/`、`app/`、`project/`、`client/`
   - 记录找到的 `package.json` 相对路径（记为 `APP_DIR`）

### 目录结构示例

| 项目结构 | APP_DIR 值 |
|----------|------------|
| `./package.json` | `""`（空） |
| `./frontend/package.json` | `"frontend/"` |
| `./app/client/package.json` | 不支持（只扫描一级子目录） |

### CI 脚本调整

- 如果 `APP_DIR` 非空，在执行依赖安装和构建命令前先执行 `cd $APP_DIR`
- artifacts 的 paths 需要相对于项目根目录指定，如 `frontend/dist/`

### 多模块项目处理

如果在多个目录发现 `package.json`，提示用户选择要处理的目录。

## Node.js 版本识别与镜像映射

### 版本读取位置

从 `package.json` 的 `engines` 字段读取版本要求：

```json
{
  "engines": {
    "node": ">=18.0.0 <21.0.0"
  }
}
```

### 版本匹配规则

| engines 配置 | 推荐镜像 | 说明 |
|--------------|----------|------|
| `"node": ">=18.0.0 <20.0.0"` | `$HARBOR_REGISTRY/base-int/node:18.16.1` | 完全匹配，仅支持 Node.js 18 |
| `"node": ">=20.0.0 <21.0.0"` | `$HARBOR_REGISTRY/base-int/node:20.16.0-alpine3.20` | 完全匹配，仅支持 Node.js 20（默认） |
| `"node": ">=20.0.0 <25.0.0"` | `$HARBOR_REGISTRY/base-int/node:24.15.0-alpine3.22` | 范围较广，推荐最新 LTS 版本 |
| `"node": ">=18.0.0 <21.0.0"` | `$HARBOR_REGISTRY/base-int/node:20.16.0-alpine3.20` | 范围包含多个版本，推荐最新稳定版 |
| `"node": ">=18.0.0 <25.0.0"` | `$HARBOR_REGISTRY/base-int/node:24.15.0-alpine3.22` | 范围较广，推荐最新 LTS 版本 |
| `"node": ">=16.0.0 <18.0.0"` | `$HARBOR_REGISTRY/base-int/node:18.16.1` | 提示升级建议 |
| `"node": ">=14.0.0 <17.0.0"` | `$HARBOR_REGISTRY/base-int/node:18.16.1` | 提示升级建议 |
| 未指定 engines | `$HARBOR_REGISTRY/base-int/node:20.16.0-alpine3.20` | 默认版本，推荐 LTS 版本 |

### 版本匹配逻辑

1. **解析版本范围**：解析 `engines.node` 中的版本范围约束
2. **匹配白名单镜像**：检查 `references/internal-base-images.md` 中满足范围的镜像
3. **智能推荐**：
   - 优先选择最新的满足条件的 LTS 版本
   - 如果范围包含多个主版本，推荐最新稳定版
   - 如果范围较广（跨度 >= 3 个主版本），推荐最新 LTS 版本
4. **降级处理**：
   - 如果没有完全匹配，选择最接近的版本并提示用户
   - 如果指定版本低于支持的最低版本（18），提示升级建议并使用 Node.js 18
5. **用户选择**：在 AskUserQuestion 中列出所有满足条件的镜像，让用户确认或选择其他版本

## NPM 仓库源

- `NPM_REGISTRY` 是 GitLab 项目组变量，CI 只直接引用，不在 `variables:` 中定义。
- 如果未定义 `NPM_REGISTRY` 变量，默认使用内部 NPM 仓库：`http://nexus.jomoo.cn/repository/npm-public/`
- Node.js 构建统一先执行：`if [ "$NPM_REGISTRY" != "" ]; then 
  npm config set registry "$NPM_REGISTRY";
  fi
  npm config get registry`。

## 构建命令

Node.js CI 必须先检查 `package.json` 的 `scripts.build`，再按 lockfile 选择包管理器和构建命令：

| Lockfile | 安装命令 | 构建命令 |
|----------|----------|----------|
| `yarn.lock` | `yarn install --frozen-lockfile --no-progress` | `yarn build` |
| `package-lock.json` | `npm ci` | `npm run build` |
| `pnpm-lock.yaml` | `pnpm install --frozen-lockfile` | `pnpm build` |

**特殊情况处理**：
- 同时存在多个 lockfile 时，必须提示用户确认包管理器
- 没有 lockfile 时，默认使用 yarn，并提示用户确认
- 没有 `build` 脚本时，必须提示用户确认构建命令

### 构建示例

```yaml
build_app:
  stage: build
  image: "$HARBOR_REGISTRY/base-int/node:20.16.0-alpine3.20"
  rules:
    - if: '$CI_COMMIT_BRANCH == "develop" || $CI_COMMIT_BRANCH == "test"'
      when: on_success
    - when: manual
  before_script: |
    if [ "$NPM_REGISTRY" != "" ]; then 
      npm config set registry "$NPM_REGISTRY";
    fi
    npm config get registry
  script: |
    yarn install --frozen-lockfile --no-progress
    yarn build
  artifacts:
    paths:
      - dist/
    expire_in: 1 day
```

**子目录项目**：在 `script` 开始添加 `cd $APP_DIR`，artifacts paths 需要包含目录前缀。

## 静态资源镜像

前端静态资源运行镜像只能使用：`$HARBOR_REGISTRY/base-int/nginx:1.21.4-bullseye`

## 生成要求

- 先检查 `package.json`、构建脚本和 lockfile
- 不生成 `install_dependencies` job；依赖安装放在 `build_app` 内
- 生成的 job 镜像必须使用 Node.js 白名单镜像
- Node.js CI 必须使用 `npm config set registry "$NPM_REGISTRY"` 设置仓库源

## 引用规则
- **触发规则**：参考 `references/ci-template-spec.md`
- **BUILD_TARGET_DIR**：Node.js 项目为 `dist`，参考 `references/ci-snippets/docker.md`
