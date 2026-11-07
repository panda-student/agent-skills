// 执行层：HTTP cookie 罐 + token 文本提取。
// jar 按域存储（支持 Domain 属性回写父域），header() 产出 fetch 直接可用的 Cookie 头；
// extractToken 从重定向 Location / 响应体 / cookie 值中提取 Bearer 形态 token。

/** 域后缀匹配：cookie 域是否对目标主机生效（.example.com 覆盖 a.example.com） */
function domainMatches(cookieDomain, host) {
  if (!cookieDomain) return false;
  const cd = cookieDomain.replace(/^\./, '').toLowerCase();
  const h = host.toLowerCase();
  return h === cd || h.endsWith('.' + cd);
}

/** 从 Set-Cookie 属性串解析 (name, value, domain) */
function parseSetCookie(line) {
  const [pair, ...attrs] = line.split(';');
  const eq = pair.indexOf('=');
  if (eq <= 0) return null;
  const name = pair.slice(0, eq).trim();
  const value = pair.slice(eq + 1).trim();
  let domain = null;
  for (const attr of attrs) {
    const [k, v = ''] = attr.split('=');
    if (k.trim().toLowerCase() === 'domain') domain = v.trim();
  }
  if (!name) return null;
  return { name, value, domain };
}

/** 创建 cookie 罐。origin 仅用于报错可读性；存储键为 cookie 自身域（缺省取响应 host） */
export function createCookieJar() {
  // { [domainLower]: { [name]: value } }
  const store = new Map();

  function bucket(domain) {
    if (!store.has(domain)) store.set(domain, {});
    return store.get(domain);
  }

  return {
    /** 存入响应的 Set-Cookie（node fetch 用 headers.getSetCookie() 拿全量） */
    store(response, origin) {
      let host = origin;
      try { host = new URL(origin).host; } catch { /* origin 非 URL 时按原样 */ }
      const lines = typeof response.getSetCookie === 'function'
        ? response.getSetCookie()
        : [];
      for (const line of lines) {
        const parsed = parseSetCookie(line);
        if (!parsed) continue;
        const domain = parsed.domain
          ? parsed.domain.replace(/^\./, '').toLowerCase()
          : host.toLowerCase();
        bucket(domain)[parsed.name] = parsed.value;
      }
    },

    /** 产出对指定 origin 生效的 Cookie 头值（本域 + 覆盖本机的父域 cookie 合并） */
    header(origin) {
      let host = origin;
      try { host = new URL(origin).host; } catch { /* 同上 */ }
      host = host.toLowerCase();
      const parts = [];
      for (const [domain, cookies] of store) {
        if (domain !== host && !domainMatches(domain, host)) continue;
        for (const [name, value] of Object.entries(cookies)) {
          parts.push(`${name}=${value}`);
        }
      }
      return parts.length ? { Cookie: parts.join('; ') } : {};
    },

    /** 取指定 origin 下某 cookie 值（本域 + 父域覆盖） */
    get(origin, name) {
      let host = origin;
      try { host = new URL(origin).host; } catch { /* 同上 */ }
      host = host.toLowerCase();
      for (const [domain, cookies] of store) {
        if ((domain === host || domainMatches(domain, host)) && cookies[name]) {
          return cookies[name];
        }
      }
      return null;
    },
  };
}

/** 从任意文本（Location 头 / 响应体 / cookie 值）提取 Bearer 形态 token。
 * 默认只认 Authorization（头/cookie）携带的 Bearer 值；取最长命中避免误截断 */
export function extractToken(text) {
  if (!text) return null;
  const patterns = [
    /Authorization[=:]\s*Bearer\s+([A-Za-z0-9\-._~+/]+=*)/gi,
    /Bearer\s+([A-Za-z0-9\-._~+/]+=*)/g,
  ];
  let best = null;
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      if (!best || match[1].length > best.length) best = match[1];
    }
    if (best) return best;
  }
  return null;
}
