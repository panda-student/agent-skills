/**
 * Agent Teams - 工具函数
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function generateId(prefix = '') {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString('hex');
  return prefix ? `${prefix}-${timestamp}${random}` : `${timestamp}${random}`;
}

function getTimestamp() {
  return new Date().toISOString();
}

/**
 * 获取本地时间字符串（用于报告显示）
 */
function getLocalTime() {
  return new Date().toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

/**
 * 获取本地时间（仅时间部分）
 */
function getLocalTimeOnly() {
  return new Date().toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

/**
 * 获取本地日期
 */
function getLocalDate() {
  return new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).replace(/\//g, '-');
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function writeFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf-8');
}

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

module.exports = {
  generateId,
  getTimestamp,
  getLocalTime,
  getLocalTimeOnly,
  getLocalDate,
  ensureDir,
  writeFile,
  readFile
};