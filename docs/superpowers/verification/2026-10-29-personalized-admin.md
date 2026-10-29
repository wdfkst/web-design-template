# 个性化后台验收记录

日期：2026-10-29。范围：本计划基线 `4f3831b` 之后的个性化后台变更。未调用付费模型，未推送或合并。

## 自动化验证

- 三场景：设备维护 table/grouped/focus；素材目录 cards/aside/overview；报名管理 plain/minimal/table。
- 各场景执行侧车派生、schema parse、finalize、generate、write，并在实际导出目录运行 vue-tsc 和 Vite：3/3 通过。
- 资产文件与配置消费者核对通过。图片为本地 1px PNG 测试夹具，不是模型生成图片，不用于评估插画美观。
- 全仓 `pnpm typecheck`、`pnpm test`、`pnpm build`：exit 0。最终测试共 686 例（76+85+60+118+98+32+66+30+121）。此前记录的782是加总错误，修复前实际为682，并非测试数量减少。
- `git diff --check`：通过；Git 提示 LF/CRLF 转换。构建存在大 chunk 警告，组件测试保留既有 stub/lifecycle 警告。

## 浏览器实测

使用本地 Chrome + 缓存 playwright-core，访问实际导出工程：4310 素材目录、4311 设备维护、4312 报名管理；不是 4302 平台控制台。

- 三场景分别检查 1440/1024/390：DOM 几何无页面级横向溢出。390 下展开导航、点击露出的遮罩关闭通过。
- 顶部导航分组用键盘 Enter 打开、选择素材目录后路由跳转通过。
- cards/table：筛选名称、详情、返回列表、编辑并保存、创建后记录总数 12→13、工作台聚合更新、批删确认、未知 id 空态通过。
- both 模式随系统切换后 `data-admin-mode` 更新为 dark/light。按钮主色保持主题主色；此项不等于全部对比度验收。
- 带引号、换行和 `</script>` 的标题作为文字显示，生成配置转义测试通过。
- 禁用 backdrop-filter 和 reduced-motion 环境下页面运行，无 pageerror；视觉可读性尚未确认。
- 空表单保存显示“请填写名称”，修复后焦点进入 `field-maintenance-form-name`，实际工程复验通过。
- 补充三场景列表 × 明暗 × 1440/1024/390，共18组：页面无横向溢出；列表面板中的标题、辅助文字、表格单元格抽样对比度，浅色最低4.55:1、深色最低8.59:1，均达到4.5:1目标。仅覆盖不透明列表面板抽样，不代表所有叠层、交互状态和文字的对比度。原始数据：`task-8-visual-metrics.log`。

## 发现并修复

1. 后台 HTML 标题固定：三场景集成测试 RED，底座改用 `__PROJECT_NAME__` 后 3/3 GREEN。
2. 校验错误未聚焦：`record-form.test.ts` 新测试 RED，共享字段组件校验后聚焦首个错误字段，4/4 GREEN，全仓通过。

## 尚未完成 / 限制

- 九份尺寸截图及 dark/no-blur 截图已保存在本地计划工作区，但浏览器 MCP 与图片 Read 没有返回可见图像，未完成肉眼视觉审阅。不能把截图存在当作视觉通过。
- 没有使用真实插画；插画最终审美、明暗对比度和无模糊降级的视觉检查仍待完成。
- 独立整支代码评审已完成（4f3831b..222091c，原结论 With fixes）。确认的工作台图标缺失已修复：四种模块真实 SVG 测试从3失败/1通过到4/4通过，最终全仓686通过，typecheck/build通过。未另派复审；本记录不是发布批准。

## 评审裁定与暂缓项

- 旧CSS变量缺失不是已证回归：消费者有fallback或personalized门控，保留旧行为；后续共享组件需注意变量契约。
- glow-c无消费者降为轻微样式缺口：accent仍进入插画色板，暂不增加未经视觉验证的装饰。
- 删除最后一项残留选择的缺陷结论不成立：确认回调清空selected；缺直接边界断言作为测试债。
- README签名和目录分类项已核对，无需修改。
- 评审搁置的插画审美和像素审阅仍未验；对比度只有面板抽样；both模式采用实际浏览器属性切换证据，不代表全量视觉通过。

暂缓6项：旧新主题变量契约不同源；glow-c界面未消费；cards最后一项删除直接断言；records数值排序独立测试；错误聚焦全局id在同form重复挂载下的歧义；surface按模式调整可能覆盖用户自定义背景。

证据位于 `.superpowers/sdd/2026-10-29-personalized-admin/`：`task-8-exports.log`、`task-8-browser.log`、`task-8-crud.log`、`task-8-focus-red.log`、`task-8-focus-green.log`、`task-8-types.log`、`task-8-suite.log`、`task-8-build.log`。浏览器脚本早期输出的导航 URL 及 body 背景值不用于主题结论；路由与主题属性另经等待断言验证。
