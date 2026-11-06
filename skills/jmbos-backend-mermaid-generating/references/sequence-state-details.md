# Mermaid 时序图与状态图语法

时序图和状态图的专用语法规则。这两种图有自己的语法体系，与流程图不同。

## 目录

1. [时序图语法](#时序图语法)
2. [状态图语法](#状态图语法)

---

## 时序图语法

时序图有自己的语法，跟流程图不一样。

### 基本结构

```
sequenceDiagram
    participant A as 角色A
    participant B as 角色B

    A->>B: 发消息
    B-->>A: 回消息
```

### 箭头类型

| 写法 | 含义 |
|-----|------|
| `->>` | 实线箭头，发请求 |
| `-->>` | 虚线箭头，回响应 |
| `-x` | 失败 |
| `-)` | 异步 |

### 激活框

```
sequenceDiagram
    A->>B: 请求
    activate B
    B-->>A: 响应
    deactivate B

    # 或简写
    A->>+B: 请求
    B-->>-A: 响应
```

### 循环和条件

```
sequenceDiagram
    loop 每分钟
        A->>B: 心跳
    end

    alt 成功
        B-->>A: 确认
    else 失败
        B-->>A: 错误
    end
```

### 注释

```
sequenceDiagram
    A->>B: 请求
    Note over A,B: 这是两个角色之间的注释
    Note right of B: 这是 B 右边的注释
```

---

## 状态图语法

### 基本写法

```
stateDiagram-v2
    [*] --> 待处理
    待处理 --> 处理中: 开始
    处理中 --> 已完成: 成功
    处理中 --> 失败: 出错
    已完成 --> [*]
    失败 --> [*]
```

`[*]` 是开始和结束的标记。

### 复合状态

```
stateDiagram-v2
    [*] --> 运行中
    state 运行中 {
        [*] --> 子状态1
        子状态1 --> 子状态2
        子状态2 --> [*]
    }
    运行中 --> [*]
```

### 状态样式

```
stateDiagram-v2
    [*] --> 状态A
    状态A --> 状态B

    state "带空格的状态" as stateA
    state 状态A ::notice
```

### 并发状态

```
stateDiagram-v2
    [*] --> 并发状态

    state 并发状态 {
        [*] --> 分支A
        [*] --> 分支B
        branchA --> [*]
        branchB --> [*]
    }
```

---

## 注意事项

- 时序图不支持 `<br/>` 换行
- 状态图的复合状态嵌套不要太深
- 两种图都不支持 style 语法（与流程图不同）
- 状态图用 `stateDiagram-v2` 而非 `stateDiagram`（新版语法更稳定）