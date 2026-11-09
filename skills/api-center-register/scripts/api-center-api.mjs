#!/usr/bin/env node
/**
 * API 中心后端 API 快速通道（2026-11 抓包实证）
 *
 * 用法见 USAGE；token 来自 auth-center（auth login api-center）。
 */
import { readFileSync } from 'node:fs';
import { loadAppConfig } from '../../../cli/auth-center/src/config-store.mjs';
import { validateJwtToken } from '../../../cli/auth-center/src/jwt.mjs';

const BASE = 'https://api-admin-jmbos-uat.jomoo.com/api';
const SYSTEM_ID = '100837377';
const DF_CODE = '1518912c-8a9f-42df-9f9a-d90b7abf3529';
const USAGE = `用法:
  node api-center-api.mjs list [page] [size]
  node api-center-api.mjs detail <id>
  node api-center-api.mjs publish <id>
  node api-center-api.mjs unpublish <id>
  node api-center-api.mjs copy <id>
  node api-center-api.mjs create <payload.json>
  node api-center-api.mjs update <id> <payload.json>`;

let cachedToken = null;

function readToken() {
    if (cachedToken) return cachedToken;
    let config;
    try {
        config = loadAppConfig('api-center');
    } catch {
        throw new Error('api-center 未登录，请先执行: auth login api-center');
    }
    if (!config || !config.token) throw new Error('api-center 未登录，请先执行: auth login api-center');
    if (!validateJwtToken(config.token)) throw new Error('api-center token 已过期，请执行: auth login api-center');
    cachedToken = config.token;
    return cachedToken;
}

function parseResponse(response, text) {
    let json;
    try { json = JSON.parse(text); } catch { json = text; }
    const businessFailed = json && typeof json === 'object' && (
        json.success === false ||
        (json.code !== undefined && ![0, '0', 200, '200'].includes(json.code)) ||
        (json.errorCode !== undefined && !['0', 0].includes(json.errorCode))
    );
    if (!response.ok || businessFailed) {
        const message = json && typeof json === 'object' ? json.message || json.msg || '' : '';
        throw new Error(`HTTP ${response.status}${message ? ' ' + message : ''}: ${String(text).slice(0, 800)}`);
    }
    return json;
}

async function call(path, { method = 'POST', body, query } = {}) {
    const url = new URL(BASE + path);
    for (const [key, value] of Object.entries(query || {})) {
        url.searchParams.set(key, value);
    }
    const response = await fetch(url, {
        method,
        headers: {
            Authorization: `Bearer ${readToken()}`,
            systemid: SYSTEM_ID,
            'Content-Type': 'application/json',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
    });
    return parseResponse(response, await response.text());
}

function readPayload(file) {
    return JSON.parse(readFileSync(file, 'utf8'));
}

const [command, ...args] = process.argv.slice(2);

if (command === 'list') {
    const page = Number(args[0] || 1);
    const size = Number(args[1] || 10);
    const result = await call('/api-interface/apiRegisterPage', {
        query: { dfCode: DF_CODE },
        body: { currentPage: page, pageSize: size, dfCode: DF_CODE },
    });
    console.log(JSON.stringify(result.data, null, 2));
} else if (command === 'detail') {
    const id = args[0];
    if (!id) throw new Error('用法: detail <id>');
    const [detail, bodyParams, queryParams, headerParams, cookieParams, responseParams, statusCodes] = await Promise.all([
        call('/api-interface/apiInterfaceDetailForUpdate', { method: 'GET', query: { id } }),
        call('/api-interface-param/getRequestParmsByInterfaceId', { query: { id }, body: { id: Number(id), paramType: 1 } }),
        call('/api-interface-param/getRequestParmsByInterfaceId', { query: { id }, body: { id: Number(id), paramType: 2 } }),
        call('/api-interface-param/getRequestParmsByInterfaceId', { query: { id }, body: { id: Number(id), paramType: 3 } }),
        call('/api-interface-param/getRequestParmsByInterfaceId', { query: { id }, body: { id: Number(id), paramType: 4 } }),
        call('/api-interface-param/getResponseParmsByInterfaceId', { query: { id }, body: { id: Number(id) } }),
        call('/api-interface-status-code/getListByInterfaceId', { query: { id }, body: { id: Number(id), currentPage: 1, pageSize: 20 } }),
    ]);
    console.log(JSON.stringify({
        detail: detail.data,
        bodyParams: bodyParams.data,
        queryParams: queryParams.data,
        headerParams: headerParams.data,
        cookieParams: cookieParams.data,
        responseParams: responseParams.data,
        statusCodes: statusCodes.data,
    }, null, 2));
} else if (command === 'publish' || command === 'unpublish') {
    const id = args[0];
    if (!id) throw new Error(`用法: ${command} <id>`);
    const path = command === 'publish' ? '/api-interface/onShelvesStatus' : '/api-interface/offLineStatus';
    const result = await call(path, { query: { id }, body: { id: Number(id) } });
    console.log(JSON.stringify(result, null, 2));
} else if (command === 'copy') {
    const id = args[0];
    if (!id) throw new Error('用法: copy <id>');
    const result = await call('/api-interface/interfaceCopy', { query: { id }, body: { id: Number(id) } });
    console.log(JSON.stringify(result, null, 2));
} else if (command === 'create') {
    const file = args[0];
    if (!file) throw new Error('用法: create <payload.json>');
    const result = await call('/api-interface/interfaceRegister', { body: readPayload(file) });
    console.log(JSON.stringify(result, null, 2));
} else if (command === 'update') {
    const id = args[0];
    const file = args[1];
    if (!id || !file) throw new Error('用法: update <id> <payload.json>');
    const payload = readPayload(file);
    const result = await call('/api-interface/interfaceRegisterUpdateShelves', {
        query: { dfCode: DF_CODE, id },
        body: { ...payload, id: Number(id) },
    });
    console.log(JSON.stringify(result, null, 2));
} else {
    console.log(USAGE);
    process.exitCode = 1;
}
