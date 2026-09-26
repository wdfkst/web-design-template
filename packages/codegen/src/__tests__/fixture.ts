import { derivePageAssets, mergeDerivedAssets, type BlockSelection } from '@vudt/blocks'
import { finalizeSpec, ProjectSpecInputSchema, type ProjectSpec } from '@vudt/spec'

const theme = {
  colorTokens: {
    primary: '#4f46e5',
    secondary: '#0ea5e9',
    accent: '#f59e0b',
    background: '#ffffff',
    surface: '#f8fafc',
    foreground: '#0f172a',
    muted: '#64748b',
  },
  radius: 'lg',
  spacing: 'normal',
  fontPair: { heading: 'Inter', body: 'Inter' },
  mode: 'light',
} as const

const styleBible = {
  artStyle: 'flat-vector',
  lineWeight: 'none',
  shading: 'soft-gradient',
  perspective: 'three-quarter',
  palette: ['#4f46e5', '#0ea5e9', '#f59e0b'],
  backgroundTreatment: 'subtle-gradient',
  negativePrompt: 'no text, no watermark',
  seed: 1234,
} as const

/**
 * Builds the spec the way the platform will: block geometry comes from the
 * sidecars via derivePageAssets, never hand-written here. A hand-written
 * fixture could accidentally encode a size the sidecars disagree with, which
 * is exactly the failure these tests exist to catch.
 */
export function landingSpec(): ProjectSpec {
  const home: BlockSelection[] = [
    {
      component: 'HeroSplit',
      props: {
        headline: 'Ship faster',
        subhead: 'A "quoted" & ampersanded subhead',
        primaryCta: { label: 'See pricing', to: '/pricing' },
      },
      content: { illustration: { prompt: 'a developer at a desk', alt: 'Developer at a desk' } },
    },
    {
      component: 'StatsBand',
      props: {
        heading: 'By the numbers',
        stats: [
          { label: 'Users', value: '12k' },
          { label: 'Uptime', value: '99.9', suffix: '%' },
        ],
      },
    },
    {
      component: 'FeatureTriad',
      props: {
        heading: 'Why Acme',
        features: [
          { title: 'Fast', body: 'Very fast.' },
          { title: 'Safe', body: 'Very safe.' },
          { title: 'Simple', body: 'Very simple.' },
        ],
      },
    },
    { component: 'CtaBanner', props: { headline: 'Ready?', cta: { label: 'Choose a plan', to: '/pricing' } } },
  ]

  const pricing: BlockSelection[] = [
    { component: 'HeroCentered', props: { headline: 'Pricing' } },
    {
      component: 'PricingCard',
      props: {
        heading: 'Pick a plan',
        plans: [
          {
            name: 'Pro',
            price: '$29',
            features: ['Unlimited projects', 'Priority support'],
            cta: { label: 'Start with Pro', to: '/' },
            featured: true,
          },
        ],
      },
    },
  ]

  const signin: BlockSelection[] = [
    {
      component: 'AuthPanel',
      props: {
        mode: 'sign-in',
        heading: 'Sign in to Acme',
        fields: [{ label: 'Email', type: 'email' }],
        submitLabel: 'Sign in',
        altActionLabel: 'Create an account',
      },
    },
    { component: 'TestimonialRow', props: { heading: 'Loved by developers' } },
  ]

  const homeDerived = derivePageAssets('/', home)
  const pricingDerived = derivePageAssets('/pricing', pricing)
  const signinDerived = derivePageAssets('/signin', signin)

  const input = {
    meta: {
      name: 'Acme Landing',
      description: 'A marketing landing page for a developer tooling product.',
      targetStack: 'vue3',
      },
    theme,
    styleBible,
    pages: [
      { route: '/', title: 'Home', pageType: 'landing', blocks: homeDerived.blocks },
      { route: '/pricing', title: 'Pricing', pageType: 'landing', blocks: pricingDerived.blocks },
      { route: '/signin', title: 'Sign in', pageType: 'auth', blocks: signinDerived.blocks },
    ],
    assets: mergeDerivedAssets([homeDerived, pricingDerived, signinDerived]),
  }

  return finalizeSpec(ProjectSpecInputSchema.parse(input))
}

