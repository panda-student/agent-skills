// AnyShare（爱数 AnyShare 7.0，wendang.jomoo.com）对外端点唯一定义 + 速查表
// 变更只改本文件。认证方式：Authorization: Bearer ory_at_...（Hydra opaque token，
// 非 JWT，无法本地解析 exp，只能靠 API 试活判断有效性）。
export const BASE_URL = 'https://wendang.jomoo.com';

export const ENDPOINTS = {
  // 文档库列表（顶层 JSON 数组，字段 id=gns://... / name / type）
  docLibList: '/api/document/v1/entry-doc-lib?sort=doc_lib_name&direction=asc',

  // 子对象列表（返回 next_marker / dirs[] / files[] / doc_lib）
  subObjects: (gnsId, { limit = 100, marker = '' } = {}) =>
    '/api/document/v1/folders/' + encodeURIComponent(gnsId)
    + `/sub_objects?limit=${limit}&sort=name&direction=asc`
    + (marker ? `&marker=${encodeURIComponent(marker)}` : ''),

  // 文件元信息（返回 rev / file_name / size / docid；rev 为下载必需的版本号）
  fileMetadata: '/api/efast/v1/file/metadata',

  // 文件下载签名（body 字段必须全为字符串：docid / authtype="0" / savename / usehttps="1" / rev；
  // 返回 authrequest: [GET, 签名URL, "Authorization: AWS ...", "x-amz-date: ..."]，
  // 携带后两个头 GET 签名 URL 即得文件内容。2026-11-05 实测打通）
  fileOsDownload: '/api/efast/v1/file/osdownload',

  // SPA 目录页 URL 模板（gns id 去掉 gns:// 前缀后拼接）
  webDir: (gnsId) => '/anyshare/zh-cn/dir/' + String(gnsId).replace(/^gns:\/\//, ''),

  // AnyShare 首页：打开即自动执行静默 SSO 回路（浏览器会话有效时无感换发新 token）
  homepage: '/anyshare/zh-cn/homepage',

  // 静默 SSO 回路入口（302 → Hydra /oauth2/auth → /oauth2/signin）
  silentLogin: '/anyshare/oauth2/login?lang=zh-cn',
};

// 统一认证（UCenter）——thirdauth 配置实测：
//   authorize?response_type=code&client_id=100840&redirect_uri={BASE_URL}/sso&state=aishu
// 无头登录链使用；clientSecret 等交换细节由 wendang /sso 后端持有。
export const UCENTER_BASE = 'https://api-ucenter-jmbos.jomoo.com';
export const UCENTER_LOGIN_BY_CODE = UCENTER_BASE + '/oauth2/loginByCode';
export const SSO_CALLBACK = BASE_URL + '/sso'; // UCenter 授权码回跳（无头链，未实测打通）

// 已确认未打通（勿重试，2026-11-04 实测）：
//   POST /oauth2/token (grant_type=refresh_token + signin/aud client_id) → 401 invalid_client
//   /api/eacp/v1/auth1/token|refresh → 404；/af/api/session/v1/* → 503
// 文件下载已打通（2026-11-05 实测）：efast/v1/file/metadata + efast/v1/file/osdownload 两步签名下载。
export const KNOWN_UNAVAILABLE = {};
