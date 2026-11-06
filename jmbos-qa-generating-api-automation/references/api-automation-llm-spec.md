# 接口自动化编写规范（AutomationTest项目）

## 1. 适用范围
用于本项目 `cases/api` 下接口自动化脚本生成，技术栈固定为：`pytest + allure + ujson + common.httpclient.DoRequest + common.hamcrest.assert_that`。

## 2. 目录与分层（必须遵守）
分层原则：先按 `project` 划分，再按 `module` 划分（至少一级模块）。

1. `config/{project}/api_{project}_{env}.yaml`（项目公共配置）
2. `config/{project}/{module}/api_{project}_{module}_{env}.yaml`（模块独立配置，可选）
3. `base/api/{project}/api_{project}_read_config.py`
4. `base/api/{project}/api_{project}_client.py`
5. `common_projects/api/{project}/{module}/{api_name}.py`
6. `cases/api/{project}/{module}/test_*.py`
7. `cases/api/{project}/{module}/conftest.py`（按需）

说明：
- 若模块较大，可继续子模块化：`{module}/{submodule}`。
- 禁止把不同模块接口混写在同一个 `test_*.py` 中。

## 3. 强制编码规则（MUST）
1. 用例层禁止直接 `requests`，只能调用 `common_projects` 接口封装类。
2. 断言统一使用 `from common.hamcrest.hamcrest import assert_that`，禁止裸 `assert`。
3. 响应解析统一 `ujson.loads(result.body)`。
4. 每个测试类、测试方法必须有：
   - 用例标题标记：`@allure.title("中文用例标题")`
   - 测试负责人标记：`@allure.label("owner", "负责人工号：负责人姓名")`
   - 项目标记：如 `@pytest.mark.dhr`
   - 服务标记：如 `@pytest.mark.ai_assistant_service` 或 `@pytest.mark.salary_server`
   - 所属系统标记：如 `@pytest.mark.sys_dify_assistant`
   - 所属模块标记，如 `@pytest.mark.mod_sys_dify_assistant`，所属系统、模块必须来自 `config/pytest.ini`, 没有的需要先添加
   - 关联的接口标记：如`@allure.label("api_path", "/api/xxx/xxx")`，如果关联多个接口，可以添加多个标记（注意：只标记关键验证接口）
5. 冒烟用例加 `@pytest.mark.smoke`。
6. 有写操作/脏数据风险的用例必须加 `@pytest.mark.skip_prod`（必要时 `@pytest.mark.skip_uat`）。
7. 命名规范：
   - 文件：`test_{api_or_scene}.py`
   - 类：`TestXxx`
   - 用例：`test_xxx`
   - 夹具：`fixture_xxx`
8. 参数构造规范：`build_params(...=None)`，仅在非 `None` 时 `params.update(...)`。
9. `build_params` 中每个参数都必须有注释说明（类型、是否必填、业务含义）。
10. 请求封装规范：
   - 类内必须有 `self.path`
   - 请求方法返回 `HttpResponseResult`
   - 使用 `@api_log(api='对应DoRequest实例名')`
11. 当一个接口参数很多且 JSON 层级复杂时，必须拆分成多个构造方法（如 `build_xxx_item`、`build_condition`、`build_payload`），主方法只做组装。
12. 禁止硬编码 URL/token/账号密码，统一从 `config/*.yaml` 获取。
13. 新增接口时，必须先确定归属 `project/module`，并在该模块路径下补齐 `common_projects + cases`。
14. 用例设计必须以业务场景为中心，禁止只生成"调用接口 -> 断言 HTTP 200/成功标识"的弱校验用例。
15. 断言必须覆盖与场景直接相关的关键业务字段，至少包含其一：业务状态、业务ID、名称、金额、数量、时间、列表数量、筛选结果、错误码、错误提示。
16. 增删改接口必须增加结果校验，验证数据是否真实创建/修改/删除成功；不能只断言写接口本身返回成功。
17. 查询接口必须断言返回内容正确，而不只是接口可用；至少校验关键字段和值、筛选条件命中结果、分页/排序结果中的一项或多项。
18. 失败场景必须断言失败标识与失败信息，不能只断言非 200 或 success=false。
19. 用例需关联所属系统、模块，不能只依赖项目标记，要先在pytest.ini中配置所属系统、模块。命名规则：系统：`sys_{系统名}`，模块：`mod_sys_{系统名}_{模块名}`。
20. 使用 `DoRequest`、`HttpResponseResult`、`assert_that` 等公共类时，必须先读取其源文件确认可用方法，禁止凭推测使用不存在的方法。源文件路径：
   - `common/httpclient/do_request.py`（DoRequest）
   - `pojo/httpResponseResult.py`（HttpResponseResult）
   - `common/hamcrest/hamcrest.py`（assert_that）
   - `common/hamcrest/custom_matchers.py`（自定义 matcher：h_is_true、h_is_empty）

