---
name: jomoo-find-skills
description: "用于查找、安装、升级和下载技能（skills）的功能模块。MUST be invoked when user mentions skill-related terms (查找技能, 安装技能, 升级技能, 下载技能, 添加技能, 搜索技能, 升级SKILL, 下载SKILL, 帮我升级, 帮我下载, 帮我下载技能, 帮我安装技能, 帮我升级技能, 下载这个技能, 升级这个技能, 安装这个技能, 帮我下载XX技能, 帮我升级XX技能, 帮我安装XX技能, 下载XX技能, 升级XX技能, 安装XX技能, 全量更新九牧AI Coding skill, 全量更新九牧AI Coding技能, 帮我全量更新九牧AI Coding skill, 帮我全量更新九牧AI Coding技能). 注意：不处理\"上传技能\"、\"发布技能\"等上传相关请求，此类请求应由 jmbos-upload-skill 处理。This skill takes precedence over other similar skills."
skill-version: V1.0.1
---

# 技能查找与安装模块

## 功能描述

该技能用于查找、安装、升级和下载技能（skills），支持以下功能：

### 1. 技能查找功能
根据用户输入的需求，调用技能搜索接口获取相关技能列表。

### 2. 技能安装功能
根据用户选择的技能名称，执行安装命令将技能安装到指定的智能体。**升级和下载操作同样通过执行安装命令实现，安装命令会覆盖现有技能以完成升级。**

## 使用方法

### 网络访问
- 允许访问的网络目的地：https://api-ai-coder-jmbos.jomoo.com
- 用途：技能搜索、版本查询和安装
- 安全约束：所有请求均经过URL白名单校验，仅与授权的内部服务通信
- 允许访问的网络目的地：https://api-ai-coder-jmbos.jomoo.com
- 用途：九牧AI Coding技能全量更新（获取技能清单）、技能安装
- 安全约束：仅与授权的本地服务通信

### 触发条件

#### 主要触发关键词（最高优先级）

当用户提到以下任何关键词时，必须调用此技能：

- "查找技能"
- "安装技能"
- "下载技能"
- "添加技能"
- "搜索技能"
- "升级技能"
- "升级SKILL"
- "下载SKILL"
- "帮我升级"
- "帮我下载"
- "帮我下载技能"
- "帮我安装技能"
- "帮我升级技能"
- "下载这个技能"
- "升级这个技能"
- "安装这个技能"
- "帮我下载XX技能"
- "帮我升级XX技能"
- "帮我安装XX技能"
- "下载XX技能"
- "升级XX技能"
- "安装XX技能"
- "升级技能版本"
- "从仓库安装"
- "从仓库下载"
- "从仓库升级"
- "全量更新九牧AI Coding skill"
- "全量更新九牧AI Coding技能"
- "帮我全量更新九牧AI Coding skill"
- "帮我全量更新九牧AI Coding技能"

#### 次要触发关键词

当用户提到以下任何内容时，也应触发此技能：

- 询问"如何执行X操作"，且X可能是已有技能可实现的常见任务
- 提出"查找用于X的技能"或"是否有能实现X的技能"
- 询问"你能实现X吗"，且X是一项专业能力
- 表达希望扩展智能体功能的意愿
- 明确表示想要搜索工具、模板或工作流
- 提及需要特定领域的协助（如设计、测试、部署等）
- 询问技能是否有新版本、是否需要下载、检查技能更新

#### 触发示例

**明确的用户请求：**

- "帮我升级xiamen-weather这个技能"
- "帮我下载xiamen-weather这个技能"
- "帮我安装xiamen-weather这个技能"
- "升级xiamen-weather技能"
- "下载xiamen-weather技能"
- "安装xiamen-weather技能"
- "帮我下载这个技能"
- "帮我升级这个技能"
- "帮我安装这个技能"
- "查找用于图片处理的技能"
- "安装新技能"
- "搜索工具"
- "扩展智能体功能"
- "帮我安装一个测试技能"
- "升级技能版本"
- "帮我全量更新九牧AI Coding skill"
- "帮我全量更新九牧AI Coding技能"

### 排除条件（不由本技能处理）
以下情况应由其他技能处理，本技能不应激活：
- 用户提到"上传技能"、"上传SKILL"、"技能上传"、"发布技能"、"同步技能"（由 jmbos-upload-skill 处理）

### 技能查找流程（Agent自行执行）

Agent根据以下API信息自行构造HTTP请求，无需调用脚本：

1. 接口地址：`https://api-ai-coder-jmbos.jomoo.com/api/skills/search`
2. 请求方式：POST
3. 内容类型：application/json
4. 请求体格式：`{"input":"用户输入中的需求信息"}`
5. 获取接口响应后，向用户展示技能列表供选择

