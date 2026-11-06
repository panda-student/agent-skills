# Mermaid 常用模板参考

常用图表类型的模板代码，需要时查阅本文档。

---

## 架构图模板

```mermaid
graph TB
    subgraph FE["前端层"]
        Client[客户端]
    end
    subgraph GW["网关层"]
        API[API 网关]
    end
    subgraph APP["应用层"]
        Biz[核心业务]
    end
    subgraph INFRA["基础设施层"]
        DB[(数据库)]
    end

    %% 核心：使用外层子图 ID 连接
    FE --> GW --> APP --> INFRA

    style FE fill:#e7f5ff,stroke:#1971c2,stroke-width:2px
    style GW fill:#ffe8cc,stroke:#d9480f,stroke-width:2px
    style APP fill:#e5dbff,stroke:#5f3dc4,stroke-width:2px
    style INFRA fill:#fff4e6,stroke:#e67700,stroke-width:2px
```

> ⚠️ 架构图有严格约束，详见 [architecture-diagram.md](architecture-diagram.md)

---

## 流程图模板

```mermaid
graph TB
    A[开始] --> B[处理]
    B --> C{判断}
    C -->|是| D[操作1]
    C -->|否| E[操作2]
    D --> F[结束]
    E --> F

    style A fill:#d3f9d8,stroke:#2f9e44
    style F fill:#c5f6fa,stroke:#0c8599
```

---

## 时序图模板

```mermaid
sequenceDiagram
    participant 用户
    participant 系统
    participant 数据库
    用户->>系统: 发起请求
    系统->>数据库: 查询数据
    数据库-->>系统: 返回结果
    系统-->>用户: 响应
```

---

## 状态图模板

```mermaid
stateDiagram-v2
    [*] --> 待处理
    待处理 --> 处理中: 开始处理
    处理中 --> 已完成: 处理成功
    处理中 --> 失败: 处理出错
    已完成 --> [*]
    失败 --> [*]
```

---

## 思维导图模板

```mermaid
mindmap
  root((核心主题))
    分支1
      子分支1-1
      子分支1-2
    分支2
      子分支2-1
      子分支2-2
    分支3
```

---

## 循环图模板

```mermaid
graph TB
    subgraph Loop["迭代循环"]
        direction TB
        A[规划] --> B[执行]
        B --> C[检查]
        C --> D[改进]
        D -.->|下一轮| A
    end
```

---

## 对比图模板

```mermaid
graph TB
    Title[对比]

    subgraph left["方案 A"]
        A1[特点1]
        A2[特点2]
    end

    subgraph right["方案 B"]
        B1[特点1]
        B2[特点2]
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

## 决策树模板

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

## ER 图模板

```mermaid
erDiagram
    JM_EMPLOYEE_INFO["JM_EMPLOYEE_INFO(员工信息表)"] {
        int id PK
        varchar name
        int department_id FK
    }
    ORG_DEPARTMENT["ORG_DEPARTMENT(部门表)"] {
        int id PK
        varchar dept_name
    }
    JIS_COMMUNITY_POST["JIS_COMMUNITY_POST(社区帖子表)"] {
        int id PK
        varchar title
        int author_id FK
        int column_id FK
    }
    JIS_COMMUNITY_COLUMN["JIS_COMMUNITY_COLUMN(专栏表)"] {
        int id PK
        varchar column_name
        int manager_id FK
    }
    JIS_COMMUNITY_CATEGORY["JIS_COMMUNITY_CATEGORY(帖子分类表)"] {
        int id PK
        varchar category_name
    }

    %% 关系定义
    JM_EMPLOYEE_INFO ||--o{ JIS_COMMUNITY_POST : "创建"
    JM_EMPLOYEE_INFO ||--o{ JIS_COMMUNITY_COLUMN : "负责"
    JM_EMPLOYEE_INFO }|--|| ORG_DEPARTMENT : "所属"
    JIS_COMMUNITY_POST }|--|| JIS_COMMUNITY_CATEGORY : "归属"
    JIS_COMMUNITY_POST }o--|| JIS_COMMUNITY_COLUMN : "属于"
    JIS_COMMUNITY_COLUMN }|--|| JIS_COMMUNITY_CATEGORY : "归属"
    JIS_COMMUNITY_COLUMN ||--o{ JIS_COMMUNITY_POST : "包含"
```

> **ER 图规则：**
> - 表名统一加中文备注后缀：`表名(中文备注)`
> - 关系标签可根据业务场景使用：创建、属于、负责、包含、归属等

---

## 甘特图模板

```mermaid
gantt
    title 项目开发计划
    dateFormat YYYY-MM-DD
    excludes weekends

    section 准备阶段
    需求分析     :done, req1, 2024-01-01, 3d
    技术方案     :done, tech1, after req1, 2d

    section 开发阶段
    后端开发     :backend, after tech1, 10d
    前端开发     :frontend, after tech1, 10d
    接口联调     :active, api1, after backend, 3d

    section 测试上线
    功能测试     :test1, after api1, 5d
    上线部署     :milestone, deploy, after test1, 0d
```

> **甘特图规则：**
> - 日期格式必须统一：`dateFormat YYYY-MM-DD`
> - 任务使用简短ID：`req1`, `backend`
> - 状态标签：`done`（已完成）、`active`（进行中）、`crit`（关键路径）、`milestone`（里程碑）
> - 依赖关系使用 `after taskId`

---

## 饼图模板

```mermaid
pie title 部门预算占比
    "产品研发" : 45
    "市场推广" : 25
    "人力成本" : 15
    "基础设施" : 10
    "其他" : 5
```

> **饼图规则：**
> - 数据项控制在 3-8 个，超过时合并为"其他"
> - 标签简洁，8字以内
> - 数值会自动计算百分比，无需手动换算
> - 按从大到小排序更清晰

---

## 类图模板

```mermaid
classDiagram
    %% 继承关系
    Animal <|-- Dog
    Animal <|-- Cat

    %% 实现关系
    PaymentInterface <|.. Alipay
    PaymentInterface <|.. WechatPay

    %% 关联关系
    User "1" --> "*" Order : 下单
    Order "1" *-- "1..*" OrderItem : 包含

    class Animal {
        <<abstract>>
        +String name
        +eat()
        +sleep()
    }

    class Dog {
        +bark()
    }

    class PaymentInterface {
        <<interface>>
        +pay(amount)
    }

    class User {
        +String userId
        +String username
        +login()
    }

    class Order {
        +String orderId
        +BigDecimal totalAmount
        +pay()
        +cancel()
    }
```

> **类图规则：**
> - 可见性：`+` public, `-` private, `#` protected, `~` package
> - 关系符号：`<|--` 继承, `<|..` 实现, `-->` 关联, `*--` 组合, `o--` 聚合, `..>` 依赖
> - 多重性：在关系两端标注 `"1"`, `"*"`, `"0..1"`, `"1..*"`
> - 构造型：`<<interface>>`, `<<abstract>>`, `<<service>>`, `<<entity>>`