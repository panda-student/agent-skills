// 通用网页账号密码无头登录：临时 Profile 启动 Edge(headless)，自动填表、登录、可选选择组织，读取指定 cookie。
// 供 api-center、pms-cli 等 Jomoo 网页登录复用；失败时由 createTokenManager 回落到可见浏览器。
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function findEdgeExe() {
    const candidates = [
        process.env['PROGRAMFILES(X86)'] && join(process.env['PROGRAMFILES(X86)'], 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
        process.env.PROGRAMFILES && join(process.env.PROGRAMFILES, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
        process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    ].filter(Boolean);
    return candidates.find(candidate => existsSync(candidate)) || null;
}

function pickFreePort() {
    return new Promise(resolve => {
        const server = createServer();
        server.unref();
        server.on('error', () => resolve(0));
        server.listen(0, '127.0.0.1', () => {
            const { port } = server.address();
            server.close(() => resolve(port));
        });
    });
}

async function waitForCdp(port, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            const response = await fetch(`http://127.0.0.1:${port}/json/version`);
            if (response.ok) return true;
        } catch {
            // 尚未就绪
        }
        await sleep(500);
    }
    return false;
}

async function findPageTarget(port) {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`);
    const targets = await response.json();
    return targets.find(target => target.type === 'page' && target.webSocketDebuggerUrl) || null;
}

function createCdpClient(wsUrl) {
    const ws = new WebSocket(wsUrl);
    let sequence = 0;
    const pending = new Map();
    ws.onmessage = event => {
        const message = JSON.parse(event.data);
        if (message.id && pending.has(message.id)) {
            pending.get(message.id)(message);
            pending.delete(message.id);
        }
    };
    const ready = new Promise((resolve, reject) => {
        ws.onopen = resolve;
        ws.onerror = reject;
    });
    return {
        ready,
        evaluate(expression) {
            return new Promise(resolve => {
                const id = ++sequence;
                pending.set(id, message => resolve(message.result?.result?.value));
                ws.send(JSON.stringify({
                    id,
                    method: 'Runtime.evaluate',
                    params: { expression, returnByValue: true, awaitPromise: true },
                }));
            });
        },
        close() {
            try { ws.close(); } catch { /* ignore */ }
        },
    };
}

async function waitForExpression(client, expression, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const value = await client.evaluate(expression);
        if (value) return value;
        await sleep(300);
    }
    return null;
}

/**
 * @param {object} options
 * @param {string} options.loginUrl 登录页地址
 * @param {string|null} options.companyText 登录后组织名称（无组织选择页时传 null）
 * @param {string} options.cookieName 目标 cookie 名，默认 nisbos_auth_token
 * @param {{account:string,password:string}} options.credential
 */
export async function webHeadlessLogin({ loginUrl, companyText = null, cookieName = 'nisbos_auth_token', credential }) {
    const edge = findEdgeExe();
    if (!edge) throw new Error('未找到 Microsoft Edge，可执行文件不存在');

    const port = await pickFreePort();
    if (!port) throw new Error('无法分配 CDP 调试端口');
    const profileDir = mkdtempSync(join(tmpdir(), 'web-headless-'));
    const child = spawn(edge, [
        '--headless=new',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${profileDir}`,
        '--window-size=1280,900',
        loginUrl,
    ], { stdio: 'ignore', detached: true, windowsHide: true });
    child.unref();

    let client = null;
    try {
        if (!await waitForCdp(port, 15000)) {
            throw new Error('Edge 无头模式启动超时');
        }
        const target = await findPageTarget(port);
        if (!target) throw new Error('未找到登录页面');

        client = createCdpClient(target.webSocketDebuggerUrl);
        await client.ready;

        const filled = await waitForExpression(client, `(() => {
            const inputs = [...document.querySelectorAll('input')];
            return inputs.some(input => input.type === 'password') ? 'ready' : '';
        })()`, 15000);
        if (!filled) throw new Error('登录页未加载出账号密码输入框');

        await client.evaluate(`(() => {
            const setValue = (element, value) => {
                const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
                setter.call(element, value);
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
            };
            const inputs = [...document.querySelectorAll('input')];
            const account = inputs.find(input => input.placeholder && input.placeholder.includes('账号')) || inputs[0];
            const password = inputs.find(input => input.type === 'password') || inputs[1];
            setValue(account, ${JSON.stringify(credential.account)});
            setValue(password, ${JSON.stringify(credential.password)});
            return 'filled';
        })()`);

        await sleep(300);
        await client.evaluate(`(() => {
            const button = [...document.querySelectorAll('button')].find(item => item.textContent.replace(/\\s/g, '') === '登录');
            if (button) button.click();
            return 'clicked';
        })()`);

        if (companyText) {
            const orgReady = await waitForExpression(client, `(() => {
                return [...document.querySelectorAll('div.companyItem')].some(item => item.textContent.includes(${JSON.stringify(companyText)})) ? 'ready' : '';
            })()`, 10000);
            if (orgReady) {
                await client.evaluate(`(() => {
                    const item = [...document.querySelectorAll('div.companyItem')].find(element => element.textContent.includes(${JSON.stringify(companyText)}));
                    if (item) item.click();
                    return 'clicked';
                })()`);
            }
        }

        const token = await waitForExpression(client, `(() => {
            const prefix = ${JSON.stringify(cookieName)} + '=';
            const item = document.cookie.split('; ').find(part => part.startsWith(prefix));
            return item ? item.slice(prefix.length) : '';
        })()`, 15000);
        if (!token) throw new Error(`未捕获到 ${cookieName}`);
        return token;
    } finally {
        if (client) client.close();
        if (process.platform === 'win32') {
            await new Promise(resolve => {
                const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
                killer.on('exit', resolve);
                killer.on('error', resolve);
                setTimeout(resolve, 3000);
            });
        } else {
            try { child.kill('SIGKILL'); } catch { /* ignore */ }
        }
        for (let attempt = 0; attempt < 10; attempt++) {
            try {
                rmSync(profileDir, { recursive: true, force: true });
                break;
            } catch {
                await sleep(300);
            }
        }
    }
}
