#!/usr/bin/env node
/**
 * auth-center 统一登录入口。
 *
 * 所有公司系统的登录/状态/取 token 都从这里走；各业务 CLI 仍可直接用。
 * 登录委托给各业务 CLI（zentao / pms / anyshare / ibpm）；
 * 腾讯文档走 MCP OAuth（授权码 + PKCE，带 refresh_token 自动续期）。
 */
import http from 'node:http';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { loadAppConfig, saveAppConfig, APP_HOME } from '../src/index.mjs';
import { openInSharedProfile } from '../src/cdp-edge.mjs';

const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

// 腾讯文档 MCP OAuth
const TDOCS_REGISTER_URL = 'https://docs.qq.com/openapi/mcp/oauth/register';
const TDOCS_TOKEN_URL = 'https://docs.qq.com/openapi/mcp/oauth/token';
const TDOCS_AUTH_PAGE = 'https://docs.qq.com/scenario/open-claw.html?authType=2';
const TDOCS_CALLBACK_PORT = 8765;
const TDOCS_REDIRECT_URI = `http://127.0.0.1:${TDOCS_CALLBACK_PORT}/callback`;
const TDOCS_SCOPE = 'docs:read docs:write docs:manage';

const APPS = {
    zentao: {
        label: '禅道',
        configApp: 'zentao-cli',
        login: ['zentao', 'login'],
        status: ['zentao', 'whoami'],
    },
    pms: {
        label: 'PMS',
        configApp: 'pms-cli',
        login: ['pms', 'login'],
        status: ['pms', 'whoami'],
    },
    anyshare: {
        label: 'AnyShare',
        configApp: 'anyshare-cli',
        login: ['anyshare', 'login'],
        status: ['anyshare', 'whoami'],
    },
    ibpm: {
        label: 'IBPM',
        configApp: 'ibpm-cli',
        login: ['ibpm', 'login', '-e', 'uat'],
        status: ['ibpm', 'whoami'],
        tokenPath: 'ibpm',
    },
    'tencent-docs': {
        label: '腾讯文档',
        configApp: 'tencent-docs',
        login: tencentDocsLogin,
        status: tencentDocsStatus,
    },
};

function configApp(app) {
    return APPS[app].configApp || app;
}

function readToken(app) {
    const cfg = loadAppConfig(configApp(app));
    if (APPS[app].tokenPath === 'ibpm') {
        return cfg.envs && cfg.envs.uat ? cfg.envs.uat.token || null : null;
    }
    return cfg.token || null;
}

function clearToken(app) {
    const cfg = loadAppConfig(configApp(app));
    if (APPS[app].tokenPath === 'ibpm') {
        if (cfg.envs && cfg.envs.uat) delete cfg.envs.uat.token;
    } else {
        delete cfg.token;
        delete cfg.tokenSavedAt;
        delete cfg.tokenSource;
        if (app === 'tencent-docs') {
            delete cfg.refreshToken;
            delete cfg.expiresAt;
        }
    }
    saveAppConfig(configApp(app), cfg);
}

function runCommand(command, args) {
    const result = spawnSync(command, args, {
        stdio: 'inherit',
        shell: process.platform === 'win32',
    });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exitCode = result.status || 1;
}

const b64url = buf => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** 从现有 MCP 客户端配置导入腾讯文档 32 位 token（OAuth 不可用时的兜底） */
function importExistingTencentDocsToken() {
    const appData = process.env.APPDATA || join(homedir(), 'AppData', 'Roaming');
    const candidates = [
        { file: join(homedir(), '.claude.json'), pick: j => j && j.mcpServers && j.mcpServers['tencent-docs'] && j.mcpServers['tencent-docs'].headers && j.mcpServers['tencent-docs'].headers.Authorization },
        { file: join(appData, 'Trae CN', 'User', 'mcp.json'), pick: j => j && j.mcpServers && j.mcpServers['tencent-docs'] && j.mcpServers['tencent-docs'].headers && j.mcpServers['tencent-docs'].headers.Authorization },
    ];
    for (const candidate of candidates) {
        if (!existsSync(candidate.file)) continue;
        try {
            const token = candidate.pick(JSON.parse(readFileSync(candidate.file, 'utf8')));
            if (typeof token === 'string' && /^[0-9a-f]{32}$/i.test(token)) {
                return { token, source: candidate.file };
            }
        } catch { /* 配置损坏则跳过 */ }
    }
    return null;
}

