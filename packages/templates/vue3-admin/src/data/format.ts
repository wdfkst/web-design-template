export function formatAdminValue(value: unknown, format?: string): string {
  if (value === undefined || value === null || value === '' || (typeof value === 'number' && !Number.isFinite(value))) return '—'
  if (format === 'currency' && typeof value === 'number') return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(value)
  if (format === 'date') {
    const date = new Date(String(value))
    return Number.isNaN(date.getTime()) ? '—' : date.toISOString().slice(0, 10)
  }
  return typeof value === 'boolean' ? value ? '是' : '否' : String(value)
}
