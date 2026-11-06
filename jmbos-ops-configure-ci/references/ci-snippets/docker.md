# Docker 构建模板

## Docker Build 约束（强制）

- **禁止使用 `services` 配置**（docker:29.5.2-dind 镜像已内置 Dind 支持）
- **禁止推送 `latest` 标签**，只推送 `${CI_COMMIT_SHORT_SHA}-${CI_PIPELINE_IID}`
- **必须根据 Dockerfile 中实际定义的 ARG 传递 build-arg**：
  - 只传递 Dockerfile 中通过 `ARG` 指令定义的变量
  - 如果 Dockerfile 中没有定义 ARG，则不传递任何 `--build-arg` 参数
  - 如果 Dockerfile 中的ARG已经有定义值，则不传递该参数

## 镜像约束
- 构建二进制包的镜像必须从 `references/internal-base-images.md` 的“打包类基础镜像白名单”选择
- Docker 构建镜像默认使用 `$HARBOR_REGISTRY/base-ext/docker:29.5.2-dind`
- Dockerfile的基础镜像必须从 `references/internal-base-images.md` 的“打包类基础镜像白名单”和“业务类基础镜像白名单”选择

## docker-build 阶段标准模板

### 模板 1：Dockerfile 无 ARG 定义

当 Dockerfile 中没有定义任何 `ARG` 指令时使用此模板。

```yaml
docker_build:
  stage: docker-build
  image: "$HARBOR_REGISTRY/base-ext/docker:29.5.2-dind"
  rules:
    - if: '$CI_COMMIT_BRANCH == "develop" || $CI_COMMIT_BRANCH == "test"'
      when: on_success
    - when: manual
  needs:
    - build_app
  script: |
    export IMAGE_TAG="${CI_COMMIT_SHORT_SHA}-${CI_PIPELINE_IID}"
    export IMAGE="${IMAGE_PATH}:${IMAGE_TAG}"
    echo "Building Docker image: ${IMAGE}"
    docker login -u "$HARBOR_USERNAME" -p "$HARBOR_PASSWORD" "$HARBOR_REGISTRY"
    docker build -t "${IMAGE}" .
    docker push "${IMAGE}"
    echo "Docker image pushed successfully: ${IMAGE}"
```

### 模板 2：Dockerfile 有 ARG 定义

当 Dockerfile 中定义了 `ARG` 指令时使用此模板。

**注意**：`<BUILD_ARGS_PLACEHOLDER>` 需要根据实际 ARG 列表动态生成，生成格式为：
```yaml
--build-arg ARG_NAME="$ARG_VALUE" \
```

每个 ARG 占一行，最后一个 ARG 后面也保留反斜杠。

```yaml
docker_build:
  stage: docker-build
  image: "$HARBOR_REGISTRY/base-ext/docker:29.5.2-dind"
  rules:
    - if: '$CI_COMMIT_BRANCH == "develop" || $CI_COMMIT_BRANCH == "test"'
      when: on_success
    - when: manual
  needs:
    - build_app
  script: |
    export IMAGE_TAG="${CI_COMMIT_SHORT_SHA}-${CI_PIPELINE_IID}"
    export IMAGE="${IMAGE_PATH}:${IMAGE_TAG}"
    echo "Building Docker image: ${IMAGE}"
    docker login -u "$HARBOR_USERNAME" -p "$HARBOR_PASSWORD" "$HARBOR_REGISTRY"
    docker build \
      <BUILD_ARGS_PLACEHOLDER> \
      -t "${IMAGE}" .
    docker push "${IMAGE}"
    echo "Docker image pushed successfully: ${IMAGE}"
```

### 示例：Dockerfile 定义了 REGISTRY 和 GIT_COMMIT_SHA

**Dockerfile**：
```dockerfile
ARG REGISTRY
ARG GIT_COMMIT_SHA

FROM $REGISTRY/base-int/node:20.16.0-alpine3.20
```

**生成的 CI**：
```yaml
docker_build:
  stage: docker-build
  image: "$HARBOR_REGISTRY/base-ext/docker:29.5.2-dind"
  rules:
    - if: '$CI_COMMIT_BRANCH == "develop" || $CI_COMMIT_BRANCH == "test"'
      when: on_success
    - when: manual
  needs:
    - build_app
  script: |
    export IMAGE_TAG="${CI_COMMIT_SHORT_SHA}-${CI_PIPELINE_IID}"
    export IMAGE="${IMAGE_PATH}:${IMAGE_TAG}"
    echo "Building Docker image: ${IMAGE}"
    docker login -u "$HARBOR_USERNAME" -p "$HARBOR_PASSWORD" "$HARBOR_REGISTRY"
    docker build \
      --build-arg REGISTRY="$HARBOR_REGISTRY" \
      --build-arg GIT_COMMIT_SHA="$CI_COMMIT_SHA" \
      -t "${IMAGE}" .
    docker push "${IMAGE}"
    echo "Docker image pushed successfully: ${IMAGE}"
```

