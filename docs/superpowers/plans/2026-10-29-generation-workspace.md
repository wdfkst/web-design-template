# 生成工作台 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将已批准的三栏视觉原型落地到真实平台，展示阶段内进度与结构/图片实际请求快照。
**Architecture:** 保留现有任务store和约1.5秒轮询。请求边界发出白名单遥测，runner写入轻量任务进度与独立详情集合；web按需拉取详情，终态补拉，路由切换隔离。Ant Design Vue控件配合集中CSS tokens和本地装饰SVG。
**Tech Stack:** Vue 3、Ant Design Vue、TypeScript、Fastify、Vitest。
**Spec:** docs/superpowers/specs/2026-10-29-generation-workspace-design.md

## Global Constraints

- 不记录headers、密钥、环境变量；prompt只按文本展示。实际发送快照不能用当前默认prompt重建。
- 不伪造整体百分比、token流、心跳或局部重试能力。保留真实现有重试新任务语义。
- 不改生成模板，不提交推送；在现有worktree内实施，不覆盖前一计划未提交改动。
- 任务仍为内存态；服务重启前检查活动任务，不清除用户测试任务而不告知。
- 旧任务与可选callback兼容；新增元数据不能进入生成spec的hash。
- 文件>200行分段读；长命令输出重定向。

## Review Focus

- provider promise未resolve时，进度与请求已可查询；不是finally才出现。
- 图片缓存命中/去重不记假调用；多次attempt的prompt不会相互覆盖。
- 已知密钥出现在校验反馈时脱敏；list不返回大prompt；超限明确标记。
- 任务A切B时延迟响应不覆盖B；终态最终详情仍拉取且无残留timer。
- 旧任务无遥测字段、模型错误、空图片任务与窄屏均保持可用。

## Task 1：任务遥测存储与读取契约

**Files:** 新建server/src/task-observability.ts及测试；扩展现有任务store、task路由、runner依赖（按探索确认实际文件）。
**Interfaces:** TaskEvent为轻量递增seq、时间、stage、state、message及可选attempt/assetId；TaskRequest只允许kind、id、attempt、model、安全parameters、messages或prompt、startedAt、finishedAt、status及安全错误摘要。task视图只带当前stage与revision；GET /tasks/:id/observability返回事件与请求。设保留上限并标记截断，不把大文本放list。
- [ ] 写store隔离、事件顺序、请求状态更新、无密钥/headers、超限标记、未知任务404测试，观察RED。
- [ ] 实现白名单记录器、已知密钥脱敏与HTTP读取，callback可选。
- [ ] 运行server测试与typecheck，记录GREEN。

## Task 2：接通实际请求与构建事件

**Files:** providers/openai-spec-drafter.ts、providers/openai-image-provider.ts（以探索结果为准）、imagegen执行层、build/pipeline.ts、server/runner.ts及对应测试。
**Interfaces:** request开始/完成/失败observer在实际fetch/generate边界调用；结构messages从实际请求对象捕获，图片prompt从实际provider入参捕获；build阶段事件由真实步骤前后触发，runner立即更新store。既有onProgress不破坏。
- [ ] deferred promise测试：未返回时request-started与完整消息已读到；失败与反馈重试保留独立快照；图片入参相等及缓存命中无调用；观察RED。
- [ ] 增加optional observer及runner桥接；事件顺序代码→图片→类型检查→Vite，失败标当前阶段，不回写为成功。
- [ ] provider/imagegen/build/server定向测试与typecheck，再全仓测试。

## Task 3：前端真实进度和请求检查器

**Files:** web/src/api/client.ts；新增composables/useTaskObservability.ts及测试、components/RequestInspector.vue、components/TaskTimeline.vue及组件测试；修改TaskDetail.vue。
**Interfaces:** 按taskId和revision拉独立详情；初次和终态强制读；Abort/序号屏蔽旧响应；失败保留上次内容并显示错误；复制失败支持手动选择。
- [ ] API路径/错误、任务切换、终态补拉、卸载停止、恶意prompt文本、结构/图片切换、尝试选择测试RED。
- [ ] 实现时间线/事件/请求面板，只读实际记录；老任务明确无快照；不再将asset.prompt标为最终请求。
- [ ] web test/typecheck通过。

## Task 4：落实已批准的控制台视觉

**Files:** web/src/App.vue、main.ts、views/TaskList.vue、TaskDetail.vue、SettingsView.vue；新增styles/workspace.css、components/GenerationArtwork.vue、theme配置及组件测试。
**Interfaces:** 路由不改；保持创建/重试/导出事件；任务详情按id key重建；CSS前缀防止影响生成预览；SVG只装饰。
- [ ] 写真实导航、创建后到详情、页面/图片选择、预览只ready可用、保留配置表单与导出组件测试，观察RED。
- [ ] 三栏布局、冷银/钴蓝主题、背景点阵和本地插画；响应式与明暗，移除模拟按钮；列表/设置采用相同视觉。
- [ ] web test/typecheck/build；不靠字符串包含断言代替交互测试。

## Task 5：全链验证与交付

**Files:** server集成测试；docs/superpowers/verification/2026-10-29-generation-workspace.md。
- [ ] HTTP任务deferred drafter验证正在请求时可读事件和提示词；完成后最终请求状态正确；列表无prompt；预览导出回归。
- [ ] 全仓pnpm test/typecheck/build，输出日志并记录。
- [ ] 独立终审一次，核实重要发现，以RED→GREEN修复；Minor记录不扩大范围。
- [ ] 检查运行实例活动任务，在安全时重新启动最新平台；浏览器真实手验，无证据则明确未验。保持用户.env仅用于加载，不输出秘密。

## 实施决定

用户已选择inline连续执行，本轮按其明确“改造平台并接上”的授权执行，不重复问执行方式。后端文件名由只读探索确认后落盘补全，涉及对外接口与安全策略的设计不随探索改变。
