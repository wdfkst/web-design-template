import type { Collection, ProjectSpec } from '@vudt/spec'

/** 确定性中文样例词库（string 字段按行号取模 + 序号）。 */
const WORD_POOL = ['订单', '客户', '商品', '员工', '项目', '工单', '渠道', '报表']

/**
 * Renders `src/data/mock.ts`: deterministic mock rows derived from the spec's
 * collections. Same spec in, byte-identical rows out — hashed, tested, and
 * never touching the network. Every row carries `id` so the store can edit it.
 */
export function renderCollections(spec: ProjectSpec): string {
  const entries = spec.collections.map((collection) => {
    const rows = Array.from({ length: collection.seed }, (_, rowIndex) =>
      buildRow(collection, rowIndex),
    )
    const body = rows.map((row) => `    ${JSON.stringify(row)},`).join('\n')
    return `  ${JSON.stringify(collection.id)}: [\n${body}\n  ]`
  })

  return [
    "// Deterministic mock data derived from the spec's collections.",
    '// Every row carries an id so the store can edit and delete it.',
    'export type Row = Record<string, unknown> & { id: string }',
    '',
    'export const MOCK_ROWS: Record<string, Row[]> = {',
    ...entries,
    '}',
    '',
  ].join('\n')
}

function buildRow(collection: Collection, rowIndex: number): Record<string, unknown> {
  const row: Record<string, unknown> = { id: `row-${rowIndex + 1}` }
  for (const field of collection.fields) {
    const model = collection.model[field]
    if (model === undefined) continue // 引用检查已拦，这里防御性跳过
    row[field] = mockValue(model.type, rowIndex, model.options)
  }
  return row
}

function mockValue(type: string, rowIndex: number, options?: readonly string[]): unknown {
  switch (type) {
    case 'string':
      return `${WORD_POOL[rowIndex % WORD_POOL.length]}-${rowIndex + 1}`
    case 'number':
      return 100 + (rowIndex + 1) * 17
    case 'date':
      return new Date(Date.UTC(2026, 8, 1 + rowIndex)).toISOString().slice(0, 10)
    case 'enum':
      return options?.[rowIndex % options.length] ?? ''
    case 'boolean':
      return (rowIndex + 1) % 2 === 0
    default:
      return ''
  }
}
