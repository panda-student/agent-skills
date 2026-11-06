---
name: jmbos-ops-configure-ci
description: "负责创建、优化或补齐项目的 GitLab CI 配置文件，只覆盖持续集成（CI）部分，不包含 CD、部署、   GitOps 更新或发布编排。支持 Java 和 Node.js 项目的构建模板选择、内部镜像约束、   Docker 镜像构建与推送配置。"
skill-version: V1.0.1
---

负责创建、优化或补齐项目的 GitLab CI 配置文件，只覆盖持续集成（CI）部分，不包含 CD、部署、
  GitOps 更新或发布编排。支持 Java 和 Node.js 项目的构建模板选择、内部镜像约束、
  Docker 镜像构建与推送配置。

# CI Config Skill

## 执行前检查
1. 每次调用此 skill 时，必须在回复开头明确提示：
> 🛠️ **正在使用 `jmbos-ops-configure-ci` skill 创建/配置 GitLab CI**
2. 确保项目目录下可以执行 `git remote -v` 获取远程仓库地址，执行失败则提示用户检查项目目录是否正确，并退出执行。
3. 检查 Dockerfile 文件：
   1. 优先检查项目根目录
   2. 根目录未找到时，扫描非隐藏且非明显非项目目录（如 src/、node_modules/）的一级子目录
   3. 仍未找到则检查二级子目录
   4. 【强制】如果都没有找到dockerfile文件，则提示用户创建，并终止执行。
   5. 存在但为空则提示用户先填充正确内容，并终止执行
4. 检测项目类型（Java 或 Node.js）：
   1. 优先检查根目录：`./pom.xml` / `./build.gradle`（Java），`./package.json`（Node.js）
   2. 根目录未找到时，扫描一级子目录：
     - 排除扫描：`.` 开头的目录、`node_modules/`、`target/`、`build/`、`dist/`
     - 优先级目录（Node.js）：`frontend/`、`web/`、`client/`
     - 记录找到的文件相对路径（Java 记为 BUILD_DIR，Node.js 记为 APP_DIR）
   3. 仍未找到则检查二级子目录：
     - 按照扫描一级子目录的方式扫描二级子目录
5. 如果是混合型项目（Java 和 Node.js 都有），则用户确认确认用哪个语言进行构建（二选一）：
   - **Java** 确认
   - **Node.js** 确认
6. 如果该项目既不是 Java 项目也不是 Node.js 项目，则提示此 skill 不支持该类型项目，建议用户自行配置 CI，并终止执行。

---

## 强制约束

详细约束规则请参考 `references/ci-template-spec.md`：

### 核心约束摘要
- **边界约束**：只生成 CI 阶段（代码构建、Docker 镜像构建、镜像推送），不生成 CD 逻辑（部署、GitOps、ArgoCD、Kubernetes）
- **变量约束**：`HARBOR_REGISTRY`、`HARBOR_USERNAME`、`HARBOR_PASSWORD`、`NPM_REGISTRY` 为平台变量，直接引用；仅使用 `APP_NAME` 表达应用名
- **命令执行约束**：RunCommand 必须使用 `cwd` 参数，script 字段使用多行字符串格式（YAML `|` 符号）
- **用户确认约束**：【强制】生成 CI 配置前必须获取用户对以下关键配置项的确认，未确认不得继续：
  - APP_NAME
  - IMAGE_PATH
  - 镜像版本
  - BUILD_TARGET_DIR（多模块 Maven 项目必须确认产物所在子模块，参考 `references/ci-snippets/java.md` 的「多模块 Maven 项目检测」）
  - 打包命令（Java 项目必须从 `references/ci-snippets/java.md` 的「构建命令选项」中选择，默认选项为带仓库配置的部署命令）

---

## 工作流程

### 创建 CI 或优化 CI

**必须严格按顺序执行以下步骤，不得跳过任何环节**

1. **读取参考文档**：加载所有参考文档
2. **用户确认**：按顺序逐一用下拉框的方式向用户确认以下配置项（必须确认，不得跳过任何环节）
   - **APP_NAME** 确认（读取 pom.xml/package.json，格式错误则退出）
   - **IMAGE_PATH** 确认（规则参考 `references/image-naming-rules.md`）
   - **镜像版本确认**（选项从 `references/internal-base-images.md` 读取）
   - **BUILD_TARGET_DIR** 确认（多模块 Maven 项目自动识别产物子模块后向用户确认，参考 `references/ci-snippets/java.md` 的「多模块 Maven 项目检测」）
   - **打包命令确认**（选项从 `references/ci-snippets/java.md` 和 `references/ci-snippets/nodejs.md` 读取）
3. **生成 CI 配置**：根据用户确认的结果生成 `.gitlab-ci.yml`
4. **执行强制验证**：验证生成的 CI 是否符合所有约束条件
5. **输出结果**：输出完整的 CI 配置、验证报告和使用说明

---

## 参考文档

| 文档路径 | 说明 |
|----------|------|
| `references/internal-base-images.md` | 内部基础镜像白名单（业务类、打包类） |
| `references/image-naming-rules.md` | 镜像命名规则（GitLab-Harbor 映射） |
| `references/ci-template-spec.md` | GitLab CI 模板规范（Runner Tag、触发规则、变量约定等） |
| `references/ci-snippets/java.md` | Java 语言 CI 片段（版本识别、构建脚本） |
| `references/ci-snippets/nodejs.md` | Node.js 语言 CI 片段（版本识别、包管理器选择） |
| `references/ci-snippets/docker.md` | Docker 构建 CI 片段（含 ARG 处理） |