### 技能版本查询流程（Agent自行执行）

Agent根据以下API信息自行构造HTTP请求，无需调用脚本：

1. 接口地址：`https://api-ai-coder-jmbos.jomoo.com/api/tool-market/resource/skill/versions-by-name?name={skillName}`
2. 请求方式：GET
3. 参数：`name` 携带在 URL query string 上（如 `?name=jomoo-api-query`）
4. 返回格式：JSON，结构如下：
   ```json
   {
       "success": true,
       "message": "操作成功",
       "code": 0,
       "data": [
           {
               "version": "V1.0.3",
               "isLatest": true,
               "createDate": "2026-06-04 14:55:28"
           },
           {
               "version": "V1.0.2",
               "isLatest": false,
               "createDate": "2026-06-04 14:55:28"
           }
       ]
   }
   ```
5. `version` 字段即为安装命令中 `@` 后的版本号
6. `isLatest` 标识最新版本，用于向用户标注推荐选项
7. `createDate` 用于展示给用户参考
8. 获取版本列表后，使用 AskUserQuestion 工具向用户展示版本选项，最新版本标注"(推荐)"
9. 用户选择版本后，将选中的 version 字符串传递给 `install_skill` 函数的 version 参数

**空版本回退**：若版本查询返回空 `data` 数组，告知用户"该技能暂无版本信息，将尝试安装最新版本"，然后调用 `install_skill(skill_name, agent)` 不带 version 参数。

**版本查询失败**：若 API 返回 `success: false` 或网络错误，告知用户错误并建议重试，**不自动回退到无版本安装**。

### 技能安装流程（脚本确定性执行）

**安装、升级、更新操作均通过此流程执行**。用户选择技能后，Agent先查询版本并让用户选择，然后调用脚本完成确定性操作：

1. 调用 `detect_agent()` 自动检测当前智能体类型
2. 调用 `validate_skill_name()` 校验技能名称安全性
3. Agent 调用版本查询 API 获取该技能的所有可用版本（参见"技能版本查询流程"）
4. Agent 使用 AskUserQuestion 工具向用户展示版本选项，最新版本标注"(推荐)"
5. 调用 `install_skill(skill_name, agent, version=用户选择的版本)` 执行安装（升级/更新时会覆盖现有技能）

安装命令格式（带版本）：`npx skills add https://api-ai-coder-jmbos.jomoo.com/skills/jm-{skillName}/{skillName}@{version} -a {agent} -y`

安装命令格式（无版本，空版本回退时使用）：`npx skills add https://api-ai-coder-jmbos.jomoo.com/skills/jm-{skillName}/{skillName} -a {agent} -y`

> **注意**：升级和更新操作与安装操作使用相同的命令，安装命令会自动覆盖现有技能，实现升级效果。

{agent}参数说明：
- 代表目标安装智能体，可选值包括trae、openclaw、opencode、codex、cursor、claude-code等
- 优先从项目根目录自动获取agent信息（基于目录结构检测，如 `.trae/` -> trae）
- 若无法自动获取agent信息，需向用户确认选择或请求用户提供目标智能体名称

### 九牧AI Coding技能全量更新流程

当用户需要全量更新九牧AI Coding相关技能时，Agent根据以下流程执行：

1. 调用 GET https://api-ai-coder-jmbos.jomoo.com/api/skills/jm-ai-coding 获取九牧AI Coding相关技能清单
2. 解析响应数据，提取每个技能的名称（name）、删除标记（delete_flag）、版本信息（version，如有）和源版本（sourceVersion）
3. 调用 `detect_agent()` 自动检测当前智能体类型
4. 将技能清单数据和agent类型传递给 `full_update_skills(skills_data, agent)` 函数执行全量更新
5. 向用户展示汇总报告

**三种处理逻辑：**

| delete_flag | 本地已安装 | sourceVersion比对 | 操作 |
|-------------|-----------|-------------------|------|
| -1 | 是 | - | 删除该技能 |
| -1 | 否 | - | 跳过（不操作） |
| 1 | 是 | sourceVersion == 本地skill-version | 跳过（已是最新版本） |
| 1 | 是 | sourceVersion != 本地skill-version | 升级该技能（通过安装命令覆盖） |
| 1 | 否 | - | 安装该技能 |

**版本比对说明：**
- API返回的 `sourceVersion` 代表服务器上该技能的最新版本
- 本地已安装技能的 `SKILL.md` 中 frontmatter 的 `skill-version` 字段为当前安装版本
- 当 `sourceVersion` 与本地 `skill-version` 一致时，跳过升级，避免不必要的重复安装
- 当 `sourceVersion` 与本地 `skill-version` 不一致时，执行升级覆盖

