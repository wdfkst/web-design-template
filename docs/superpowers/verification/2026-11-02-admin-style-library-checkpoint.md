# 后台风格库阶段检查点

日期：2026-11-02。按用户“先这样，上传到github”要求保存当前阶段；不表示全部验收完成。

## 当前范围

- Task 1–7 已实现：版本化五风格注册表、确定性应用、任务引用快照、drafter 上下文、材质提示词与缓存、五套模板布局、真实静态预览构建。
- Task 8 已实现风格选择、详情展示、隔离预览；后续已修开发服务预览 CORS 与 iframe load 误判成功。
- 就绪协议检查当前 iframe、opaque origin、session 和路由；子应用确认路由渲染、图片和样式后通知父页面，失败或超时可重试。sandbox 保持仅 allow-scripts。

## 本次验证

- 最终 `pnpm test`：94 个文件、1002 个测试通过，exit 0。
- 最终 `pnpm typecheck`：exit 0。
- `pnpm build:admin-previews`、`pnpm check:admin-previews`：exit 0。
- `git diff --check`：exit 0，存在 LF→CRLF 提示。
- 测试仍有既有 Vue/jsdom 提示，不声称零警告。
- 本地 Playwright + Edge：五套风格 × 工作台/订单列表/商品编辑共 15 组合实际就绪、内容及图片检查通过；正常路径无 pageerror。未临时补 CORS 响应头。
- 分别阻断 JS、CSS、图片：均出现失败提示，解除阻断后重试成功。

## 未完成项

- iframe 内部焦点下 Escape 不关闭、Tab 可越过弹层的已知问题仍待修复。
- 五套三页桌面/移动端完整视觉验收尚未完成，不能将 DOM/就绪检查等同视觉通过。
- Task 9 跨链验收和覆盖全部改动的独立整支评审尚未执行。

本次未调用付费模型；临时 4318 服务已停止，未操作现有 4300 服务。静态制品由构建命令重建，不提交本地配置、构建产物和诊断截图。
