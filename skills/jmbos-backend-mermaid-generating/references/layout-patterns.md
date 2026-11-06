# Mermaid 布局模式参考

常用的布局模式模板，需要时查阅本文档。

---

## 架构图模式（分层结构）

```mermaid
graph TB
    subgraph frontend["前端层"]
        Client[客户端应用]
    end

    subgraph gateway["网关层"]
        API[API 网关]
    end

    subgraph app["应用层"]
        CoreBiz[核心业务]
        SvcB[辅助服务]
    end

    subgraph infra["基础设施层"]
        DB[(数据库)]
        Cache[(缓存)]
    end

    %% 核心：使用外层子图 ID 连接
    frontend --> gateway
    gateway --> app
    app --> infra
```

> ⚠️ 架构图有严格约束，详见 [architecture-diagram.md](architecture-diagram.md)

---

## 泳道模式（分组）

适用于不同角色/部门参与的流程。

```mermaid
graph TB
    subgraph lane1["泳道1：用户"]
        A[发起请求] --> B[等待响应]
    end

    subgraph lane2["泳道2：系统"]
        C[处理请求] --> D[返��结果]
    end

    subgraph lane3["泳道3：数据库"]
        E[查询数据]
    end

    B --> C
    D --> E
    E --> B
```

---

## 反馈循环模式

适用于有迭代反馈的场景。

```mermaid
graph TB
    A[开始] --> B[处理]
    B --> C[输出]
    C -.->|反馈| A

    style A fill:#d3f9d8,stroke:#2f9e44
    style B fill:#e5dbff,stroke:#5f3dc4
    style C fill:#c5f6fa,stroke:#0c8599
```

---

## 中心辐射模式

适用于多分支汇聚到中心的场景。

```mermaid
graph TB
    Central[中心节点]

    A[分支1] --> Central
    B[分支2] --> Central
    C[分支3] --> Central
    Central --> D[输出]
```

---

## 决策树模式

适用于多分支选择的场景。

```mermaid
graph TB
    Start[开始] --> Decision{判断?}
    Decision -->|选项A| PathA[路径A]
    Decision -->|选项B| PathB[路径B]
    Decision -->|选项C| PathC[路径C]

    PathA --> End[结束]
    PathB --> End
    PathC --> End
```

---

## 对比布局模式

适用于方案对比、前后对比等场景。

```mermaid
graph TB
    Title[对比]

    subgraph left["方案 A"]
        A1[特点1]
        A2[特点2]
        A3[特点3]
    end

    subgraph right["方案 B"]
        B1[特点1]
        B2[特点2]
        B3[特点3]
    end

    Title --> left
    Title --> right

    subgraph compare["关键差异"]
        Diff[差异总结]
    end

    left --> compare
    right --> compare
```

---

## 混合布局模式（外层纵向 + 子层横向）

适用于某一层内有多个并行组件的场景。

```mermaid
graph TB
    subgraph FE["前端层"]
        direction LR
        Web[Web端] ~~~ App[App端] ~~~ Mini[小程序]
    end

    subgraph GW["网关层"]
        Gateway[API网关]
    end

    subgraph APP["应用层"]
        direction LR
        Order[订单服务] ~~~ User[用户服务] ~~~ Pay[支付服务]
    end

    subgraph INFRA["基础设施层"]
        direction LR
        DB[(数据库)] ~~~ Cache[(缓存)]
    end

    %% 外层保持纵向连接
    FE --> GW --> APP --> INFRA
```

**用法说明**：
- 外层主方向：`graph TB`（纵向层级关系）
- 子图内部：`direction LR`（横向排列同层节点）
- 分隔同层节点：使用 `~~~`（不可见连线）保持间距

⚠️ **防折行天条**：在 `direction LR` 的子图中，必须用 `~~~` 串联所有节点，单行写完，禁止换行。