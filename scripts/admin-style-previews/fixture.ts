export function createCoffeePreviewDraft() {
  return {
    meta: { name: '拾光咖啡 · 示例后台', description: '所有记录与数字均为本地示例，操作不会写入真实业务。', targetStack: 'vue3' },
    theme: { colorTokens: { primary: '#6A7353', secondary: '#9A6247', accent: '#A4783D', background: '#F7F3E9', surface: '#FFFCF5', foreground: '#302E26', muted: '#716C60' }, radius: 'md', spacing: 'normal', mode: 'light', fontPair: { heading: 'system-ui', body: 'system-ui' } },
    styleBible: { artStyle: 'hand-drawn', lineWeight: 'thin', shading: 'soft-gradient', perspective: 'three-quarter', palette: ['#6A7353', '#9A6247'], backgroundTreatment: 'subtle-gradient', negativePrompt: 'text, watermark', seed: 42 },
    experience: { kind: 'admin', navigation: [{ id: 'home', label: '工作台', route: '/' }, { id: 'orders', label: '订单列表', route: '/orders' }, { id: 'products', label: '商品编辑', route: '/products/edit' }] },
    collections: [
      { id: 'orders', label: '咖啡订单（示例）', model: { id: { type: 'number', label: '订单编号' }, name: { type: 'string', label: '顾客' }, drink: { type: 'enum', label: '饮品', options: ['燕麦拿铁', '美式咖啡', '馥芮白'] }, status: { type: 'enum', label: '状态', options: ['制作中', '待取餐', '已完成'] }, amount: { type: 'number', label: '金额' } }, fields: ['name', 'drink', 'status', 'amount'], seed: 24, actions: [] },
      { id: 'products', label: '咖啡商品（示例）', model: { id: { type: 'number', label: '商品编号' }, name: { type: 'string', label: '商品名称' }, price: { type: 'number', label: '价格' }, available: { type: 'boolean', label: '上架' } }, fields: ['name', 'price', 'available'], seed: 6, actions: [] },
    ],
    forms: [{ id: 'product', label: '商品信息（示例）', collection: 'products', fields: [{ key: 'name', label: '商品名称', type: 'string', required: true }, { key: 'price', label: '价格', type: 'number', required: true }, { key: 'available', label: '上架', type: 'boolean' }] }],
    pages: [
      { route: '/', title: '咖啡工作台（示例）', pageType: 'dashboard', blocks: [{ component: 'AdminWelcomePanel', props: { headline: '从一杯咖啡开始', body: '本地演示 · 所有记录与数字均为示例；操作不会写入真实业务。' }, content: { illustration: { prompt: 'coffee cup and coffee beans', alt: '咖啡杯与咖啡豆风格样例' } } }], admin: { mode: 'workbench', modules: [{ id: 'recent', title: '近期订单（示例）', kind: 'records', collection: 'orders', fields: ['name', 'drink', 'status'], limit: 5, detailRoute: '/orders/detail' }, { id: 'products', title: '在售商品（示例）', kind: 'records', collection: 'products', fields: ['name', 'price'], limit: 3 }] } },
      { route: '/orders', title: '订单列表（示例）', pageType: 'list-detail', blocks: [], admin: { mode: 'list', collection: 'orders', filters: ['name', 'status'], columns: [{ field: 'name' }, { field: 'drink' }, { field: 'status', format: 'status' }, { field: 'amount', format: 'currency' }], actions: [{ kind: 'detail', label: '查看详情', route: '/orders/detail' }] } },
      { route: '/products/edit', title: '商品编辑（示例）', pageType: 'form', blocks: [], admin: { mode: 'form', form: 'product', returnRoute: '/', variant: 'single' } },
      { route: '/orders/detail', title: '订单详情（示例）', pageType: 'list-detail', blocks: [], admin: { mode: 'detail', collection: 'orders', returnRoute: '/orders' } },
    ],
  }
}
