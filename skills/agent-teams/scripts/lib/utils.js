/**
 * Agent Teams - 工具函数
 *
 * 提供通用的工具函数
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * 生成唯一ID
 * @param {string} prefix - ID前缀
 * @returns {string} 唯一ID
 */
function generateId(prefix = '') {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString('hex');
  return prefix ? `${prefix}-${timestamp}${random}` : `${timestamp}${random}`;
}

/**
 * 获取ISO时间戳
 * @returns {string} ISO格式时间戳
 */
function getTimestamp() {
  return new Date().toISOString();
}

/**
 * 确保目录存在
 * @param {string} dirPath - 目录路径
 */
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * 安全读取JSON文件
 * @param {string} filePath - 文件路径
 * @param {*} defaultValue - 默认值
 * @returns {*} 解析后的数据或默认值
 */
function readJSON(filePath, defaultValue = null) {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.error(`读取JSON失败: ${filePath}`, error.message);
  }
  return defaultValue;
}

/**
 * 安全写入JSON文件
 * @param {string} filePath - 文件路径
 * @param {*} data - 数据
 * @param {boolean} pretty - 是否美化输出
 */
function writeJSON(filePath, data, pretty = true) {
  ensureDir(path.dirname(filePath));
  const content = pretty
    ? JSON.stringify(data, null, 2)
    : JSON.stringify(data);
  fs.writeFileSync(filePath, content, 'utf-8');
}

/**
 * 安全读取YAML文件（简化版，只支持基本解析）
 * @param {string} filePath - 文件路径
 * @param {*} defaultValue - 默认值
 * @returns {*} 解析后的数据或默认值
 */
function readYAML(filePath, defaultValue = null) {
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return parseSimpleYAML(content);
    }
  } catch (error) {
    console.error(`读取YAML失败: ${filePath}`, error.message);
  }
  return defaultValue;
}

/**
 * 简单YAML解析器（支持嵌套对象和数组）
 * @param {string} content - YAML内容
 * @returns {object} 解析后的对象
 */
function parseSimpleYAML(content) {
  const result = {};
  const lines = content.split('\n');
  const stack = [{ obj: result, indent: -1 }];

  for (const line of lines) {
    // 跳过注释和空行
    if (line.trim().startsWith('#') || line.trim() === '') continue;

    // 检测缩进
    const indent = line.search(/\S/);
    const trimmed = line.trim();

    // 数组项
    if (trimmed.startsWith('- ')) {
      const parent = stack[stack.length - 1];
      if (Array.isArray(parent.obj)) {
        const value = trimmed.slice(2).trim();
        if (value.includes(': ')) {
          const obj = {};
          const [k, v] = value.split(': ', 2);
          obj[k] = parseValue(v);
          parent.obj.push(obj);
        } else {
          parent.obj.push(parseValue(value));
        }
      }
      continue;
    }

    // 键值对
    if (trimmed.includes(':')) {
      const colonIndex = trimmed.indexOf(':');
      const key = trimmed.slice(0, colonIndex).trim();
      const value = trimmed.slice(colonIndex + 1).trim();

      // 弹出栈直到当前缩进级别
      while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
        stack.pop();
      }

      const current = stack[stack.length - 1].obj;

      // 检查是否是嵌套对象或数组
      if (value === '' || value.startsWith('|')) {
        // 检查下一行是否是数组
        const nextLineIdx = lines.indexOf(line) + 1;
        const nextLine = lines[nextLineIdx] || '';
        if (nextLine.trim().startsWith('-')) {
          current[key] = [];
        } else {
          current[key] = {};
          stack.push({ obj: current[key], indent: indent });
        }
      } else {
        current[key] = parseValue(value);
      }
    }
  }

  return result;
}

/**
 * 解析YAML值
 * @param {string} value - 字符串值
 * @returns {*} 解析后的值
 */
function parseValue(value) {
  // 移除引号
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }

  // 数字
  if (/^-?\d+$/.test(value)) {
    return parseInt(value, 10);
  }
  if (/^-?\d+\.\d+$/.test(value)) {
    return parseFloat(value);
  }

  // 布尔值
  if (value === 'true') return true;
  if (value === 'false') return false;

  // null
  if (value === 'null' || value === '~') return null;

  return value;
}

