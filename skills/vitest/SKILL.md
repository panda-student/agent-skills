---
name: vitest
description: 前端 vitest 单测经验——.vue 组件级测试的 transform 配置、组件依赖链隔离（bos-pc CJS 具名导出）、纯函数 call 风格的 this 互调模拟、异步回填断言等待。写 .vue 组件测试、测试报 Transform 错误、CommonJS 具名导出报错、methods.call 断言失败时使用
user-invocable: true
allowed-tools:
  - Read
  - Grep
  - Glob
  - Bash(npm *)
---

前端 vitest 单测专家。给 pms_frontend（Vue2 + vite + vitest）写组件级单测时按以下经验执行，四条坑均已实证（2026-10-23 ConditionEditor 8 用例）。

## 坑1：vitest.config.js 与 vite.config.js 相互独立，.vue 测试需单独补插件

项目用独立 `vitest.config.js`（include `test/**/*.test.js` + `@` alias），**不继承 vite.config.js 的插件**——跑 `.vue` 组件测试报 `TransformPluginContext.error`（no tests collected）。

修复：vitest.config.js 补 vue2 插件（不加新依赖，与 vite.config.js 同源）：

```js
import vue2 from '@vitejs/plugin-vue2'
export default defineConfig({
  plugins: [vue2()],
  test: { environment: 'node', include: ['test/**/*.test.js'] },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } }
})
```

## 坑2：组件链引入 bos-pc，node 下 CJS 具名导出报错

被测 .vue import 子组件（如 OrgFieldPicker/UserFieldPicker），子组件 api 模块链路拉进 `bos-pc`（其内部 `import { Loading } from 'bos-ui'` 是 CJS），node ESM 互操作报：

```
SyntaxError: Named export 'Loading' not found. The requested module 'bos-ui' is a CommonJS module
```

修复：**纯函数 call 风格测试用不到 DOM，直接 vi.mock 掉子组件切断依赖链**（注意 .vue 后缀也要 mock）：

```js
vi.mock('@/views/advanced/components/OrgFieldPicker.vue', () => ({ default: { name: 'OrgFieldPicker' } }))
vi.mock('@/views/advanced/components/UserFieldPicker.vue', () => ({ default: { name: 'UserFieldPicker' } }))
```

## 坑3：methods.call(ctx) 需全量绑定 methods 模拟 Vue this 互调

不 mount DOM 的组件测试常用 `ConditionEditor.methods.xxx.call(ctx, ...)`。但方法之间经 `this.xxx()` 互调，ctx 是普通对象会报 `this.valueTypeOf is not a function`。

修复：makeCtx 里把**全部 methods 以 ctx 为 this 绑定挂载**，模拟 Vue 实例语义：

```js
function makeCtx(extra = {}) {
  const ctx = Object.assign({ fields: [], operators: [], moduleCode: '', optionCache: {}, $set: (o, k, v) => { o[k] = v; } }, extra)
  Object.keys(Component.methods).forEach(name => { ctx[name] = Component.methods[name].bind(ctx) })
  return ctx
}
```

## 坑4：fire-and-forget .then 异步回填，断言需宏任务等待

方法内部 `api().then(r => this.$set(cache, k, list))` 是同步返回、异步回填（先写空数组占位）。测试 `await m.ensureOptions.call(...)` 等 microtask 前断言 cache 仍是 `[]`。

修复：断言前加一个宏任务兜底等回调跑完：

```js
await m.ensureOptions.call(ctx, '所属单位')
await new Promise(r => setTimeout(r, 0))
expect(ctx.optionCache['所属单位']).toEqual([...])
```

## 排查顺序

写 .vue 组件测试报错时按此定位：Transform 报错 → 坑1；CJS 具名导出报错 → 坑2；`this.xxx is not a function` → 坑3；断言拿到占位空数组 → 块4。
