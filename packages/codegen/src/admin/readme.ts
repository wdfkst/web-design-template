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

## 果冻风格与封面

src/theme/presentation.ts 的 appearance 支持 plain / soft-glass / jelly，旧缺省仍为 soft-glass。仅 jelly 可配置 motif：spark、bloom、orbit、toolkit；省略时使用 spark。decoration:minimal 关闭纯装饰。src/theme/jelly.css 负责果冻样式，AdminMotif.vue 是本地受控图形，不消耗生成图片预算。

列表 card.coverField 引用集合现有 string 字段（不接受 enum）；真实封面文件放在 public/covers，例如 public/covers/sample.png 对应字段值 ./covers/sample.png，public/covers/sample.svg 对应 ./covers/sample.svg（SVG 请使用可信资源）。路径相对于项目文档目录解析，兼容平台 /preview/:id/ 子路径与 hash 路由；不使用 /covers/... 站点根路径。不支持路径穿越、编码路径、查询或片段。本功能不自动下载、上传或生成业务封面。

自动生成的 string 种子值只是演示文本，不是可加载的图片路径；即使配置了 coverField，初始记录也可能全部显示占位。请先放入真实文件，再在 src/data/mock.ts 的对应集合种子记录中，将 coverField 指向的字段值替换为上述相对路径；仅放文件或仅设置 coverField 不会自动关联封面。也可通过包含该字段的表单修改当前记录，但整页刷新后仍会恢复种子数据。

无凭证 HTTPS 图片仅在部署策略允许时显示。平台预览 CSP 保持 img-src 'self' data:，第三方 HTTPS 图片会被阻止并回退为占位；独立部署由使用者管理域名与 CSP。图片使用 no-referrer，但第三方仍可能获取请求 IP，请自行评估隐私。缺图、非法 URL、加载失败均回退，minimal 使用无装饰占位。旧 cards 未配置 coverField 时保留原布局。

## 演示边界

数据在页面之间共享；整页刷新后重置。未绑定集合的设置也仅保存在本次应用会话中。登录页仅为界面演示，不发送凭证，不提供真实认证、权限、API 或数据库。删除只影响本地模拟数据。
`
}