/**
 * 对象转YAML字符串（简化版）
 * @param {object} obj - 对象
 * @param {number} indent - 缩进级别
 * @returns {string} YAML字符串
 */
function toYAML(obj, indent = 0) {
  const spaces = '  '.repeat(indent);
  const lines = [];

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      lines.push(`${spaces}${key}: null`);
    } else if (Array.isArray(value)) {
      lines.push(`${spaces}${key}:`);
      for (const item of value) {
        if (typeof item === 'object' && item !== null) {
          lines.push(`${spaces}  -`);
          for (const [k, v] of Object.entries(item)) {
            lines.push(`${spaces}    ${k}: ${formatYAMLValue(v)}`);
          }
        } else {
          lines.push(`${spaces}  - ${formatYAMLValue(item)}`);
        }
      }
    } else if (typeof value === 'object') {
      lines.push(`${spaces}${key}:`);
      lines.push(toYAML(value, indent + 1));
    } else {
      lines.push(`${spaces}${key}: ${formatYAMLValue(value)}`);
    }
  }

  return lines.join('\n');
}

/**
 * 格式化YAML值
 * @param {*} value - 值
 * @returns {string} 格式化后的字符串
 */
function formatYAMLValue(value) {
  if (typeof value === 'string') {
    // 如果包含特殊字符，添加引号
    if (/[:#\[\]{}|>]/.test(value) || value.includes('\n')) {
      return `"${value.replace(/"/g, '\\"')}"`;
    }
    return value;
  }
  if (value === true) return 'true';
  if (value === false) return 'false';
  if (value === null) return 'null';
  return String(value);
}

/**
 * 安全写入YAML文件
 * @param {string} filePath - 文件路径
 * @param {object} data - 数据
 */
function writeYAML(filePath, data) {
  ensureDir(path.dirname(filePath));
  const content = `# 自动生成 - ${getTimestamp()}\n\n` + toYAML(data);
  fs.writeFileSync(filePath, content, 'utf-8');
}

/**
 * 追加写入文件
 * @param {string} filePath - 文件路径
 * @param {string} content - 内容
 */
function appendFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.appendFileSync(filePath, content + '\n', 'utf-8');
}

/**
 * 读取文件内容
 * @param {string} filePath - 文件路径
 * @returns {string|null} 文件内容或null
 */
function readFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8');
    }
  } catch (error) {
    console.error(`读取文件失败: ${filePath}`, error.message);
  }
  return null;
}

/**
 * 写入文件
 * @param {string} filePath - 文件路径
 * @param {string} content - 内容
 */
function writeFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf-8');
}

/**
 * 列出目录中的文件
 * @param {string} dirPath - 目录路径
 * @param {string} pattern - 文件模式（简化版，仅支持扩展名）
 * @returns {string[]} 文件列表
 */
function listFiles(dirPath, pattern = null) {
  try {
    if (!fs.existsSync(dirPath)) return [];

    const files = fs.readdirSync(dirPath);
    if (pattern) {
      // 简单的扩展名匹配
      if (pattern.startsWith('*.')) {
        const ext = pattern.slice(1);
        return files.filter(f => f.endsWith(ext));
      }
      return files.filter(f => f.includes(pattern));
    }
    return files;
  } catch (error) {
    console.error(`列出目录失败: ${dirPath}`, error.message);
    return [];
  }
}

/**
 * 删除文件
 * @param {string} filePath - 文件路径
 */
function deleteFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error(`删除文件失败: ${filePath}`, error.message);
  }
}

/**
 * 计算简单校验和
 * @param {string} content - 内容
 * @returns {string} 校验和
 */
function checksum(content) {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}

module.exports = {
  generateId,
  getTimestamp,
  ensureDir,
  readJSON,
  writeJSON,
  readYAML,
  writeYAML,
  appendFile,
  readFile,
  writeFile,
  listFiles,
  deleteFile,
  checksum,
  parseSimpleYAML,
  toYAML
};