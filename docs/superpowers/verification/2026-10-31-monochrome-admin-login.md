# 黑白登录与退出验收

日期：2026-10-31。工作树 `worktree-modern-admin-generator`，HEAD `1593e66`；全部修改未提交。旧生成产物不变，不调用付费模型，不改侧栏结构及样式。

## 自动化证据

日志目录：`.superpowers/sdd/2026-10-31-monochrome-admin-login/`。

- `task-4-baseline.log`：改动前全仓808测试通过。
- `task-4-layout-red.log`：3失败7通过，缺失演示用户和退出入口。
- `task-4-layout-green.log`：10/10通过；真实会话、实际自定义路由、退出后返回拦截、导航取消/抛错、重复点击及重试。
- `task-4-export.log`：`admin-auth.test.ts` 三形态各实际运行 vue-tsc 和 Vite，通过。使用现有 derive/finalize fixture，不手写几何，不新增依赖。
- `task-4-suite.log`：全仓83文件815测试通过。
- `task-4-typecheck.log`：`pnpm typecheck` 退出0。
- `task-4-diff.log`：`git diff --check` 退出0。
- 既有 jsdom、Vue lifecycle/stub 等警告仍存在，不宣称日志零警告。

## 浏览器验证

使用新建 `.superpowers/auth-browser-6l3QMd/` 中三个独立导出，不覆盖平台任务。通过 Playwright 执行带失败断言的实际交互：

- `/items?view=recent` 未登录跳转 `/signin`，登录后准确返回原目标。
- 填充公开演示账号后提交，进入后台并出现退出入口；刷新仍保持登录。
- 退出清除会话并回到登录页；再次访问后台及浏览器返回仍被拦截。
- 错误凭证有错误提示；密码显隐切换真实 input 类型。
- 账号 Tab 到密码，密码 Enter 提交成功。
- sessionStorage getter 抛错的独立浏览器上下文仍可登录和退出。
- 无 auth 导出可直接进入后台且没有退出入口；auth-only 提交停留登录页，不出现后台 chrome。
- 1440、1024、390宽度登录页均无页面横向溢出；390宽度后台也无溢出。
- 生成插画文件缺失时显示本地机器人回退；reduced-motion 媒体设置已启用。动画视觉观感未确认。
- 最后一轮登录、退出、返回路径没有 pageerror。

## 视觉状态与截图

截图位于日志目录 `login-1440.png`、`login-1024.png`、`login-390.png`。截图与 Read 图片工具本轮仍无可见图像输出。以上只代表交互、DOM和布局边界验证，**不代表审美或原型还原已经通过**，须用户打开预览确认。

## 本轮服务

仅启动以下独立验收服务，未停止或重启用户已有平台服务：

| 形态 | URL | 后台任务 ID |
| --- | --- | --- |
| 自定义登录+后台 | http://127.0.0.1:58131/#/signin | bqwjlorc9（PID 58324） |
| 无登录页 | http://127.0.0.1:58132/#/workspace | bw3z1wjrv（PID 59604） |
| 只有登录页 | http://127.0.0.1:58133/#/signin | bq9s6i5j2（PID 63476） |

启动命令在当前工作树根执行：`node packages/templates/vue3-admin/node_modules/vite/bin/vite.js .superpowers/auth-browser-6l3QMd/<形态> --host 127.0.0.1 --port <端口> --strictPort`。服务保留供确认；以上是启动记录，后续会话使用前需重新探测存活情况。

## 裁定

- 独立导出测试是已有登录实现的构建回归证据，不人为制造失败；退出行为由 layout 真实路由/会话测试提供 RED→GREEN；README说明不做脆弱字符串测试。App接线用完整浏览器闭环确认。
- 导航拒绝/异常不恢复已退出会话，显示提示并允许重试；失败时可能暂留原后台画面，但后续导航仍受守卫约束。本功能不是安全认证边界。

用户于2026-10-31查看本轮预览后回复“没问题”，本次视觉确认已获得；这不改变工具截图本身不可见的事实。独立只读评审已通过：最终结论 Ready to merge: Yes，无 Critical/Important。未提交、推送或合并。

## 评审收尾

三项非阻断建议暂缓，不扩展本轮修改：
1. auth-only 未知路径的404返回链接回退 `/`，仍落404；后续可改为登录入口。
2. 部署 pathname 的尾斜杠/大小写变体不共享演示会话；避免盲目归一化合并不同部署。
3. 相同插画 src 瞬时加载失败后无就地重试；当前回退符合规格，未来增加重试交互时再处理。

复核裁定：视觉由用户确认，工具不可见不冒称自动视觉通过；既有警告和legacy非admin路由不扩展处理；README说明不做字符串测试。沿用已记录的存储双失败、返回目标严格白名单、退出导航失败暂留画面三个边界。代价分别为极端存储故障刷新可能恢复演示状态、路由变体回退首页、导航失败时旧画面暂留；均不改变演示非安全认证边界的定位。

Task 1–4 已完成，后续恢复先读本文件与计划/ledger，不重做实现。待用户另行指示提交或后续工作；保留日志及独立预览用于交接。
