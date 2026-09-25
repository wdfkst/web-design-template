import { z } from 'zod'

export const FieldTypeSchema = z.enum(['string', 'number', 'date', 'enum', 'boolean'])

export const FieldModelSchema = z.object({
  type: FieldTypeSchema,
  label: z.string().min(1).max(40),
  options: z.array(z.string()).optional(), // 仅 enum 使用
})

/**
 * A named record shape the generated app can list, filter and edit. Field key
 * references are validated in checkReferentialIntegrity, not here, because the
 * check spans two sibling fields (`fields` against `model`).
 */
export const CollectionSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/), // kebab-case，跨页引用
  label: z.string().min(1).max(40),
  model: z.record(z.string(), FieldModelSchema),
  fields: z.array(z.string()).min(1), // 列/表单显示顺序（必须是 model 的键）
  seed: z.number().int().min(1).max(50).default(8),
  actions: z.array(z.enum(['create', 'edit', 'delete', 'search', 'export'])).default([]),
})

export type Collection = z.infer<typeof CollectionSchema>
export type FieldType = z.infer<typeof FieldTypeSchema>
export type FieldModel = z.infer<typeof FieldModelSchema>