## BUILD_TARGET_DIR 取值规则

| 项目类型 | BUILD_TARGET_DIR 值 | 说明 |
|----------|---------------------|------|
| Java Maven 单模块 | `target` | Maven 默认构建产物目录 |
| Java Maven 多模块 | `<子模块名>/target` | 产物在子模块目录下，需自动识别或用户选择 |
| Node.js | `dist` 或 `build` | 前端构建产物目录，根据实际情况确定 |

**多模块 Maven 项目识别规则**：参考 `references/ci-snippets/java.md` 的「多模块 Maven 项目检测」章节。

## Dockerfile ARG 变量处理规则

### 自动检测的 ARG 变量

| ARG 名称 | 值来源 | 示例值 | 说明 |
|----------|--------|--------|------|
| `REGISTRY` | 平台变量 | `$HARBOR_REGISTRY` | 内部镜像仓库地址 |
| `GIT_COMMIT_SHA` | CI 变量 | `$CI_COMMIT_SHA` | 当前提交的完整 SHA |
| `BUILD_TARGET_DIR` | 项目类型 | `target` / `<子模块名>/target` (Java) / `dist` (Node.js) | 构建产物目录 |

### ARG 解析逻辑

**正则表达式**：
```regex
^ARG\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(=.*)?$
```

**解析步骤**：
1. 读取 Dockerfile 内容
2. 使用正则表达式提取所有 `ARG` 指令
3. 记录 ARG 变量名称列表
4. 根据 ARG 名称匹配对应的值

### ARG 值映射规则

| ARG 名称 | 映射规则 |
|----------|----------|
| `REGISTRY` | 映射为 `$HARBOR_REGISTRY` |
| `GIT_COMMIT_SHA` | 映射为 `$CI_COMMIT_SHA` |
| `BUILD_TARGET_DIR` | Java 单模块映射为 `target`，Java 多模块映射为 `<子模块名>/target`，Node.js 映射为 `dist` |
| 其他 ARG | 保持原样，使用 Dockerfile 中定义的默认值或提示用户 |

### build-arg 生成逻辑

**伪代码**：
```python
def generate_build_args(dockerfile_content, project_type, build_target_dir=None):
    import re
    
    # 解析 Dockerfile 中的 ARG 指令
    arg_pattern = re.compile(r'^ARG\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(=.*)?$', re.MULTILINE)
    args = arg_pattern.findall(dockerfile_content)
    arg_names = [arg[0] for arg in args]
    
    if not arg_names:
        return ""  # 无 ARG，返回空字符串
    
    # 生成 build-arg 列表
    build_args = []
    for arg_name in arg_names:
        if arg_name == "REGISTRY":
            build_args.append('--build-arg REGISTRY="$HARBOR_REGISTRY"')
        elif arg_name == "GIT_COMMIT_SHA":
            build_args.append('--build-arg GIT_COMMIT_SHA="$CI_COMMIT_SHA"')
        elif arg_name == "BUILD_TARGET_DIR":
            value = build_target_dir if build_target_dir else ("target" if project_type == "java" else "dist")
            build_args.append(f'--build-arg BUILD_TARGET_DIR="{value}"')
        else:
            # 其他 ARG，保持原样
            build_args.append(f'--build-arg {arg_name}')
    
    # 生成多行字符串，每行末尾加反斜杠
    return " \\\n      ".join(build_args) + " \\"
```

### 处理逻辑 

1. **读取 Dockerfile**：在生成 CI 前读取项目的 Dockerfile
2. **识别 ARG 指令**：使用正则表达式解析 Dockerfile 中所有 `ARG` 指令
3. **判断 ARG 列表**：
   - 如果 ARG 列表为空，使用**模板 1**（无 ARG 定义）
   - 如果 ARG 列表非空，使用**模板 2**（有 ARG 定义）
4. **生成 build-arg**：
   - 根据 ARG 名称匹配对应的值
   - 生成 `--build-arg ARG_NAME="$ARG_VALUE"` 格式的字符串
   - 每个参数占一行，末尾加反斜杠
5. **替换占位符**：将 `<BUILD_ARGS_PLACEHOLDER>` 替换为生成的 build-arg 字符串

## 模板选择流程

```
开始
  │
  ├─→ 读取 Dockerfile
  │
  ├─→ 使用正则表达式解析 ARG 指令
  │
  ├─→ ARG 列表是否为空？
  │     │
  │     ├─ 是 → 使用模板 1（无 ARG 定义）
  │     │
  │     └─ 否 → 使用模板 2（有 ARG 定义）
  │              │
  │              ├─→ 根据 ARG 名称匹配值
  │              ├─→ 生成 build-arg 字符串
  │              └─→ 替换 <BUILD_ARGS_PLACEHOLDER>
  │
  └─→ 生成 CI 配置
```
