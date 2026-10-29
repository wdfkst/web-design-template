import type { ProjectSpec } from '@vudt/spec'

export function renderAdminData(spec: ProjectSpec): Record<string, string> {
  const files: Record<string, string> = {}
  const rows: Record<string, Record<string, unknown>[]> = {}
  for (const collection of spec.collections) {
    rows[collection.id] = Array.from({ length: collection.seed }, (_, index) => {
      const row: Record<string, unknown> = { id: collection.model.id?.type === 'number' ? index + 1 : `row-${index + 1}` }
      for (const [key, field] of Object.entries(collection.model)) {
        if (key === 'id') continue
        row[key] = field.type === 'number' ? 100 + (index + 1) * 17
          : field.type === 'boolean' ? index % 2 === 0
          : field.type === 'enum' ? field.options?.[index % field.options.length] ?? ''
          : field.type === 'date' ? new Date(Date.UTC(2026, 8, 1 + index)).toISOString().slice(0, 10)
          : `${field.label}-${index + 1}`
      }
      return row
    })
    const fields = Object.entries(collection.model).map(([key, model]) => {
      const type = model.type === 'number' || model.type === 'boolean' ? model.type : 'string'
      const property = /^[a-zA-Z_$][\w$]*$/.test(key) ? key : JSON.stringify(key)
      return `  ${property}: ${type}`
    })
    files[`src/modules/${collection.id}/types.ts`] = `export interface RecordModel {\n${fields.join('\n')}\n}\n`
  }
  files['src/data/mock.ts'] = [
    "import type { CollectionDefinition, FormDefinition, Row } from './types'",
    `export const collections: CollectionDefinition[] = ${JSON.stringify(spec.collections, null, 2)}`,
    `export const forms: FormDefinition[] = ${JSON.stringify(spec.forms, null, 2)}`,
    `export const MOCK_ROWS: Record<string, Row[]> = ${JSON.stringify(rows, null, 2)}`,
    '',
  ].join('\n')
  return files
}