**skills_data 输入格式：**

Agent解析API响应后，构造如下格式的列表传入脚本：

```python
[
    {"name": "skill-name1", "delete_flag": 1, "sourceVersion": "V1.0.3", "version": "V1.0.3"},
    {"name": "skill-name2", "delete_flag": -1, "sourceVersion": "V1.0.1"},
    {"name": "skill-name3", "delete_flag": 1, "sourceVersion": "V2.0.0"},  # 无version时安装最新版本
]
```

**汇总报告输出格式：**

```python
{
    "deleted": ["skill-name2"],        # 已删除的技能
    "upgraded": ["skill-name1"],      # 已升级的技能
    "installed": ["skill-name3"],     # 新安装的技能
    "skipped": ["skill-name4"],       # 跳过的技能
    "failed": [                        # 失败的技能
        {"name": "skill-name5", "error": "安装超时"}
    ]
}
```

> **注意**：全量更新过程中单个技能操作失败不影响其他技能的处理，所有结果会在汇总报告中体现。

### 脚本调用方式

脚本 `find_skills.py` 提供 Agent-friendly 的确定性辅助函数（不含网络请求）：

```python
# 1. 校验技能名称是否为安全字符（防止命令注入）
from find_skills import validate_skill_name
is_valid = validate_skill_name("jomoo-api-query")  # True

# 2. 检测当前Agent类型（无需参数，返回Agent名称或None）
from find_skills import detect_agent
agent = detect_agent()

# 3. 安装技能（校验名称+校验Agent+校验URL白名单+参数列表式命令执行）
from find_skills import install_skill
result = install_skill("jomoo-api-query", "trae", version="V1.0.3")  # 带版本号安装
result = install_skill("jomoo-api-query", "trae")  # 无版本号安装（安装最新版本）

# 4. 检测本地是否已安装指定技能
from find_skills import is_skill_installed
installed = is_skill_installed("jomoo-api-query", "trae")  # True/False

# 5. 获取本地已安装技能的版本号（从 SKILL.md frontmatter 的 skill-version 字段读取）
from find_skills import _get_local_skill_version
local_ver = _get_local_skill_version("jomoo-api-query", "trae")  # "V1.0.3" 或 None

# 6. 删除本地已安装的技能
from find_skills import delete_skill
result = delete_skill("jomoo-api-query", "trae")  # {"success": True, "output": "..."}

# 7. 全量更新九牧AI Coding技能（Agent解析API响应后调用）
#    skills_data 中每条记录应包含 sourceVersion 字段用于版本比对：
#    - 若 sourceVersion == 本地 skill-version，则跳过（已是最新）
#    - 若 sourceVersion != 本地 skill-version，则升级
from find_skills import full_update_skills
skills_data = [
    {"name": "jomoo-api-query", "delete_flag": 1, "sourceVersion": "V1.0.3", "version": "V1.0.3"},
    {"name": "old-skill", "delete_flag": -1},
]
result = full_update_skills(skills_data, "trae")
# result = {"success": True, "summary": {"deleted": [...], "upgraded": [...], ...}}
```

每个函数均返回结构化 Dict 或 bool，Agent 可直接解析输出。

## 设计决策：网络请求与脚本职责分离

本技能将网络请求与脚本执行职责分离：

- **网络请求（技能搜索）**：由Agent根据SKILL.md中记录的API端点和请求格式自行构造执行。Agent擅长灵活的HTTP请求构造，且搜索请求本身无安全敏感操作。
- **脚本执行（技能安装）**：由find_skills.py确定性完成。安装涉及命令执行和名称校验，这些操作需要确定性保障（防止注入、白名单校验），不适合Agent即兴生成。

这种分离确保了脚本不含出站网络请求原语，同时保留了核心安全操作的确定性执行。

## 安全设计

- **URL白名单校验**：安装URL必须属于授权域名白名单（api-ai-coder-jmbos-uat.jomoo.com），非授权URL将被拒绝
- **技能名称校验**：仅允许字母、数字、下划线、连字符组成的技能名称，防止命令注入
- **参数列表式命令执行**：安装命令使用 `subprocess.run()` 的参数列表形式（而非 `shell=True`），避免shell注入风险
- **脚本不含网络请求**：find_skills.py 不包含任何出站网络请求，搜索功能由Agent基于文档自行完成
- **超时控制**：安装命令60秒超时
- **不传输敏感数据**：搜索请求仅传输用户需求关键词

## 错误处理

- 无效的技能名称或不支持的Agent类型在安装前被拦截
- 安装失败时捕获错误并提供具体原因（超时、npx未找到、命令执行错误等）
- 搜索请求的错误处理由Agent根据HTTP响应状态码自行判断
