export function createCoffeePreviewRows() {
  const products = [
    { id: 1, name: '燕麦拿铁', price: 32, available: true },
    { id: 2, name: '美式咖啡', price: 22, available: true },
    { id: 3, name: '馥芮白', price: 28, available: true },
    { id: 4, name: '冷萃咖啡', price: 30, available: true },
    { id: 5, name: '海盐摩卡', price: 36, available: true },
    { id: 6, name: '手冲咖啡', price: 42, available: false },
  ].map(product => ({ ...product, displayPrice: `¥${product.price.toFixed(2)}` }))
  const customers = ['林女士', '陈先生', '周女士', '许先生', '吴女士', '赵先生', '李女士', '孙先生']
  const drinks = products.slice(0, 3)
  const quantities = [1, 2, 1, 1, 3, 2, 1, 2]
  const statuses = ['制作中', '待取餐', '已完成']
  const orders = Array.from({ length: 24 }, (_, index) => {
    const drink = drinks[index % drinks.length]!
    return { id: index + 1, name: customers[index % customers.length]!, drink: drink.name, status: statuses[index % statuses.length]!, amount: drink.price * quantities[index % quantities.length]! }
  })
  return { products, orders }
}

export function createCoffeePreviewDraft() {
  return {
    meta: { name: '拾光咖啡 · 示例后台', description: '所有记录与数字均为本地示例，操作不会写入真实业务。', targetStack: 'vue3' },
    theme: { colorTokens: { primary: '#6A7353', secondary: '#9A6247', accent: '#A4783D', background: '#F7F3E9', surface: '#FFFCF5', foreground: '#302E26', muted: '#716C60' }, radius: 'md', spacing: 'normal', mode: 'light', fontPair: { heading: 'system-ui', body: 'system-ui' } },
    styleBible: { artStyle: 'hand-drawn', lineWeight: 'thin', shading: 'soft-gradient', perspective: 'three-quarter', palette: ['#6A7353', '#9A6247'], backgroundTreatment: 'subtle-gradient', negativePrompt: 'text, watermark', seed: 42 },
    experience: { kind: 'admin', navigation: [{ id: 'home', label: '工作台', route: '/' }, { id: 'orders', label: '订单列表', route: '/orders' }, { id: 'products', label: '商品编辑', route: '/products/edit' }] },
    collections: [
      { id: 'orders', label: '咖啡订单', model: { id: { type: 'number', label: '订单编号' }, name: { type: 'string', label: '顾客' }, drink: { type: 'enum', label: '饮品', options: ['燕麦拿铁', '美式咖啡', '馥芮白'] }, status: { type: 'enum', label: '状态', options: ['制作中', '待取餐', '已完成'] }, amount: { type: 'number', label: '金额' } }, fields: ['name', 'drink', 'status', 'amount'], seed: 24, actions: [] },
      { id: 'products', label: '咖啡商品', model: { id: { type: 'number', label: '商品编号' }, name: { type: 'string', label: '商品名称' }, price: { type: 'number', label: '价格' }, displayPrice: { type: 'string', label: '价格' }, available: { type: 'boolean', label: '上架' } }, fields: ['name', 'price', 'available'], seed: 6, actions: [] },
    ],
    forms: [{ id: 'product', label: '商品信息', collection: 'products', fields: [{ key: 'name', label: '商品名称', type: 'string', required: true }, { key: 'price', label: '价格', type: 'number', required: true }, { key: 'available', label: '上架', type: 'boolean' }] }],
    pages: [
      { route: '/', title: '咖啡工作台', pageType: 'dashboard', blocks: [{ component: 'AdminWelcomePanel', props: { headline: '订单与商品概览', body: '查看近期订单，维护咖啡商品信息' }, content: { illustration: { prompt: 'coffee cup and coffee beans', alt: '咖啡杯与咖啡豆风格样例' } } }], admin: { mode: 'workbench', modules: [{ id: 'recent', title: '近期订单', kind: 'records', collection: 'orders', fields: ['name', 'drink', 'status'], limit: 5, detailRoute: '/orders/detail' }, { id: 'products', title: '在售商品', kind: 'records', collection: 'products', fields: ['name', 'displayPrice'], limit: 3 }] } },
      { route: '/orders', title: '订单列表', pageType: 'list-detail', blocks: [], admin: { mode: 'list', collection: 'orders', filters: ['name', 'status'], columns: [{ field: 'name' }, { field: 'drink' }, { field: 'status', format: 'status' }, { field: 'amount', format: 'currency' }], actions: [{ kind: 'detail', label: '查看详情', route: '/orders/detail' }] } },
      { route: '/products/edit', title: '商品编辑', pageType: 'form', blocks: [], admin: { mode: 'form', form: 'product', returnRoute: '/', variant: 'single' } },
      { route: '/orders/detail', title: '订单详情', pageType: 'list-detail', blocks: [], admin: { mode: 'detail', collection: 'orders', returnRoute: '/orders' } },
    ],
  }
}
