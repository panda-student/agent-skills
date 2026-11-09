// 配置管理：~/.auth-center/apps/ibpm-cli/config.json + JWT 过期解析
// 多环境隔离，token 明文落盘（个人机使用，勿提交 git）；旧路径自动迁移
import { loadAppConfig, saveAppConfig } from 'auth-center';

// 环境默认值（可按需扩展 dev/prod）
export const ENV_PRESETS = {
  uat: {
    baseUrl: 'https://test-ibpm.jomoo.com',
    loginPath: '/mvue/flowDesign',
    bpmModel: '/model',
    typeId: '2077307621480931328',
    typeName: '项目管理系统_100836348',
    selectSystemKey: '100836348',
  },
};

export function loadConfig() {
  const cfg = loadAppConfig('ibpm-cli');
  if (!cfg || typeof cfg !== 'object') return { envs: {} };
  if (!cfg.envs) cfg.envs = {};
  return cfg;
}

export function saveConfig(cfg) {
  saveAppConfig('ibpm-cli', cfg);
}

export function getEnv(name = 'uat') {
  const preset = ENV_PRESETS[name];
  if (!preset) throw new Error(`未知环境: ${name}（可选: ${Object.keys(ENV_PRESETS).join('/')}）`);
  const cfg = loadConfig();
  const saved = cfg.envs?.[name] || {};
  return { name, ...preset, ...saved };
}

export function saveEnvToken(envName, token) {
  const cfg = loadConfig();
  cfg.envs = cfg.envs || {};
  cfg.envs[envName] = { ...(cfg.envs[envName] || {}), token };
  saveConfig(cfg);
}

/** 解析 JWT payload（不验签，仅读 exp/sub 用于本地过期判断） */
export function parseJwt(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString('utf8'));
    return payload;
  } catch {
    return null;
  }
}

/** token 状态：valid（含剩余秒数）/ missing / expired */
export function tokenStatus(envName = 'uat') {
  const env = getEnv(envName);
  if (!env.token) return { state: 'missing', env };
  const jwt = parseJwt(env.token);
  if (!jwt?.exp) return { state: 'invalid', env };
  const remain = jwt.exp - Math.floor(Date.now() / 1000);
  return { state: remain > 60 ? 'valid' : 'expired', remain, env, jwt };
}