## 4. base/api client模板（必须支持）
```python
from base.api.xxx.api_xxx_read_config import APIXXXReadConfig
from common.httpclient.do_request import DoRequest
import jwt
import time

class APIXXXClient:
    __instance = None
    __inited = None

    def __new__(cls, *args, **kwargs):
        if cls.__instance is None:
            cls.__instance = object.__new__(cls)
        return cls.__instance

    def __init__(self, config_file_path=None, env: str = None):
        if self.__inited is None:
            read_config = APIXXXReadConfig(config_file_path=config_file_path, env=env)
            self.xxx_config = read_config.config
            self.env = read_config.env

            self.gw_jwt_login = None
            self.nologin = None
            self._http_login()

            self.__inited = True

    def _http_login(self):
        if self.xxx_config['base_info']['is_gw_jwt_login']:
            self._gw_jwt_login()
        if self.xxx_config['base_info']['is_init_server_url_nologin']:
            self._nologin()

    def _nologin(self):
        self.nologin = DoRequest(self.xxx_config['base_info']['server_url'])
        self.nologin.setVerify(self.xxx_config['base_info']['is_verify_ssl_cer'])
        self.nologin.updateHeaders({'Content-Type': 'application/json;charset=UTF-8'})

    def _gw_jwt_login(self):
        app_id = self.xxx_config['application_ids']['system_id']
        app_key = self.xxx_config['application_keys']['system_key']
        token = self._get_jwt_token(app_id=app_id, app_key=app_key)

        self.gw_jwt_login = DoRequest(self.xxx_config['base_info']['gw_server_url'])
        self.gw_jwt_login.setVerify(self.xxx_config['base_info']['is_verify_ssl_cer'])
        self.gw_jwt_login.updateHeaders({'Content-Type': 'application/json;charset=UTF-8'})
        self.gw_jwt_login.updateHeaders({'Authorization': f'Bearer {token}'})

    def _get_jwt_token(self, app_id=None, app_key=None):
        headers = {'alg': 'HS256', 'typ': 'JWT'}
        now = int(time.time())
        payload = {'appId': str(app_id), 'iat': now, 'exp': now + 86400}
        return jwt.encode(payload=payload, key=app_key, algorithm='HS256', headers=headers)
```

## 5. ReadConfig模板（必须支持）
```python
from ruamel import yaml
from common.file_tool import FileTool
import os

class APIXXXReadConfig:
    __instance = None
    __inited = None

    def __new__(cls, *args, **kwargs):
        if cls.__instance is None:
            cls.__instance = object.__new__(cls)
        return cls.__instance

    def __init__(self, config_file_path: str = None, env: str = None):
        if self.__inited is None:
            if config_file_path is None:
                if env is None:
                    if os.path.exists('config/tmp/env.json'):
                        env = FileTool.read_json_from_file('config/tmp/env.json')['env']
                    else:
                        env = 'uat'

                if env.lower() == 'test':
                    config_file_path = 'config/xxx/api_xxx_test.yaml'
                elif env.lower() == 'uat':
                    config_file_path = 'config/xxx/api_xxx_uat.yaml'
                elif env.lower() == 'release':
                    config_file_path = 'config/xxx/api_xxx_release.yaml'

            self.config = yaml.safe_load(open(config_file_path, 'r', encoding='utf-8'))
            self.env = env
            self.__inited = True
```

## 6. 配置文件规范（config yaml）
命名规范（推荐）：
- 项目级：`api_{project}_{env}.yaml`
- 模块级：`api_{project}_{module}_{env}.yaml`

最小必备结构：
```yaml
base_info:
  server_url: https://xxx
  gw_server_url: https://xxx
  is_gw_jwt_login: true
  is_verify_ssl_cer: false
  is_init_server_url_nologin: false

user_info:
  username: '00123456'
  password: '***'

application_ids:
  system_id: 100001

application_keys:
  system_key: xxxxxxxxxxxxxxxxxxxx
```

