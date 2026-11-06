---
name: jmbos-qa-generating-api-automation
description: "根据接口文档生成并验证 pytest 接口自动化脚本。适用于\"新增接口自动化\"\"补齐接口测试\"场景。"
skill-version: V1.0.1
---

根据用户提供的接口信息，在 AutomationTest 项目中按既有规范落地接口自动化代码，执行验证，并自动管理迭代工作区覆盖清单与全局清单差异比对。

## 工作流

0. 项目上下文加载。
- **必须首先读取** `AutomationTest/project.md` 获取项目骨架知识，之后仅按需读取目标 project/module 的目录、已有实现、环境配置、覆盖清单等动态数据，禁止全量扫描项目。

1. 严格遵循 [api-automation-llm-spec.md](references/api-automation-llm-spec.md)。
- 不改变原有分层、编码规则、配置规则、fixture 规则、执行命令和验收口径。

2. 核心要求。
- 目录必须按 `project/module` 划分，不允许只按项目平铺。
- 按分层实现：`config -> base/api/read_config -> base/api/client -> common_projects/api/{project}/{module} -> cases/api/{project}/{module}`。
- 默认运行环境为 `test`。
- 生成后必须执行验证，不允许只给方案不落地。

3. 输入约束。
- 仅基于用户当前任务中显式提供的接口信息执行。
- 若用户未明确 `project`，必须中断并要求用户补充。
- 若用户未明确 `module`，按原流程自动推断；推断失败时选最匹配模块落地。
- 若用户未提供测试用例负责人，必须中断并要求用户补充。
- 输入可包含：
  - `project`
  - `module`
  - 接口文档文本
  - `curl`
  - swagger 地址
  - 接口定义文件
  - 需求文档或接口文档的文件路径
  - 测试用例负责人
  - 期望测试点

4. 迭代工作区解析。
- 若用户提供的需求文档或接口文档有文件路径，需自动解析该路径所属的迭代工作区目录。
  - 解析规则：从文件路径中匹配 `ai_workspace/01.产品迭代工作区/{YYYYMMDD-迭代名称}/` 模式，提取迭代目录。
- 若无法从路径判断所属迭代（如用户仅提供接口文档文本、curl 等无路径信息），必须中断并询问用户当前处于哪个迭代工作区。
  - 询问时列出 `ai_workspace/01.产品迭代工作区/` 下所有已有迭代目录供用户选择。
- 迭代目录确定后，后续覆盖清单操作均基于该迭代目录。

5. 接口解析与复用。
- 若用户提供的是 swagger 地址，需支持解析自动提取接口信息。
- 若一次输入包含多个接口，需分别处理。
- 必须识别：method、path、headers、query/body/path 参数、鉴权方式、预期响应。
- 必须从接口文档文本、`curl` 或接口定义文件中提取可复用参数与断言线索。
- 优先搜索该 `project/module` 下已有实现；若已有同类接口，沿用同风格扩展，不重复造轮子。

6. 全局清单差异比对。
- 通过 `ai_workspace/02.产品知识图谱/4.测试/索引.md` 中 `自动化测试覆盖清单/API自动化/` 部分定位目标 project_module 的全局清单文件（命名格式：`api_{project}_{module}_coverage.md`，按 `{project}/{module}/` 目录存放），直接读取该文件；若索引中无对应记录，视为全新项目或模块，所有接口均为新增。
- 差异匹配逻辑：按 **接口路径 + 功能模块** 匹配。
  - 若全局清单中已存在相同接口路径且功能模块匹配的记录，判定为 **修改已有自动化**，沿用并扩展现有封装和用例。
  - 若全局清单中无匹配记录，判定为 **新增接口自动化**，按规范新建封装和用例。
- 比对结果需在执行过程中明确提示用户：哪些接口是新增、哪些是修改。

7. 缺失即补齐。
- 若项目层缺失，补：
  - `config/{project}/api_{project}_test.yaml`
  - `base/api/{project}/api_{project}_read_config.py`
  - `base/api/{project}/api_{project}_client.py`
- 若补齐项目层所需信息缺失，如接口 URL、账号密码、鉴权配置，则中断并要求用户补充后再继续。
- 在模块层新增：
  - `common_projects/api/{project}/{module}/{api_name}.py`
  - `cases/api/{project}/{module}/test_{api_name}.py`
  - 必要时 `cases/api/{project}/{module}/conftest.py`

8. 用例设计要求。
- 至少包含：
  - 1 个成功场景
  - 1 个关键失败场景
- 用例设计必须以业务场景为中心，不能退化成"单接口 + 响应码断言"的简单用例。
- 若接口有增删改：
  - 使用 fixture + `yield` 做数据清理
  - 加 `@pytest.mark.skip_prod`

9. 迭代覆盖清单管理。
- 自动化脚本生成并执行验证通过后，必须在目标迭代工作区目录下生成或更新覆盖清单。
- 清单按 `project/module` 拆分为独立文件，与代码目录分层保持一致。
- 清单位置：`{迭代目录}/4.测试/自动化测试/API/{project}/{module}/api_{project}_{module}_coverage.md`。
- 清单格式与字段定义遵循 [coverage-template.md](references/coverage-template.md)。
- 同一迭代内每次生成自动化脚本后，必须增量更新该清单，不允许覆盖已有记录。
- 更新规则：
  - 新增接口：追加新行。
  - 修改接口：更新对应行（按接口路径 + 功能模块匹配），保留原创建时间，追加修改日期。
- 若清单文件不存在，则新建并按模板格式填写。

10. 执行验证。
- 默认命令：
  - `python -u run_api_test.py -e test -d cases/api/{project}/{module} -s 1 -clr 1`
- 默认test环境，若用户指定环境，如 `uat`，则替换 `-e test` 为 `-e uat`。
- 若失败：先修复再重跑一次。
- 若修复后仍失败，先判断错误类型：
  - 若为断言失败（如响应体字段缺失/值错误），需检查用例是否覆盖了所有场景。
  - 若为系统错误（如接口超时/连接失败），需检查环境是否正常。
  - 若为业务逻辑错误（如返回错误码/提示），需检查业务逻辑是否正确。
  - 若为代码错误（如语法错误/逻辑错误），需检查代码是否正确。
- 最多修复 5 次，若仍失败，需人工检查。


## 资源

- 项目骨架知识：`AutomationTest/project.md`（分层架构、编码模式、技术栈、Marker 体系、运行方式等，优先读取此文件替代稳定基础设施源码）
- 编码与目录规范：[api-automation-llm-spec.md](references/api-automation-llm-spec.md)
- 覆盖清单模板：[coverage-template.md](references/coverage-template.md)

## 输出约定

完成任务时，最终回答至少包含：
- 本次新增/修改文件清单（按 `project/module` 展示）
- 关键实现说明
- 差异比对结果（新增/修改的接口列表）
- 覆盖清单更新摘要（含清单文件路径）
- 执行命令与结果摘要
- 若有失败：定位结论、已修复项、剩余风险
- 全局清单同步提示（如需）
