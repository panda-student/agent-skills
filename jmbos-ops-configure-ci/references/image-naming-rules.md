# 业务镜像命名规则

业务镜像统一采用以下路径：

```text
$HARBOR_REGISTRY/<项目名>/<APP_NAME>:<tag>
```

在 CI 中，`<harbor-domain>` 必须使用 `$HARBOR_REGISTRY` 引用，不写死实际域名。

## IMAGE_PATH 推导规则

### 推导步骤

1. 执行 `git remote -v` 获取远程仓库地址（优先 `origin` 的 fetch 地址）
2. 解析出 GitLab 仓库路径（去除域名部分和 `.git` 后缀）
3. 按 `/` 分割路径：
   - 最后一段 → `APP_NAME`（GitLab Project 名称）
   - 倒数第二段 → `<项目名>`（最后一个 subgroup，或无 subgroup 时为 group）

### 推导示例

| GitLab 仓库路径 | 项目名 | APP_NAME | IMAGE_PATH |
|----------------|--------|----------|------------|
| `isc/isc/iscais/iscais-service` | `iscais` | `iscais-service` | `$HARBOR_REGISTRY/iscais/$APP_NAME` |
| `nisbos/jis/jmbos-jis-external-front` | `jis` | `jmbos-jis-external-front` | `$HARBOR_REGISTRY/jis/$APP_NAME` |
| `nisbos/jmbos-admin` | `nisbos` | `jmbos-admin` | `$HARBOR_REGISTRY/nisbos/$APP_NAME` |

### 无法解析的处理

如果没有远程仓库地址，或无法可靠解析远程仓库路径，必须提示用户确认 `<项目名>`，不要猜测。确认后写入 `IMAGE_PATH` 变量。

## 变量命名

- 只使用 `APP_NAME` 表达应用名/镜像名。
- 使用 `IMAGE_PATH` 表达不含 tag 的业务镜像路径，并放在 `.gitlab-ci.yml` 顶层 `variables:` 中供用户修改。
- `PROJECT_NAME` 与 `APP_NAME` 语义重复，不使用。
- `IMAGE_NAMESPACE` 不是平台约定字段，不使用。
- `SVC_NAME` 不使用，统一改为 `APP_NAME`。

## CI 中的使用方式

```yaml
variables:
  APP_NAME: "$CI_PROJECT_NAME"
  IMAGE_PATH: "$HARBOR_REGISTRY/<项目名>/$APP_NAME"
```

```sh
export IMAGE_TAG="${CI_COMMIT_SHORT_SHA}-${CI_PIPELINE_IID}"
export IMAGE="${IMAGE_PATH}:${IMAGE_TAG}"
```

**约束**：
- `IMAGE_PATH` 的应用名段必须保留 `$APP_NAME` 引用，不得内联为具体应用名
- `IMAGE_TAG` 默认使用 `${CI_COMMIT_SHORT_SHA}-${CI_PIPELINE_IID}`，不要默认包含 `${CI_COMMIT_REF_SLUG}`，避免 tag 过长
- 如果项目镜像路径需要调整，优先修改 `variables:` 中的 `IMAGE_PATH`，不要改 job 脚本

## 输出前检查

- 已检查 `git remote -v` 或说明无法检查的原因。
- 不存在 `IMAGE_NAMESPACE`。
- 不存在 `PROJECT_NAME`。
- 不存在 `SVC_NAME`。
- 镜像路径使用 `$HARBOR_REGISTRY`。
- `IMAGE_PATH` 已放在顶层 `variables:`，job 中使用 `${IMAGE_PATH}:${IMAGE_TAG}`。
- `IMAGE_PATH` 路径格式为 `$HARBOR_REGISTRY/<项目名>/$APP_NAME`。
