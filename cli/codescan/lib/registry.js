'use strict';
const path = require('path');
const { assertAdapter } = require('./tool');

/** 内置工具模块(唯一直接依赖具体实现的地方,新增内置工具只改这里) */
function builtinTools() {
  return [
    require('./runners/jscpd'),
    require('./runners/astgrep'),
    require('./runners/pmd'),
    require('./runners/eslint'),
    require('./runners/vuetsc'),
    require('./runners/knip'),
  ];
}

/**
 * 工具注册表:scan 只依赖这个接口,不感知具体工具实现。
 * 同名注册 + override 即可在运行时替换内置工具。
 */
class ToolRegistry {
  constructor() {
    this.tools = new Map();
  }

  register(adapter, { override = false } = {}) {
    assertAdapter(adapter);
    if (!override && this.tools.has(adapter.name)) {
      throw new Error(`工具已注册: ${adapter.name}(用 override 替换)`);
    }
    this.tools.set(adapter.name, adapter);
    return this;
  }

  get(name) {
    return this.tools.get(name) || null;
  }

  has(name) {
    return this.tools.has(name);
  }

  list() {
    return [...this.tools.values()];
  }

  names() {
    return [...this.tools.keys()];
  }

  /** 按检测到的语言自动选择工具(语言路由由适配器自己声明) */
  autoSelect(langs, hasVue) {
    const detected = new Set(langs);
    if (hasVue) detected.add('vue');
    return this.list()
      .filter((t) => t.languages.includes('*') || t.languages.some((l) => detected.has(l)))
      .map((t) => t.name);
  }
}

function createDefaultRegistry() {
  const registry = new ToolRegistry();
  for (const tool of builtinTools()) registry.register(tool);
  return registry;
}

/**
 * 从外部模块加载工具适配器,用于替换或扩展内置工具。
 * 模块可导出单个适配器或适配器数组;同名时覆盖内置工具。
 */
function loadToolModules(registry, modules = []) {
  for (const spec of modules) {
    const abs = path.resolve(spec);
    let mod;
    try {
      mod = require(abs);
    } catch (e) {
      throw new Error(`加载工具模块失败 ${spec}: ${e.message}`);
    }
    const items = Array.isArray(mod) ? mod : [mod];
    for (const item of items) registry.register(item, { override: true });
  }
  return registry;
}

module.exports = { ToolRegistry, createDefaultRegistry, loadToolModules };