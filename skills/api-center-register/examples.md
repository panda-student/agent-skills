# api-center-register 操作案例与脚本

> 本文件收纳**本次会话已验证通过**的实际操作脚本、命令和避坑案例，下次复用直接套用。所有命令均在 **Windows PowerShell 5.1 + curl.exe 8.x** 验证通过。

---

## 案例 1：Nacos pms-dev gateway.yaml 追加 `/pms/<模块>/**` 专用白名单（规则C）

**场景**：接口已注册上架、服务端部署完成、但服务网关免 token 直连返回 401。决定走规则C（不改代码、不改注册地址、仅追加白名单）。

> 凭据准备见 [reference.md §9「凭据准备」](./reference.md#9-nacos-config-白名单读写操作手册)；下文使用 `$nacosUser` / `$nacosPass` 变量，不写明文。

**Step 1 — 读当前 YAML 保存本地**：
```powershell
$yamlPath = ".claude/tmp/gateway_pms-dev_before.yaml"
curl.exe -s "http://10.1.12.33:36032/nacos/v1/cs/configs?dataId=gateway.yaml&group=DEFAULT_GROUP&tenant=pms-dev&username=$nacosUser&password=$nacosPass" | Out-File -Encoding UTF8 -Force $yamlPath
# 确认白名单区域存在（一般在 emop.auth.exclude-path-patterns 下）
Get-Content $yamlPath | Select-String -Pattern "exclude-path-patterns" -Context 0,8
```

**Step 2 — 追加新 pattern**：
```powershell
# 打开 $yamlPath，找到 emop.auth -> exclude-path-patterns: 的最后一行（类似 `- /pms/pms/**`），在它下面手动加一行：
#          - /pms/<模块>/**
# 注意缩进！前面是 9 个空格 + "- " 开头（和上面的条目完全一致）。保存。
#
# 或用 Edit 工具（推荐，避免手改缩进错误）：将
#   "         - /pms/pms/**"
# 替换为
#   "         - /pms/pms/**\n         - /pms/<模块>/**"
```

**Step 3 — multipart 上传（⚠️ 禁止 --data-urlencode）**：
```powershell
$result = curl.exe -s -X POST "http://10.1.12.33:36032/nacos/v1/cs/configs" `
  -F "dataId=gateway.yaml" `
  -F "group=DEFAULT_GROUP" `
  -F "tenant=pms-dev" `
  -F "type=yaml" `
  -F "username=$nacosUser" `
  -F "password=$nacosPass" `
  -F "content=@$yamlPath"
# $result 必须是 true；如果是 false，检查上面的 -F 参数有没有拼错字段。
Write-Output "写入返回：$result"
```

**Step 4 — 必须回读验证**：
```powershell
Start-Sleep 2
$back = curl.exe -s "http://10.1.12.33:36032/nacos/v1/cs/configs?dataId=gateway.yaml&group=DEFAULT_GROUP&tenant=pms-dev&username=$nacosUser&password=$nacosPass"
if ($back -match "/pms/<模块>/**") {
    "✅ 写入生效"
} else {
    "❌ 未生效，检查 Step 2 缩进或 Step 3 -F 参数是否正确"
}
```

**Step 5 — 网关刷新测试**：
```powershell
Start-Sleep 12   # Nacos Config 推送时延通常 10~20 秒
curl.exe -s -w "`nHTTP:%{http_code}" -X POST "https://api-test-pms.jomoo.com/pms/pms-service/pms/<模块>/<接口>" `
  -H "Content-Type: application/json;charset=UTF-8" -d "[]"
# 若 HTTP 状态从 401 变成 200/400/5xx（非401）= 白名单生效 ✅
```

**本次会话真实成功案例（2583 离职预警）**：将 `resignWarning` 代入 `<模块>`，完整流程后空数组返回 200 + code=1001 参数不能为空（非401 ✅）。

**收尾**：验证通过后删除临时凭据文件 `Remove-Item "$env:TEMP\vault-nacos-cred.tmp" -Force`。

---

## 案例 2：PowerShell + curl.exe 发送含中文的 JSON body

**问题**：Windows PowerShell 5.1 用 `curl.exe -d '{"name":"中文"}'` 提交时，中文字符会被 PowerShell 按本地代码页（GBK/CP936）传给 curl，后端收到的是乱码，Spring `MappingJackson2HttpMessageConverter` 反序列化失败报 **400 Bad Request**。

**✅ 正确做法：写 UTF-8 文件 + `--data-binary @<file>`**：
```powershell
# Step 1. 用 UTF-8 BOMless 写入 JSON 文件
$jsonBytes = [System.Text.Encoding]::UTF8.GetBytes('[{"processNo":"VERIFY-001","employeeNo":"80012345","employeeName":"张三","processName":"员工离职申请流程","expectLeaveDate":"2026-09-30"}]')
[System.IO.File]::WriteAllBytes("$env:TEMP\verify_body.json", $jsonBytes)

# Step 2. --data-binary @文件 发送（-d 不要用，会 strip 换行并触发编码）
curl.exe -s -w "`nHTTP:%{http_code}" -X POST "https://api-test-pms.jomoo.com/pms/pms-service/pms/resignWarning/receive" `
  -H "Content-Type: application/json;charset=UTF-8" `
  --data-binary "@$env:TEMP\verify_body.json"
```

**对比实验结论（本次会话实测）**：
| 写法 | HTTP | 结果 |
|---|---|---|
| `-d` + 字面量含中文（PowerShell 5.1） | 400 Bad Request | Spring 反序列化失败 ❌ |
| `--data-binary @<utf8-file>` | 200 AjaxResult | 正常入库 ✅ |

---

## 案例 3：API 中心「请求路径」字段创建后无法修改 — 方案A 失败 vs 方案B1 成功

**背景**：2583（PMS 接收离职信息）已创建并上架，注册地址为 `/pms/pms-service/pms/resignWarning/receive`（单段 pms）。后来想走规则B（双段 pms 复用 `/pms/pms/**` 白名单），于是：

### ❌ 方案A（失败）：
- 后端 Controller：`@RequestMapping("/resignWarning")` → 改 `/pms/resignWarning`
- API 中心：编辑 2583，手动在「请求路径」框里把路径改成双段，点保存
- 实际结果：
  1. 浏览器自动化设置 input value 后保存
  2. 回读发现「请求路径」仍是原来的值 — 因为该字段带 `disabled` 属性，后端保存接口会忽略它
  3. 后端改了映射但注册地址没变，造成 API 中心在线测试调 `/pms/resignWarning/receive`（老路径）→ 代码映射 `/pms/resignWarning`（加了前缀）→ 404
  4. 方案A无法落地。**教训：请求路径 disabled + 后端代码改了也没意义，必须两件事同时改对但 API 中心做不到。**

### ✅ 方案B1（成功，走规则C）：
- 后端 Controller：**不动**，回滚到 `@RequestMapping("/resignWarning")`
- API 中心：**不动**，2583 继续用创建时的单段 pms 地址
- 只改一个地方：**Nacos gateway.yaml 追加 `- /pms/resignWarning/**` 专用白名单**
- 实际结果：
  1. 空数组请求 → 网关 401 → 加白名单 15 秒后 → 返回 **HTTP 200 + AjaxResult(code=1001 参数不能为空)** ✅
  2. 合法条目 → HTTP 200 + `success=true` → `t_pms_resign_warning` 表查出 `WHITELIST-OK-002` 记录 ✅
  3. API 中心在线测试（同样的请求体，同 processNo）→ 返回 **200 success=true** 同样入库 ✅
  4. 代码和注册信息都没动，只改了网关配置，成本最低、风险最小。

**经验总结**：只要接口已经创建过并上架了，一律走方案B1（专用白名单），别再尝试改请求路径。

---

## 案例 4：4 层闭环验证（用同一 processNo 跑一遍所有验证步骤）

```
目标：验证 2583 离职接口全链路打通
请求体：{"processNo":"FULL-CHECK-001","employeeNo":"80012345",...}

Step 1 — 网关层穿透（B-1）：
  curl 无 token POST https://api-test-pms.jomoo.com/pms/pms-service/pms/resignWarning/receive
  ✅ 返回 HTTP 200 + success:true

Step 2 — 服务容器到达（B-2）：
  浏览器自动化 -> Rancher Pod 日志面板或 K8s API tailLines=500
  ✅ 发现 "request:POST /pms/resignWarning/receive" 时间戳吻合

Step 3 — 数据库落库（B-3）：
  SELECT * FROM t_pms_resign_warning WHERE process_no = 'FULL-CHECK-001'
  ✅ 1 行，employee_no=80012345、created_time ≈ 测试时刻

Step 4 — API 中心同报文（B-4）：
  API 中心 2583 行 -> 在线测试 -> 同请求体 -> 发送
  ✅ HTTP 200，同 FULL-CHECK-001（若因幂等返回 duplicate=1003 也通过，说明同一 processNo 幂等生效）
```

若 Step 1 还是 401 → 不要继续，先回 Step 1 查白名单是否写对；
若 Step 1 过了但 Step 3 没记录 → 是代码/部署问题（代码改了但部署的是旧版本 jar 的概率最高）。

---

## 案例 5：2695 PMS 项目变更结果回写 —— 零污染在线调试三步序列（GPM 环境）

**场景**：2695「PMS项目变更结果回写」已注册已上架，需在 API 中心完成在线调试（写接口，环境为 GPM/plugins-service 体系，与案例 1~4 的 PMS 体系地址不同）。

### 5.0 环境实锤（先于一切 DB 操作）

门户虽是 UAT、域名为 `jpm-test.jomoo.cn`，但按坑16 四步证据链实锤后端实际连 **SIT 库**：

1. Nacos `172.17.95.173:32265` 命名空间 `gpm-jomoo-dev` 的 `common.yaml`：数据源 username=`jomoogpm_dev`（`172.17.95.157:1521:tc11test`）。
2. 空体 `{}` POST `/api/plugins/api-center/pms-project/change` 返回**业务 400「changeId不能为空」** → 白名单 `/api/plugins/api-center/` 已放行 + 新代码已部署。
3. 用仅 SIT 存在的项目 `MJTABM2025080800460`（ID `7a9f5cde-e5de-472a-b4fb-d5e53fd2210e`）发 INFO+空 mainInfo，返回 200 且 projectId 正是该 SIT ID。
4. JDBC 回查 SIT 审计表 `T_PSM_PMS_CHANGE_APPLY` 已有该探测的 SUCCESS 行。

结论：全程只在 jomoogpm_dev 操作，**未对 JOMOOGPM_UAT 执行任何 SQL**（该 schema 缺表留给真正 UAT 部署时执行建表脚本）。

### 5.1 行级定位并打开 2695 测试面板

固定坐标 top=360 曾误开相邻的 2593（预置工号数组）。改为先量行 top（2695 行 dropdown top≈317），按容差匹配点击（脚本见 reference §4.5.1）。打开后读 Ace 编辑器 0 确认预置的是 2695 示例（changeId `a1b2c3d4-...`）。

### 5.2 三步报文与真实响应

面板报文填写（Ace API）与执行：

```javascript
// 填报文（dialog[2] 的第 0 个 ace_editor）
var payload = {
  "changeId": "apict-20260917-01",
  "projectCode": "MJTABM2025080800460",
  "changeTypes": ["INFO"],
  "operatorId": "10346409",
  "occurTime": "2026-09-17 15:30:00",
  "mainInfo": { "projectName": "HQQ测试使用-注塑模-联调测试0917" }
};
var d=document.querySelectorAll('.bosui-dialog')[2];
window.ace.edit(d.querySelectorAll('.ace_editor')[0]).setValue(JSON.stringify(payload,null,2), -1);
// 点面板内文本为「执行」的可见按钮，等待约 6 秒后读编辑器 1
window.ace.edit(d.querySelectorAll('.ace_editor')[1]).getValue();
```

| 步骤 | changeId | 真实响应 | executionTime |
|---|---|---|---|
| ① 改名 | apict-20260917-01 | `{"code":200,"data":{"changeId":"apict-20260917-01","idempotent":false,"projectId":"7a9f5cde-..."}...,"traceId":"21851aba-..."}` | 114ms |
| ② 同报文重放（编辑器不动直接再点执行） | 同 01 | 200，**idempotent=true** | **7ms**（短路） |
| ③ 还原（刷新页面重开全新面板） | apict-20260917-02，projectName 改回 `HQQ测试使用-注塑模` | 200，idempotent=false | 108ms |

**坑14 实录**：③最初在②的旧面板直接 setValue 成 02 报文后执行，响应竟返回 01 的 idempotent=true——提交模型未同步。navigate 刷新 → 行级定位重开面板 → 只填一次执行一次，立即返回 02 的正确响应。

### 5.3 JDBC 回查（每步必查）

```sql
-- ① 后：名称已变更 + SUCCESS 留痕
SELECT CODE, NAME FROM T_PSM_PJT WHERE ID = '7a9f5cde-e5de-472a-b4fb-d5e53fd2210e';
-- MJTABM2025080800460 | HQQ测试使用-注塑模-联调测试0917
SELECT CHANGEID, STATUS FROM T_PSM_PMS_CHANGE_APPLY WHERE CHANGEID = 'apict-20260917-01';
-- apict-20260917-01 | SUCCESS | 15:32:25

-- ② 后：COUNT 仍为 1，名称无二次变化（幂等未重复落库）

-- ③ 后最终核对
SELECT CODE, NAME FROM T_PSM_PJT WHERE ID = '7a9f5cde-e5de-472a-b4fb-d5e53fd2210e';
-- MJTABM2025080800460 | HQQ测试使用-注塑模   ← 零残留
SELECT CHANGEID, STATUS, TO_CHAR(CREATEDTIME,'YYYY-MM-DD HH24:MI:SS') CT
FROM T_PSM_PMS_CHANGE_APPLY
WHERE CHANGEID IN ('apict-20260917-01','apict-20260917-02') ORDER BY CREATEDTIME;
-- 01 SUCCESS 15:32:25 / 02 SUCCESS 15:37:36
```

### 5.4 4 层闭环结论

- B-1 网关穿透：裸调返回业务 200/400 非 401 ✅
- B-2 后端到达：Rancher 需独立登录无会话，采用降级证据——响应含后端生成的 traceId/executionTime/正确 projectId/idempotent 标志，且审计行与请求秒级吻合 ✅（正式交付建议补日志）
- B-3 入库：名称两次按报文变更、审计 ①③ 两条 SUCCESS、重放零重复 ✅
- B-4 一致性：面板与裸 curl 同信封同入库效果 ✅
- 收尾：临时探测 SQL/JSON 与 Nacos 导出 yaml 全部删除。
