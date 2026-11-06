# Java 语言片段

### CI 脚本调整

| APP_DIR 值 | 构建脚本调整 |
|------------|--------------|
| 空（根目录） | 直接执行 `mvn` 或 `gradle` 命令 |
| `backend/` | 在命令前添加 `cd backend &&` |

### 多模块项目处理

如果在多个目录发现 Java 配置文件，提示用户选择要处理的目录。

## 多模块 Maven 项目检测

### 检测条件

当根目录 `pom.xml` 满足以下条件时，判定为多模块 Maven 项目：
1. `<packaging>` 值为 `pom`（或未指定但存在 `<modules>` 标签）
2. `<modules>` 标签中列出了子模块

### 产物目录自动识别规则

多模块项目中，根目录不会生成 `target/` 目录，实际 JAR 产物在子模块目录下。按以下优先级自动识别产物所在子模块：

| 优先级 | 识别规则 | 说明 |
|--------|----------|------|
| 1 | 子模块 `pom.xml` 中包含 `spring-boot-maven-plugin` | Spring Boot 可执行 JAR 所在模块 |
| 2 | 子模块 `pom.xml` 中 `<packaging>` 为 `jar` 且有 `maven-jar-plugin` | 显式打包 JAR 的模块 |
| 3 | 子模块名匹配 `*-server`、`*-web`、`*-app`、`*-bootstrap`、`*-starter` | 按命名约定识别主应用模块 |
| 4 | 最后一个构建的子模块 | Maven Reactor 构建顺序中最后构建的模块通常是可执行模块 |

**识别结果**：`BUILD_TARGET_DIR` 设为 `<子模块名>/target`，例如 `iscais-service-server/target`。

**无法自动识别时**：提示用户从 `<modules>` 列表中选择产物所在子模块。

### 多模块项目 CI 脚本调整

| 项目结构 | BUILD_TARGET_DIR | artifacts paths | 说明 |
|----------|------------------|-----------------|------|
| 单模块（根目录 pom.xml） | `target` | `target/` | 标准场景 |
| 多模块（根目录 pom.xml packaging=pom） | `<子模块名>/target` | `<子模块名>/target/` | 自动识别或用户选择子模块 |

## Java 版本识别

### 版本读取位置

| 构建工具 | 版本读取字段 | 示例 |
|----------|--------------|------|
| **Maven** | `pom.xml` 中的 `<java.version>` | `<java.version>17</java.version>` |
| **Maven** | `pom.xml` 中的 `<maven.compiler.source>` | `<maven.compiler.source>17</maven.compiler.source>` |
| **Gradle** | `build.gradle` 中的 `sourceCompatibility` | `sourceCompatibility = JavaVersion.VERSION_17` |
| **Gradle** | `build.gradle` 中的 `targetCompatibility` | `targetCompatibility = "17"` |

### 版本匹配规则

| Java 版本 | 打包镜像 | 运行时镜像 | 状态 |
|-----------|----------|------------|------|
| Java 8 | `$HARBOR_REGISTRY/base-ext/maven:3.6.3-openjdk-8-slim` | `$HARBOR_REGISTRY/base-int/java/eclipse-temurin-jre:8u482-b08-jammy` | ✅ 支持 |
| Java 11 | `$HARBOR_REGISTRY/base-ext/maven:3.8.6-openjdk-11-slim` | `$HARBOR_REGISTRY/base-int/java/eclipse-temurin-jre:17-jammy` | ✅ 支持 |
| Java 17 | 暂无 | `$HARBOR_REGISTRY/base-int/java/eclipse-temurin-jre:17-jammy` | ⚠️ 运行时支持 |
| Java 18 | `$HARBOR_REGISTRY/base-ext/maven:3.8.7-openjdk-18-slim` | `$HARBOR_REGISTRY/base-int/java/eclipse-temurin-jre:17-jammy` | ✅ 支持 |
| 其他版本 | 暂无 | 暂无 | ❌ 暂不支持 |

**说明**：其他版本生成 CI 时必须提示用户"当前没有对应 JDK 打包镜像"，不得使用公网镜像或假设内部镜像。

## 构建命令选项

### Maven 构建命令

| 命令 | 说明 | 适用场景 | 默认 |
|------|------|----------|------|
| `mvn clean package -DskipTests` | 清理并打包，跳过测试 | 标准构建场景，快速生成 JAR/WAR | |
| `mvn clean install -DskipTests` | 清理、打包并安装到本地仓库 | 需要本地依赖的多模块项目 | |
| `mvn clean deploy -U -DskipTests` | 清理、打包并部署到远程仓库 | 需要上传到 Maven 私服的场景 | |
| `mvn clean deploy -U -DskipTests -Dmaven.repo.local=/root/.m2/repository -s /root/.m2/settings-jmbos.xml` | 带仓库配置的部署命令 | CI 环境中需要指定 Maven 配置文件 | ✅ |

### 命令参数说明

| 参数 | 说明 |
|------|------|
| `-U` | 更新快照依赖 |
| `-DskipTests` | 跳过测试阶段 |
| `-Dmaven.repo.local=<path>` | 指定本地仓库路径 |
| `-s <settings.xml>` | 指定 Maven 配置文件 |

## build 阶段示例

### 单模块 Maven 项目（JDK 8）

```yaml
build_app:
  stage: build
  image: "$HARBOR_REGISTRY/base-ext/maven:3.6.3-openjdk-8-slim"
  rules:
    - if: '$CI_COMMIT_BRANCH == "develop" || $CI_COMMIT_BRANCH == "test"'
      when: on_success
    - when: manual
  script: |
    mvn -v
    mvn deploy -U -DskipTests -Dmaven.repo.local=/root/.m2/repository -s /root/.m2/settings-jmbos.xml
  artifacts:
    paths:
      - target/
    expire_in: 1 day
```

### 多模块 Maven 项目（JDK 8）

以产物在 `iscais-service-server` 子模块为例：

```yaml
build_app:
  stage: build
  image: "$HARBOR_REGISTRY/base-ext/maven:3.6.3-openjdk-8-slim"
  rules:
    - if: '$CI_COMMIT_BRANCH == "develop" || $CI_COMMIT_BRANCH == "test"'
      when: on_success
    - when: manual
  script: |
    mvn -v
    mvn deploy -U -DskipTests -Dmaven.repo.local=/root/.m2/repository -s /root/.m2/settings-jmbos.xml
  artifacts:
    paths:
      - iscais-service-server/target/
    expire_in: 1 day
```

**注意**：多模块项目中 `mvn` 命令在根目录执行（无需 `cd` 到子模块），Maven Reactor 会自动构建所有子模块。只需将 `artifacts.paths` 和 `BUILD_TARGET_DIR` 指向产物所在子模块目录。

## 引用规则
- **BUILD_TARGET_DIR**：单模块 Java Maven 项目为 `target`，多模块项目为 `<子模块名>/target`，参考 `references/ci-snippets/docker.md`
- **Dockerfile ARG 处理**：参考 `references/ci-snippets/docker.md`
