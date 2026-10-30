# 果冻风格后台设计

日期：2026-10-30。状态：用户已批准设计与计划，按 Inline 方式连续实施，不逐任务确认。

## 1. 目标与依据

用户认为现有后台过于单调，要求页面丰富、新颖、可爱；已选择 B「果冻游乐场」，并确认以该程度继续写设计和实施计划。
参考：`.superpowers/brainstorm/4680-1793324409/content/playful-styles.html`，切换 B。

本轮改变实际生成的后台，不改变生成平台控制台。保留 Vue 3 + Ant Design Vue。采用原型的立体按钮、柔软卡片、原创插画、内容封面和有节奏的页面层级，不直接搬原型的固定品牌、紫色、云朵或假业务。

## 2. 范围和非目标

新增受控 appearance `jelly`，与现有 plain/soft-glass 并列。已有配置及默认值不变；仅 drafter 对新需求默认推荐 jelly/balanced/comfortable，明确严肃克制需求仍选 plain/minimal。

本轮交付：主题材质、导航/欢迎/模块/卡片的视觉层级、无模型图片时也完整的受控装饰、可选真实封面字段、风格化图片提示、三场景真实导出验收。

不实现收藏、团队协作、活动报名、通知中心、文件上传、头像系统。原型中的这些元素不是正式功能承诺。不得捏造用户、动态、增长率、任务数或进度。已有 CRUD、过滤、路由、工作台统计依旧共享 repository。

## 3. 视觉系统

### 3.1 果冻不是统一调色

颜色来源仍为 theme.colorTokens：primary 用于主要操作与激活态，secondary 用于第二类柔光，accent 用于少量贴纸/装饰。淡色表面从色板和明暗表面派生，不固定紫色。正式样例至少覆盖薄荷/杏黄设备维护、莓粉/蓝素材目录、珊瑚/青报名管理。

使用系统字体，不增加在线字体依赖。标题28–34px、区块标题18–20px、正文14px、辅助信息12px。正文对比度至少4.5:1。小字不放在不受控图片上。

### 3.2 几何与材质

欢迎区28px、卡片20px、普通面板16px、控件12px；仅 jelly 使用这些层级，不改变旧主题。普通表格保持清楚网格及适度圆角。主按钮有浅内高光和短底部阴影，按压位移1px；危险操作不做玩具式强调。

胶囊分类、彩色图标底座、卡片封面区、细腻内描边构成丰富感。各层只使用少量阴影，不给所有块套同样大阴影。暗色采用不透明基底加受控高光，不是浅色透明层简单反转。无 backdrop-filter 时仍有完整实色表面。

### 3.3 动效

hover 卡片最多上移3px，按钮按压1px，持续120–180ms。键盘focus清晰，触屏不依赖hover。prefers-reduced-motion禁用位移和过渡。不加入持续漂浮、闪烁和无用户触发动画。

## 4. 页面构成

### 4.1 欢迎与装饰

新增 presentation.motif 可选受控枚举 `spark | bloom | orbit | toolkit`。仅 jelly 允许该字段；缺省 spark。motif由需求语义选择而不是行业白名单，用户可覆盖。它决定本地SVG装饰，不决定页面业务或数据。

新增 AdminMotif：手写内置 SVG，非任意模型 SVG。四套均提供丰富而克制的形状组，spark为圆润星与气泡，bloom为花与叶，orbit为轨道和圆球，toolkit为圆润工具与积木。全部颜色用CSS变量；纯装饰aria-hidden，不装作可点按钮。尺寸由组件固定CSS确定，不属于生成图片资产，不接受LLM几何。

AdminWelcomePanel继续使用侧车1:1、512×512资产。当有真实图片时显示图片，小型motif只做点缀；无图片时显示完整本地motif，不能出现空白图片区域。插画加载失败转本地motif。原有非jelly欢迎行为不变。minimal禁止欢迎块的既有规则保留，同时关闭jelly纯装饰，仅保留可读控件材质。

### 4.2 导航与页面头

沿用 sidebar/topbar，激活菜单使用胶囊与图标底座，品牌标记圆润但仍来自项目名称。导航仅实际路由，不新增不可用按钮。标题与描述保持业务语气，不强制全行业使用可爱营销话术。移动端保持可用菜单和关闭路径。

### 4.3 列表卡片

cards在jelly下变为封面区+清晰信息区+操作区；table不强制变cards。

