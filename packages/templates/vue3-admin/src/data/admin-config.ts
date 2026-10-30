export interface AdminPresentation {
  appearance: 'plain' | 'soft-glass' | 'jelly'
  motif?: 'spark' | 'bloom' | 'orbit' | 'toolkit'
  decoration: 'minimal' | 'balanced'
  density?: 'compact' | 'comfortable'
  shell: 'sidebar' | 'topbar'
}
export interface FieldGroup { id: string; title: string; fields: string[] }
export interface ModuleFilter { field: string; value: string | boolean }
interface ModuleBase { id: string; title: string }
export type WorkbenchModule = ModuleBase & (
  | { kind: 'summary'; collection: string; metric: 'count' | 'sum'; field?: string; filter?: ModuleFilter }
  | { kind: 'breakdown'; collection: string; field: string }
  | { kind: 'records'; collection: string; fields: string[]; limit: number; sort?: { field: string; direction: 'asc' | 'desc' }; filter?: ModuleFilter; detailRoute?: string }
  | { kind: 'shortcuts'; routes: string[] }
)
export type WorkbenchConfig =
  | { mode: 'workbench'; collections: string[]; shortcuts: string[]; modules?: never }
  | { mode: 'workbench'; modules: WorkbenchModule[]; variant?: 'overview' | 'focus'; primaryModuleId?: string; collections?: never; shortcuts?: never }
export type AdminAction = { label: string } & (
  | { kind: 'create' | 'edit' | 'delete' | 'bulk-delete' }
  | { kind: 'detail'; route: string }
  | { kind: 'set-field'; field: string; value: string | number | boolean }
)
export interface AdminListConfig {
  mode: 'list'; collection: string; form?: string
  filters: string[]; columns: { field: string; format?: 'text' | 'currency' | 'date' | 'status' }[]; actions: AdminAction[]
  variant?: 'table' | 'cards'; card?: { titleField: string; summaryFields: string[]; coverField?: string }
}
export interface AdminDetailConfig {
  mode: 'detail'; collection: string; returnRoute: string
  variant?: 'sections' | 'aside'; groups?: FieldGroup[]; asideFields?: string[]
}
export interface AdminFormConfig {
  mode: 'form'; form: string; returnRoute: string; variant?: 'single' | 'grouped'; groups?: FieldGroup[]
}
export type AdminPageConfig = AdminListConfig | AdminDetailConfig | AdminFormConfig | WorkbenchConfig | { mode: 'settings'; form: string; returnRoute: string }
