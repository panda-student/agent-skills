// XML 小工具：属性读取/实体解码/CDATA/标签文本/属性写回（hot/flowprops/buttons/signconfig 共用）
import { esc, unesc } from './flowxml.mjs';

/** 解码 XML 属性实体 */
export function decodeXmlAttr(s) {
  return String(s)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/** 读标签属性；默认缺失返回 undefined，可传 fallback */
export const attrOf = (attrs, name, fallback = undefined) => {
  const m = String(attrs || '').match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`));
  return m ? decodeXmlAttr(m[1]) : fallback;
};

export const stripCdata = s => {
  const m = String(s || '').match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  return m ? m[1] : String(s || '');
};

/** 元素文本：CDATA 原样，普通文本解实体 */
export const textOf = raw => {
  const s = String(raw || '');
  return /<!\[CDATA\[/.test(s) ? stripCdata(s) : unesc(s);
};

/** 标签内文本（自动去首尾空白） */
export const innerText = (xml, tag) => {
  const m = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`));
  return m ? textOf(m[1]).trim() : '';
};

/** 标签间空白归一化，便于 XML 片段比较 */
export const normXml = s => String(s || '').replace(/>\s+</g, '><').trim();

/** 在开标签上写回属性（不存在则追加） */
export const setAttr = (tag, name, value) => {
  const re = new RegExp(`(\\s${name}=")[^"]*(")`);
  if (re.test(tag)) return tag.replace(re, `$1${esc(String(value))}$2`);
  return tag.replace(/\s*(\/?)>$/, m => ` ${name}="${esc(String(value))}"${m.includes('/') ? '/>' : '>'}`);
};