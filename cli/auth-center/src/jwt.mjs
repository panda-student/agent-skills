/** JWT 工具：auth-center 与业务脚本共用同一套过期判定。 */

export function parseJwtPayload(token) {
    try {
        return JSON.parse(Buffer.from(String(token).split('.')[1], 'base64url').toString('utf8'));
    } catch {
        return null;
    }
}

export function isJwtExpired(token) {
    const payload = parseJwtPayload(token);
    return !payload || !Number.isFinite(payload.exp) || payload.exp * 1000 <= Date.now();
}

export function validateJwtToken(token) {
    return !isJwtExpired(token);
}