/**
 * A back-office spec: collections/forms/operations plus the four app blocks,
 * derived through derivePageAssets like the platform will. Task 3/8 reuse it.
 */
export function dataModelSpec(): ProjectSpec {
  const ordersList: BlockSelection[] = [
    {
      component: 'DataTable',
      props: { heading: '订单列表', collection: 'orders' },
    },
    {
      component: 'StatsGrid',
      props: { heading: '概览', stats: [{ label: '今日订单', value: '128', delta: '+12%', chart: 'line', series: [3, 5, 4, 8, 6, 9, 7] }] },
    },
  ]
  const orderForm: BlockSelection[] = [
    { component: 'FormPanel', props: { heading: '新建订单', form: 'order-form' } },
    { component: 'EmptyStatePanel', props: { headline: '还没有订单', body: '点击「保存订单」创建第一笔订单。' } },
  ]
  const settings: BlockSelection[] = [
    { component: 'FormPanel', props: { heading: '系统设置' } },
    {
      component: 'StatusCard',
      props: { heading: '系统状态', items: [{ label: 'CPU', value: '42%', tone: 'good', chart: 'bar', series: [2, 4, 3, 6, 5] }] },
    },
  ]

  const ordersDerived = derivePageAssets('/orders', ordersList)
  const formDerived = derivePageAssets('/orders/new', orderForm)
  const settingsDerived = derivePageAssets('/settings', settings)

  const input = {
    meta: { name: 'Acme Console', description: 'A back-office management system for orders.', targetStack: 'vue3' },
    theme: {
      colorTokens: {
        primary: '#345b7a',
        secondary: '#5a7d9a',
        accent: '#d97706',
        background: '#f5f6f8',
        surface: '#ffffff',
        foreground: '#1f2937',
        muted: '#6b7280',
      },
      radius: 'sm',
      spacing: 'compact',
      fontPair: { heading: 'Inter', body: 'Inter' },
      mode: 'light',
    },
    styleBible,
    pages: [
      {
        route: '/orders',
        title: '订单管理',
        pageType: 'list-detail',
        blocks: ordersDerived.blocks,
        operations: [
          { id: 'refresh-orders', label: '刷新', kind: 'refresh', target: 'orders' },
          { id: 'export-orders', label: '导出', kind: 'export', target: 'orders' },
          { id: 'create-order', label: '新建', kind: 'route', target: '/orders/new' },
        ],
      },
      { route: '/orders/new', title: '新建订单', pageType: 'form', blocks: formDerived.blocks },
      { route: '/settings', title: '设置', pageType: 'settings', blocks: settingsDerived.blocks },
    ],
    collections: [
      {
        id: 'orders',
        label: '订单',
        model: {
          id: { type: 'string', label: 'ID' },
          customer: { type: 'string', label: '客户' },
          amount: { type: 'number', label: '金额' },
          status: { type: 'enum', label: '状态', options: ['待处理', '已发货', '已完成'] },
          created: { type: 'date', label: '创建日期' },
          active: { type: 'boolean', label: '启用' },
        },
        fields: ['customer', 'amount', 'status', 'created', 'active'],
        seed: 2,
        actions: ['search', 'edit', 'delete', 'export'],
      },
    ],
    forms: [
      {
        id: 'order-form',
        label: '新建订单',
        collection: 'orders',
        fields: [
          { key: 'customer', label: '客户', type: 'string', required: true, placeholder: '客户名称' },
          { key: 'amount', label: '金额', type: 'number', validate: { min: 0, max: 999999 } },
          { key: 'status', label: '状态', type: 'enum' },
        ],
        submit: { label: '保存订单', toast: '订单已保存' },
      },
    ],
    assets: mergeDerivedAssets([ordersDerived, formDerived, settingsDerived]),
  }

  return finalizeSpec(ProjectSpecInputSchema.parse(input))
}
