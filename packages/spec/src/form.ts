import { z } from 'zod'
import { FieldTypeSchema } from './collection.js'

export const FormFieldSchema = z.object({
  key: z.string(), // 对应 collection.model 的键（可无 collection）
  label: z.string().min(1).max(40),
  type: FieldTypeSchema,
  required: z.boolean().default(false),
  placeholder: z.string().optional(),
  validate: z
    .object({
      min: z.number().int().min(0).optional(),
      max: z.number().int().optional(),
      pattern: z.enum(['email']).optional(),
    })
    .default({}),
})

export const FormSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  label: z.string().min(1).max(40),
  /** 写回目标集合（可选）：onSave 写入该 collection 的 store；缺省只 toast。 */
  collection: z.string().optional(),
  fields: z.array(FormFieldSchema).min(1),
  submit: z
    .object({
      label: z.string().min(1).max(20),
      toast: z.string().min(1).max(40),
    })
    .default({ label: '保存', toast: '已保存' }),
})

export type Form = z.infer<typeof FormSchema>
export type FormField = z.infer<typeof FormFieldSchema>