async function ensureTdocsClient(cfg) {
    if (cfg.clientId) return cfg.clientId;
    const res = await fetch(TDOCS_REGISTER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            client_name: 'auth-center',
            redirect_uris: [TDOCS_REDIRECT_URI],
            grant_types: ['authorization_code', 'refresh_token', 'urn:ietf:params:oauth:grant-type:device_code'],
            response_types: ['code'],
            token_endpoint_auth_method: 'none',
            scope: TDOCS_SCOPE,
        }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.client_id) {
        throw new Error(`腾讯文档 OAuth 客户端注册失败: ${data.error_description || data.error || res.status}`);
    }
    cfg.clientId = data.client_id;
    saveAppConfig('tencent-docs', cfg);
    console.log(`✓ 已注册腾讯文档 OAuth 客户端（${data.client_id}）`);
    return data.client_id;
}

function applyTdocsToken(cfg, data, source) {
    cfg.token = data.access_token;
    if (data.refresh_token) cfg.refreshToken = data.refresh_token;
    cfg.expiresAt = data.expires_in ? new Date(Date.now() + data.expires_in * 1000).toISOString() : null;
    cfg.tokenSavedAt = new Date().toISOString();
    cfg.tokenSource = source;
    saveAppConfig('tencent-docs', cfg);
}

async function refreshTdocsToken(cfg) {
    if (!cfg.refreshToken || !cfg.clientId) return false;
    const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: cfg.refreshToken,
        client_id: cfg.clientId,
    });
    const res = await fetch(TDOCS_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.access_token) return false;
    applyTdocsToken(cfg, data, 'oauth:refresh_token');
    return true;
}

function tdocsTokenExpired(cfg) {
    if (!cfg.token) return true;
    if (!cfg.expiresAt) return false;
    return Date.now() > new Date(cfg.expiresAt).getTime() - 60_000;
}

/** 启动本地回调服务，打开带 OAuth 参数的授权页，等用户点「确认授权」 */
function waitForTdocsOAuthCode(authUrl, timeoutMs = 180_000) {
    return new Promise((resolve, reject) => {
        const server = http.createServer((req, res) => {
            const u = new URL(req.url, `http://127.0.0.1:${TDOCS_CALLBACK_PORT}`);
            if (u.pathname !== '/callback') { res.writeHead(404); res.end(); return; }
            const code = u.searchParams.get('code');
            const state = u.searchParams.get('state');
            const error = u.searchParams.get('error');
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end('<meta charset="utf-8"><h2>授权完成，可以关闭此页</h2>');
            clearTimeout(timer);
            server.close();
            if (error) resolve({ error, description: u.searchParams.get('error_description') });
            else resolve({ code, state });
        });
        const timer = setTimeout(() => {
            server.close();
            reject(new Error('腾讯文档授权超时（180 秒）'));
        }, timeoutMs);
        server.on('error', error => {
            clearTimeout(timer);
            reject(new Error(`本地回调端口 ${TDOCS_CALLBACK_PORT} 不可用: ${error.message}`));
        });
        server.listen(TDOCS_CALLBACK_PORT, '127.0.0.1', () => {
            console.log('已打开腾讯文档 MCP 授权页。');
            console.log('请在浏览器中登录并点击「确认授权」，授权完成后自动回调。');
            openInSharedProfile(authUrl);
        });
    });
}

function syncTencentDocsTargets() {
    const syncScript = join(homedir(), '.agents', 'skills', 'tencent-docs', 'scripts', 'sync_token.mjs');
    if (!existsSync(syncScript)) return;
    const result = spawnSync(process.execPath, [syncScript, '--from-auth'], { stdio: 'inherit' });
    if (result.status !== 0) console.warn('△ 外部 MCP 同步失败；token 已保存，可稍后手动运行 sync_token.mjs');
}

async function tencentDocsLogin() {
    const cfg = loadAppConfig('tencent-docs');

    if (!tdocsTokenExpired(cfg)) {
        console.log(`✓ 腾讯文档 token 仍有效（…${cfg.token.slice(-6)}，到期 ${cfg.expiresAt || '未知'}）`);
        syncTencentDocsTargets();
        return;
    }

    if (await refreshTdocsToken(cfg)) {
        console.log(`✓ 腾讯文档 token 已用 refresh_token 刷新（…${cfg.token.slice(-6)}）`);
        syncTencentDocsTargets();
        return;
    }

    const imported = process.env.AUTH_CENTER_SKIP_IMPORT === '1' ? null : importExistingTencentDocsToken();
    if (imported) {
        cfg.token = imported.token;
        cfg.tokenSavedAt = new Date().toISOString();
        cfg.tokenSource = 'imported:' + imported.source;
        saveAppConfig('tencent-docs', cfg);
        console.log(`✓ 已从现有 MCP 配置导入 token（…${cfg.token.slice(-6)}）`);
        syncTencentDocsTargets();
        return;
    }

    const clientId = await ensureTdocsClient(cfg);
    const verifier = b64url(crypto.randomBytes(32));
    const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
    const state = crypto.randomBytes(8).toString('hex');
    const params = new URLSearchParams({
        authType: '2',
        nlc: '1',
        response_type: 'code',
        client_id: clientId,
        redirect_uri: TDOCS_REDIRECT_URI,
        scope: TDOCS_SCOPE,
        state,
        code_challenge: challenge,
        code_challenge_method: 'S256',
    });
    const result = await waitForTdocsOAuthCode(`${TDOCS_AUTH_PAGE}&${params.toString()}`);
    if (result.error) {
        throw new Error(`腾讯文档授权失败: ${result.error} ${result.description || ''}`);
    }
    if (result.state !== state) {
        throw new Error('腾讯文档授权 state 校验失败');
    }
    const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code: result.code,
        redirect_uri: TDOCS_REDIRECT_URI,
        client_id: clientId,
        code_verifier: verifier,
    });
    const res = await fetch(TDOCS_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.access_token) {
        throw new Error(`腾讯文档 token 交换失败: ${data.error_description || data.error || res.status}`);
    }
    applyTdocsToken(cfg, data, 'oauth:authorization_code+pkce');
    console.log(`✓ 腾讯文档授权成功（…${cfg.token.slice(-6)}，到期 ${cfg.expiresAt || '未知'}）`);
    syncTencentDocsTargets();
}

