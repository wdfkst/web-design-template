import { expect, it } from 'vitest'
import { evaluateWorkbenchModule } from '../data/workbench'
const model = { id: { type: 'number', label: '编号' }, amount: { type: 'number', label: '金额' }, state: { type: 'enum', label: '状态', options: ['待办', '完成'] }, date: { type: 'date', label: '日期' } }
const rows = [{ id: 1, amount: 10, state: '待办', date: '' }, { id: 2, amount: 20, state: '完成', date: '2026-10-01' }, { id: 3, amount: 5, state: '待办', date: '2026-10-01' }]
it('evaluates count, filtered sum, empty sum and overflow', () => {
  expect(evaluateWorkbenchModule({ id: 'n', title: '数量', kind: 'summary', collection: 'items', metric: 'count' }, rows, model)).toEqual({ kind: 'summary', value: 3 })
  const sum = { id: 'sum', title: '金额', kind: 'summary' as const, collection: 'items', metric: 'sum' as const, field: 'amount', filter: { field: 'state', value: '待办' } }
  expect(evaluateWorkbenchModule(sum, rows, model)).toEqual({ kind: 'summary', value: 15 })
  expect(evaluateWorkbenchModule(sum, [], model)).toEqual({ kind: 'summary', value: 0 })
  expect(evaluateWorkbenchModule({ ...sum, filter: undefined }, [{ id: 1, amount: 1e308 }, { id: 2, amount: 1e308 }], model)).toEqual({ kind: 'summary', value: null })
})
it('includes zero-count categories and labels missing values', () => {
  expect(evaluateWorkbenchModule({ id: 'b', title: '状态', kind: 'breakdown', collection: 'items', field: 'state' }, [{ id: 1, state: '待办' }, { id: 2 }], model)).toEqual({ kind: 'breakdown', items: [{ label: '待办', count: 1 }, { label: '完成', count: 0 }, { label: '未填写', count: 1 }] })
})
it.each(['asc', 'desc'] as const)('sorts dates %s stably with missing dates last without mutating rows', direction => {
  const before = rows.map(row => ({ ...row }))
  expect(evaluateWorkbenchModule({ id: 'r', title: '记录', kind: 'records', collection: 'items', fields: ['date'], limit: 2, sort: { field: 'date', direction } }, rows, model)).toEqual({ kind: 'records', rows: [rows[1], rows[2]] })
  expect(rows).toEqual(before)
})
it('preserves shortcut routes', () => {
  expect(evaluateWorkbenchModule({ id: 's', title: '入口', kind: 'shortcuts', routes: ['/items'] }, [], model)).toEqual({ kind: 'shortcuts', routes: ['/items'] })
})
