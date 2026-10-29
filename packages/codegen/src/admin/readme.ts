import type { ProjectSpec } from '@vudt/spec'
import { pageComponentName } from '../naming.js'

export function renderAdminReadme(spec: ProjectSpec): string {
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

## 本工程配置

${spec.pages.map(page => `- 路由 ${JSON.stringify(page.route)}：src/modules/${pageComponentName(page.route)}/index.vue 与 src/modules/${pageComponentName(page.route)}/config.ts。`).join('\n')}

表单标识：${spec.forms.map(form => JSON.stringify(form.id)).join('、') || '未配置表单'}。在 src/data/mock.ts 中维护字段与校验规则。

- src/theme/presentation.ts：材质、装饰、密度与导航壳配置。
- src/theme/tokens.ts、src/theme/generated.css：明暗模式、色板与视觉变量。
- 页面 config.ts：列表 table/cards、详情 sections/aside、表单 single/grouped 和工作台 modules 的受控配置。
- 插画源文件位于 public/assets；配置中的宽高由区块侧车派生，替换图片时保持比例。
- 接入 API 时替换共享 repository，保留页面动作与字段校验，真实认证和权限需自行实现。

## 演示边界

数据在页面之间共享；整页刷新后重置。未绑定集合的设置也仅保存在本次应用会话中。登录页仅为界面演示，不发送凭证，不提供真实认证、权限、API 或数据库。删除只影响本地模拟数据。
`
}
