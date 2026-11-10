# PR 截图上传：GitHub user-attachments

`gh` / REST API 不能把图片写进 PR 正文；截图必须由已登录的网页编辑器上传，拿到 `https://github.com/user-attachments/assets/<uuid>` 后再用 `gh pr edit --body-file` 写回正文。

## 统一登录态

本机的 agent-browser 已配置为通过 `agent-browser-edge\launch-edge.cmd` 启动 Edge，GitHub 网页登录态在 auth-center 的共享 profile：

`C:\Users\Administrator\.auth-center\edge-profile`

该 profile 长期保持 GitHub 登录（`panda-student`），不需要每次重新登录，也不要把 cookie 复制到其他目录。

```bash
agent-browser --profile "C:\Users\Administrator\.auth-center\edge-profile" --session pr-<n> open "<pr-url>"
agent-browser --session pr-<n> eval "document.querySelector('meta[name=user-login]')?.content"
```

`agent-browser doctor` 可能报 `No Chrome binary found`：它检测的是 Chrome，而本机通过自定义 Edge shim 启动，以能否打开页面为准，不要据此判断浏览器不可用。

## 上传流程

GitHub 新编辑器（React）通常没有旧的 `#fc-new_comment_field`，而是 "Paste, drop, or click to add files" 按钮加文件选择器。用 Playwright 连接 agent-browser 已打开的 Edge，监听 `filechooser` 上传：

```js
import { chromium } from "@playwright/test";

const browser = await chromium.connectOverCDP(process.argv[2]); // agent-browser ... get cdp-url
const page = browser.contexts()[0].pages().find((p) => p.url().includes("/pull/<n>"));
await page.getByRole("button", { name: "Edit description" }).click();
const desc = page.locator('textarea[placeholder="Type your description here…"]');
await desc.waitFor({ state: "visible" });
await desc.fill(""); // 在临时编辑区上传，不把占位文本写进正文
const add = page.getByRole("button", { name: "Paste, drop, or click to add files" }).first();
const [chooser] = await Promise.all([page.waitForEvent("filechooser"), add.click()]);
await chooser.setFiles(files); // 顺序与 URL 提取顺序一致
await page.waitForFunction(
  () => /user-attachments\/assets\/[A-Za-z0-9-]+/.test(
    document.querySelector('textarea[placeholder="Type your description here…"]')?.value ?? "",
  ),
  null,
  { timeout: 120000 },
);
const value = await desc.inputValue();
const urls = [...new Set(value.match(/https:\/\/github\.com\/user-attachments\/assets\/[A-Za-z0-9-]+/g) ?? [])];
await page.getByRole("button", { name: "Cancel" }).first().click(); // 丢弃草稿，不要 Update
```

约束：

- 取消编辑而不是保存；附件已经落库，提取到的 URL 可以继续使用。
- 批量上传可能在最后一个文件完成前就返回 URL；逐个校验，404 的单个文件重传并替换正文里的 URL。
- 上传顺序与 `setFiles` 顺序一致，但最终以 PR 页面渲染结果为准。
- 上传完成后 `agent-browser --session pr-<n> close`，并删除临时上传脚本。

## 写回与校验

```bash
gh pr edit <n> --repo <upstream> --body-file <scratch>/pr-body.md
```

校验不要用 Playwright `context.request`（请求超时会打印带 Cookie 的请求头）。重新打开 PR 页面，读取正文图片的 `naturalWidth`：

```js
[...document.querySelectorAll("img")]
  .filter((i) => ["before", "after", "full screen"].includes(i.alt))
  .map((i) => ({ alt: i.alt, nw: i.naturalWidth }));
```

GitHub 会把 `user-attachments/assets/...` 改写为带签名的 `private-user-images.githubusercontent.com/...`；只要 `naturalWidth > 0` 即渲染成功。视频附件用普通链接即可，校验一次 `content-type` 后不要重复请求。

## 常见坑

- 旧文档里的 `#fc-new_comment_field` 只适用于旧编辑器；新编辑器直接找 "Paste, drop, or click to add files"。
- `user-attachments` 的 URL 在未登录请求下可能 404；以登录后的页面渲染为准。
- 上传中提取到的 URL 可能是临时的；等所有 `user-attachments/assets` 稳定后再写回。
- 不要把截图提交到功能分支；临时 assets 分支在正文改用 user-attachments 后删除。
- 任何环节都不打印 Cookie/token；诊断请求头意外回显时，提醒用户在统一 profile 重新登录以轮换 `user_session`。