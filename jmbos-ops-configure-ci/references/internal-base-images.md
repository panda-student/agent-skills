# 业务类基础镜像白名单

在 `.gitlab-ci.yml` 中引用时，优先使用 `$HARBOR_REGISTRY` 替代 registry 实际地址。

| 类型 | 完整镜像 |
| --- | --- |
| Java 17 运行时镜像 | `$HARBOR_REGISTRY/base-int/java/eclipse-temurin-jre:17-jammy` |
| Java 8 运行时镜像 |  `$HARBOR_REGISTRY/base-int/java/eclipse-temurin-jre:8u482-b08-jammy` |
| Node.js 18.16.1 镜像 | `$HARBOR_REGISTRY/base-int/node:18.16.1` |
| Node.js 20.16.0 镜像 | `$HARBOR_REGISTRY/base-int/node:20.16.0-alpine3.20` |
| Node.js 24.15.0 镜像 | `$HARBOR_REGISTRY/base-int/node:24.15.0-alpine3.22` |
| Java 8.5.95 Tomcat 镜像 | `$HARBOR_REGISTRY/base-int/tomcat:8.5.95-jre8` |
| Java 8.5.99 Tomcat 镜像 | `$HARBOR_REGISTRY/base-int/tomcat:8.5.99-jre8` |
| Nginx 静态资源镜像 | `$HARBOR_REGISTRY/base-int/nginx:1.21.4-bullseye` |

## CI 引用形式

**版本匹配规则**：根据项目配置文件中的 Java/Node.js/Nginx等版本自动选择对应版本的基础镜像，没有对应版本号的则选择最接近的版本号，java只能选择java镜像，nodejs只能选择nodejs镜像，tomcat只能选择tomcat镜像，nginx只能选择nginx镜像，没有的直接提示没有该业务的基础镜像，并退出。

# 打包类基础镜像白名单

Node.js 打包镜像复用「业务类基础镜像白名单」中的 Node.js 镜像，以下仅列出 Java 专用打包镜像：

| 类型 | 完整镜像 |
| --- | --- |
| Maven JDK 8 | `$HARBOR_REGISTRY/base-ext/maven:3.6.3-openjdk-8-slim` |  
| Maven JDK 11 | `$HARBOR_REGISTRY/base-ext/maven:3.8.6-openjdk-11-slim` |
| Maven JDK 18 | `$HARBOR_REGISTRY/base-ext/maven:3.8.7-openjdk-18-slim` |

## CI 引用形式

**版本匹配规则**：
- Java 项目：根据配置文件中的 Java 版本自动选择对应的 Maven 打包镜像
- Node.js 项目：使用「业务类基础镜像白名单」中的 Node.js 镜像