function tencentDocsStatus() {
    const cfg = loadAppConfig('tencent-docs');
    if (!cfg.token) {
        console.log('腾讯文档: 未登录（执行 auth login tencent-docs）');
        return;
    }
    const expired = tdocsTokenExpired(cfg);
    console.log(`腾讯文档: ${expired ? '已过期' : '有效'}（…${String(cfg.token).slice(-6)}，到期 ${cfg.expiresAt || '未知'}，refresh ${cfg.refreshToken ? '有' : '无'}）`);
}

function printHelp() {
    console.log(`
auth-center — 统一登录入口

  auth login <app>     登录（zentao/pms/anyshare/ibpm/tencent-docs）
  auth status [app]    查看 token 状态（不带 app 看全部缓存）
  auth token <app>     输出 token（脚本复用；腾讯文档过期会自动刷新）
  auth logout <app>    清除本地 token
  auth apps            列出支持的 app

统一用户目录: ${APP_HOME}
支持的 app: ${Object.keys(APPS).join(' / ')}
`);
}

async function main() {
    const [command, app] = process.argv.slice(2);
    if (command === '--version' || command === '-v') { console.log(VERSION); return; }
    if (!command || command === '--help' || command === '-h') { printHelp(); return; }

    if (command === 'apps') {
        for (const [name, meta] of Object.entries(APPS)) {
            console.log(`${name}\t${meta.label}`);
        }
        return;
    }

    if (command === 'status') {
        if (app) {
            if (!APPS[app]) throw new Error(`未知 app: ${app}`);
            if (Array.isArray(APPS[app].status)) {
                runCommand(APPS[app].status[0], APPS[app].status.slice(1));
            } else {
                APPS[app].status();
            }
            return;
        }
        for (const name of Object.keys(APPS)) {
            if (name === 'tencent-docs') {
                const cfg = loadAppConfig('tencent-docs');
                const state = cfg.token ? (tdocsTokenExpired(cfg) ? '已过期 …' : '已缓存 …') + String(cfg.token).slice(-6) : '未登录';
                console.log(`${name}\t${APPS[name].label}\t${state}`);
                continue;
            }
            const token = readToken(name);
            console.log(`${name}\t${APPS[name].label}\t${token ? '已缓存 …' + token.slice(-6) : '未登录'}`);
        }
        return;
    }

    if (command === 'login') {
        if (!app || !APPS[app]) throw new Error(`用法: auth login <${Object.keys(APPS).join('|')}>`);
        if (Array.isArray(APPS[app].login)) {
            runCommand(APPS[app].login[0], APPS[app].login.slice(1));
        } else {
            await APPS[app].login();
        }
        return;
    }

    if (command === 'token') {
        if (!app || !APPS[app]) throw new Error(`用法: auth token <${Object.keys(APPS).join('|')}>`);
        if (app === 'tencent-docs') {
            const cfg = loadAppConfig('tencent-docs');
            if (tdocsTokenExpired(cfg) && !(await refreshTdocsToken(cfg))) {
                throw new Error('腾讯文档 token 已过期且无法自动刷新，请执行: auth login tencent-docs');
            }
        }
        const token = readToken(app);
        if (!token) throw new Error(`${app} 没有缓存 token，请先执行: auth login ${app}`);
        process.stdout.write(token);
        return;
    }

    if (command === 'logout') {
        if (!app || !APPS[app]) throw new Error(`用法: auth logout <${Object.keys(APPS).join('|')}>`);
        clearToken(app);
        console.log(`✓ 已清除 ${app} 的本地 token（凭据保留）`);
        return;
    }

    throw new Error(`未知命令: ${command}，运行 auth --help`);
}

main().catch(error => {
    console.error(`✗ ${error.message}`);
    process.exit(1);
});