新增 list.card.coverField?: string，字段必须存在且是string；字段不存在或为enum等其他类型时由schema拒绝。它是业务记录图片URL，不是生成资产，不添加model image类型。支持受控项目相对路径 `./covers/<文件路径>` 和无凭证的https URL；拒绝站点根路径、协议相对路径、路径穿越及其他协议。相对路径每段仅允许ASCII字母、数字、下划线、短横线与点，禁止空段及单独的`.`/`..`，不接受百分号编码、查询串、片段、反斜杠或空白。文件由使用者放入导出工程的 `public/covers/`，本轮不自动下载或生成业务封面。保持相对URL输出，基于当前文档目录解析；现有hash路由不改变该目录，因此根部署和 `/preview/:id/` 子路径均可用。

平台保留 `img-src 'self' data:`，不放宽CSP、不增加图片代理。第三方https封面仅在独立部署且部署策略允许时显示；平台预览被CSP阻止时正常回退，并在生成README明确说明该限制。其他非法值、空值、文件缺失或加载失败也显示本地占位；minimal下占位不含装饰图形。图片使用loading=lazy、referrerpolicy=no-referrer；外部域仍可能看到请求IP，由最终使用者管理。演示种子不产生外部请求，不编造不存在的本地封面路径。alt使用标题字段纯文本，不用v-html。

只有jelly cards自动生成无图装饰封面；旧cards无coverField保持原布局。有coverField的任何风格可显示真实图片与失败占位。封面不假装真实资产预览，必要时屏幕阅读器说明为装饰占位。支持标题长文本、空值、状态标签及原有action，不新增假收藏按钮。

### 4.4 工作台与表单

工作台依据现有模块kind分层：summary较紧凑数字卡、breakdown分类列表、records较宽主面板、shortcuts胶囊链接。保持真实数据和focus主模块规则，不添加额外仪表指标。图标只用受控映射。

详情aside作为摘要胶囊/分区；grouped表单每组有清晰标题和轻背景。抽屉仍复用同一表单，不分叉校验逻辑。操作成功使用已有提示，不新增虚构庆祝进度。页面密度服从presentation.density。

## 5. 生成链路

Schema限制appearance/motif/coverField，生成器继续const+satisfies与v-bind。drafter先规划业务，再选择风格/纹样/版式；不得输出HTML/CSS/SVG。提示词完整枚举plain/soft-glass/jelly，默认推荐与schema默认值分开说明。现有全局禁止gradient buttons/big marketing illustrations等样式句必须改为按appearance指导：plain克制、soft-glass轻柔、jelly允许受控渐变、短立体阴影及业务插画；各分支仍禁止遮挡业务的大营销卡、夸张宣传和无关装饰摄影，不能保留与jelly目标冲突的全局禁令。生成README解释新入口、封面字段的URL策略、平台CSP限制、本地文件放置方式及模拟数据边界。

图片风格语义直接写入已有styleBible和asset.prompt：jelly可选3d-clay/soft-gradient等已支持枚举，描述圆润、柔软、友好的具体业务对象；不新增独立model请求。palette仍通过effectiveStyleBible统一为primary/secondary/accent并参与hash。motif本身不会改变图片缓存；若需要图像跟随motif，必须让语义实际进入asset.prompt，现有hash自然变化。不提高资产上限、不要求页页生成图。

## 6. 兼容与安全

- 不迁移旧spec；appearance缺省仍soft-glass，presentation不存在保留旧行为。
- 不改变资产几何、hash规范、provider观察内容和构建沙箱。
- decorative SVG不含事件/外链，用户文案只能文本插值。
- 卡片URL明确校验，无data/javascript/file/http/协议相对URL；允许的https第三方域仍存在隐私风险，README明确由使用方管理。
- 不加图表库、动画库或在线字体，不依赖原型页面运行时。

## 7. 验收与门禁

对照B原型的丰富度：至少存在清晰欢迎插画/本地motif、层次化主按钮、彩色图标底座、cards封面区及不同kind工作台形态，而不只是换色。

三场景真实导出vue-tsc+Vite，1440/1024/390，light/dark/both，minimal、无blur、reduced-motion。覆盖CRUD、筛选、分页、批删最后一项、空态、未知id、错误焦点、长文案、图片加载失败、恶意URL。重点检查表面与文字实际组合对比度。

开发时可用本地原创fixture图片，不调付费模型。最终美观必须看到截图/浏览器后才判通过；若工具仍不能返回图像，列为阻塞并请用户直接审阅，不用DOM数值替代。此前旧计划Task8视觉未验是独立未结事项，不能借新设计自动销账。

## 8. Builder决定与代价

- 新增jelly而非重定义soft-glass：增加一种维护分支，换取旧产物不退化。
- motif只选四种受控图形语言：不支持任意装饰，但能测试且不绑定行业。
- coverField只接现有string：不承担上传/图像模型扩展；旧数据无图时有完整设计。
- 不搬协作动态/头像组等原型假业务：正式界面的丰富感主要来自真实内容和装饰，而非不可用功能。
