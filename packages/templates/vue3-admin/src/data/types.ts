export type Row = Record<string, unknown> & { id: string | number }
export interface FieldModel { type: string; label: string; options?: string[] }
export interface CollectionDefinition { id: string; label?: string; model: Record<string, FieldModel>; fields?: string[]; seed?: number; actions?: string[] }
export interface FormField { key: string; label: string; type: string; required?: boolean; placeholder?: string; validate?: { min?: number; max?: number; pattern?: 'email' } }
export interface FormDefinition { id: string; label: string; collection?: string; fields: FormField[]; submit?: { label: string; toast: string } }
