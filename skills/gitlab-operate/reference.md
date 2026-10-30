# GitLab Operate 参考文档

## 项目列表

JPM SOA 项目组（jpmsoa）常见项目：

| 项目名 | GitLab Project ID | 说明 |
|--------|-------------------|------|
| common-core | 5 | 基硎包（common-domain, common-impl, common-jomoo, common-web） |
| plugins-service | 7 | 插件服务（plugins-facade, plugins-impl） |
| gateway | 14 | 网关 |
| project-service | 8 | 项目服务 |
| report-service | 9 | 报表服务 |
| system-service | 10 | 系统服务 |
| timer-service | 11 | 定时任务服务 |
| workflow-service | 12 | 工作流服务 |
| obs-service | 19 | OBS服务 |

> Project ID 从 GitLab API 动态获取，不硬编码

## 依赖关系图

```
common-core ─────────────────────────────────────┐
  ├── common-domain (PO/VO/DTO)                   │
  ├── common-impl (加密jar, 工具类)               │
  ├── common-jomoo                                │
  └── common-web                                  │
       │                                          │
       ▼                                          │
plugins-service ──────────────────────────────────┤
  ├── plugins-facade (接口定义)                    │
  └── plugins-impl                                │
       │                                          │
       ▼                                          │
gateway / system-service / timer-service /         │
workflow-service / report-service /                │
obs-service / project-service                     │
       └──────────────────────────────────────────┘
```

## 动态依赖顺序计算

### 算法

1. 确定变更项目集合（通过 git log / commit 分析）
2. 从变更项目向上追溯所有依赖方
3. 按依赖层级拓扑排序
4. 输出分层部署计划

### 示例

**场景1：common-core 变更**
```
变更：common-core
影响范围：全部服务
部署顺序：common-core → plugins-service → [其余服务并行]
```

**场景2：plugins-service 变更**
```
变更：plugins-service
影响范围：依赖 plugins-facade 的服务
部署顺序：plugins-service → [report-service, workflow-service, gateway, ...]
```

**场景3：仅 workflow-service 变更**
```
变更：workflow-service
影响范围：仅自身
部署顺序：workflow-service（单独部署）
```

## 环境配置

不同环境（dev/uat/prod）使用不同的 Nexus 仓库和部署策略：

| 环境 | Maven Snapshot 仓库 | 加密jar仓库 | 流水线分支 |
|------|---------------------|------------|-----------|
| dev | jpmtest-snapshot | jpm-encry-test | dev |
| uat | jpmuat-snapshot | jpm-encry-uat | uat |
| prod | jpmprod-snapshot | jpm-encry-prod | master |

> 环境名称从流水线的 `$ENV_NAME` 变量获取，不硬编码

## Python 调用示例

### 触发流水线
```python
import json, urllib.request

token = '<from gitlab.yaml>'
base = '<gitlab-url>/api/v4'

url = f'{base}/projects/{project_id}/pipeline'
req = urllib.request.Request(
    url,
    data=json.dumps({'ref': branch}).encode(),
    headers={'PRIVATE-TOKEN': token, 'Content-Type': 'application/json'},
    method='POST'
)
resp = urllib.request.urlopen(req, timeout=10)
pipeline = json.loads(resp.read())
```

### 轮询流水线状态
```python
import time

while True:
    url = f'{base}/projects/{project_id}/pipelines/{pipeline_id}'
    req = urllib.request.Request(url, headers={'PRIVATE-TOKEN': token})
    resp = urllib.request.urlopen(req, timeout=10)
    data = json.loads(resp.read())
    status = data['status']
    if status in ('success', 'failed', 'canceled'):
        break
    time.sleep(20)
```

### 提取作业错误日志
```python
url = f'{base}/projects/{project_id}/jobs/{job_id}/trace'
req = urllib.request.Request(url, headers={'PRIVATE-TOKEN': token})
resp = urllib.request.urlopen(req, timeout=15)
log = resp.read().decode('utf-8', errors='replace')
errors = [l.strip() for l in log.split('\n')
          if '[ERROR]' in l and ('package' in l or 'cannot find symbol' in l)]
```
