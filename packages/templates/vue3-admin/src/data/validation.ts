import type { FormDefinition } from './types'

export function validateRecord(form: FormDefinition, values: Record<string, unknown>): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const field of form.fields) {
    const value = values[field.key]
    const empty = value === undefined || value === null || (typeof value === 'string' && value.trim() === '')
    if (empty) { if (field.required) errors[field.key] = `请填写${field.label}`; continue }
    if (field.type === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) { errors[field.key] = '请输入有效数字'; continue }
    if (field.type === 'boolean' && typeof value !== 'boolean') { errors[field.key] = '请选择有效状态'; continue }
    if (field.type === 'date' && (typeof value !== 'string' || Number.isNaN(Date.parse(value)))) { errors[field.key] = '请输入有效日期'; continue }
    const size = typeof value === 'number' ? value : String(value).length
    if (field.validate?.min !== undefined && size < field.validate.min) errors[field.key] = `${field.label}低于最小要求 ${field.validate.min}`
    if (field.validate?.max !== undefined && size > field.validate.max) errors[field.key] = `${field.label}超出最大要求 ${field.validate.max}`
    if (field.validate?.pattern === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) errors[field.key] = '请输入有效邮箱'
  }
  return errors
}