配置约束：
1. URL、账号、密码、密钥统一放配置，不允许写死到代码。
2. 字段名保持小写下划线风格，避免同义词重复。
3. 同一项目内，不同模块配置结构尽量一致，便于复用 client。
4. 优先项目公共配置；模块有差异时再增加模块配置文件。

## 7. 接口封装模板（common_projects）
```python
from base.api.xxx.api_xxx_client import APIXXXClient
from common.log.decorator import api_log
import ujson

class XxxApi:
    def __init__(self):
        self.client = APIXXXClient()
        self.config = self.client.xxx_config
        self.login = self.client.gw_jwt_login
        self.path = "/api/xxx/yyy"
        self.content_type = {"Content-Type": "application/json;charset=UTF-8"}

    def build_params(self, a=None, b=None):
        """构建请求参数。

        Args:
            a (str, optional): 参数A，业务含义示例：租户编码。
            b (int, optional): 参数B，业务含义示例：分页页码。
        """
        params = {}
        if a is not None:
            params.update({"a": a})
        if b is not None:
            params.update({"b": b})
        return params

    @api_log(api="login")
    def query(self, params=None):
        self.login.updateHeaders(self.content_type)
        return self.login.post_with_json(self.path, params=params)
```

复杂 JSON 参数推荐拆分示例：
```python
class CreateOrderApi:
    def build_item(self, sku_id=None, qty=None):
        return {"skuId": sku_id, "qty": qty}

    def build_buyer(self, user_id=None, mobile=None):
        return {"userId": user_id, "mobile": mobile}

    def build_payload(self, buyer=None, items=None, remark=None):
        params = {}
        if buyer is not None:
            params.update({"buyer": buyer})
        if items is not None:
            params.update({"items": items})
        if remark is not None:
            params.update({"remark": remark})
        return params
```

## 8. 用例模板（cases/api）
```python
import pytest, allure, ujson
from common.hamcrest.hamcrest import assert_that
from common_projects.api.xxx.module_xxx.xxx_api import XxxApi

@pytest.mark.xxx
@pytest.mark.xxx_service
@allure.label("owner", "负责人工号：负责人姓名")
@allure.label("api_path", "/api/xxx/xxx")
@pytest.mark.sys_dify_assistant
@pytest.mark.mod_sys_dify_assistant
class TestXxxApi:
    def setup_class(self):
        self.api = XxxApi()
        self.config = self.api.config

    @pytest.mark.smoke
    @allure.title("用例标题")
    def test_xxx_success(self):
        params = self.api.build_params(a="1")
        result = self.api.query(params)
        assert_that(result.status_code).is_equal_to(200)

        body = ujson.loads(result.body)
        assert_that(body["success"]).is_true()
        assert_that(body["data"]).is_not_none()
        assert_that(body["data"]["id"]).is_not_none()
        assert_that(body["data"]["status"]).is_equal_to("SUCCESS")
```

说明：
1. 示例仅展示基础结构，不代表断言只需到 `status_code/success`。
2. 实际生成用例时，必须按业务场景补充字段级断言。
3. 若为写接口，应补充"写后查"或等价校验步骤。
4. 若为失败场景，应补充错误码、错误提示、失败原因等断言。

## 9. Fixture规范（有数据创建时）
1. 放在模块目录下：`cases/api/{project}/{module}/conftest.py`。
2. 需要清理时必须用 `yield`：
   - `yield` 前：创建数据
   - `yield` 后：删除/回滚数据
3. fixture 返回最小必要数据（如 `id`、`token`），避免返回大对象。

## 10. 生成脚本时的执行流程
1. 先确定接口归属 `project/module`。
2. 复用现有 `base/api/{project}` 客户端。
3. 在 `common_projects/api/{project}/{module}` 新增接口封装。
4. 在 `cases/api/{project}/{module}` 新增测试与 fixture。
5. 默认 test 环境执行：`python -u run_api_test.py -e test -d cases/api/{project}/{module} -s 1`。

## 11. 验收清单
1. 是否按 `project/module` 放置代码。
2. 是否只通过 `common_projects` 调接口。
3. 是否包含 owner + marker + smoke/skip 标记。
4. 是否使用 `assert_that` 和 `ujson`。
5. 是否有数据清理（增删改场景）。
6. `build_params` 的每个参数是否有注释。
7. 复杂 JSON 是否拆分了子构造方法。
8. 默认执行命令是否指向模块目录。
