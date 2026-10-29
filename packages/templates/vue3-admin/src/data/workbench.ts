import type { WorkbenchModule } from './admin-config'
import type { Row, FieldModel } from './types'
export type WorkbenchResult =
  | { kind: 'summary'; value: number | null }
  | { kind: 'breakdown'; items: { label: string; count: number }[] }
  | { kind: 'records'; rows: Row[] }
  | { kind: 'shortcuts'; routes: string[] }
export function evaluateWorkbenchModule(module: WorkbenchModule, rows: readonly Row[], model: Record<string, FieldModel>): WorkbenchResult {
  if (module.kind === 'shortcuts') return { kind: 'shortcuts', routes: module.routes }
  const filtered = 'filter' in module && module.filter ? rows.filter(row => row[module.filter!.field] === module.filter!.value) : [...rows]
  if (module.kind === 'summary') {
    const value = module.metric === 'count' ? filtered.length : filtered.reduce((sum, row) => sum + (typeof row[module.field!] === 'number' ? row[module.field!] as number : 0), 0)
    return { kind: 'summary', value: Number.isFinite(value) ? value : null }
  }
  if (module.kind === 'breakdown') {
    const definition = model[module.field]
    const categories: unknown[] = definition.type === 'boolean' ? [true, false] : [...(definition.options ?? [])]
    const missing = rows.filter(row => row[module.field] === undefined || row[module.field] === null || row[module.field] === '').length
    const items = categories.map(value => ({ label: typeof value === 'boolean' ? value ? '是' : '否' : String(value), count: rows.filter(row => row[module.field] === value).length }))
    if (missing) items.push({ label: '未填写', count: missing })
    return { kind: 'breakdown', items }
  }
  if (module.sort) {
    const { field, direction } = module.sort
    const numeric = (row: Row) => {
      const value = row[field]
      if (value === undefined || value === null || value === '') return null
      const number = model[field].type === 'date' ? Date.parse(String(value)) : Number(value)
      return Number.isFinite(number) ? number : null
    }
    filtered.sort((a, b) => {
      const left = numeric(a), right = numeric(b)
      if (left === null) return right === null ? 0 : 1
      if (right === null) return -1
      return (left - right) * (direction === 'asc' ? 1 : -1)
    })
  }
  return { kind: 'records', rows: filtered.slice(0, module.limit) }
}
