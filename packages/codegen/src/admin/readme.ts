export function renderAdminReadme(): string {
  return `# Vue 3 后台工程

基于 Vue 3、Ant Design Vue、Vue Router 和 TypeScript。

## 开发

使用 Node.js 20.19+ 或 22.12+，安装 pnpm 后执行：

\`\`\`sh
pnpm install
pnpm dev
pnpm typecheck
pnpm build
\`\`\`

## 扩展入口

- src/modules：业务页面入口与页面配置；集合类型位于对应模块 types.ts。
- src/navigation.ts：菜单与品牌名称。
- src/router.ts：hash 路由与页面元信息。
- src/theme/tokens.ts、generated.css：Ant Design Vue 与布局主题。
- src/data/mock.ts：模型、表单和模拟种子数据。
- src/data/repository.ts、src/composables/useAdminCollection.ts：共享数据访问层，后续 API 接入从这里替换，不必重写页面。

## 演示边界

数据在页面之间共享；整页刷新后重置。未绑定集合的设置也仅保存在本次应用会话中。登录页仅为界面演示，不发送凭证，不提供真实认证、权限、API 或数据库。删除只影响本地模拟数据。
`
}
