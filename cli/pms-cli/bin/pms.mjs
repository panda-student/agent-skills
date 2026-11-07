#!/usr/bin/env node
// pms-cli 入口：token 生命周期管理
import { tokenManager, describeToken } from '../src/auth.mjs';

const command = process.argv[2] || 'whoami';

async function main() {
  if (command === 'token') {
    const token = await tokenManager.refreshToken();
    process.stdout.write(token);
    return;
  }
  if (command === 'login') {
    const token = await tokenManager.login();
    process.stdout.write(token);
    return;
  }
  if (command === 'whoami') {
    const token = tokenManager.currentToken();
    if (!token) {
      console.log('未登录（无缓存 token），执行: pms login');
      process.exit(2);
    }
    const info = describeToken(token);
    console.log(`账号: ${info.employeeCode || '?'}`);
    console.log(`到期: ${info.expiresAt || '?'}`);
    console.log(`状态: ${info.valid ? '有效' : '已过期（执行 pms token 会自动刷新）'}`);
    return;
  }
  console.log(`pms-cli — PMS token 静默登录

  pms token     获取/刷新 token（缓存有效直接返回，否则走静默 SSO）
  pms login     强制重新登录（打开统一 SSO Profile）
  pms whoami    查看当前缓存 token 状态
`);
}

main().catch((error) => {
  console.error('✗ ' + error.message);
  process.exit(1);
});