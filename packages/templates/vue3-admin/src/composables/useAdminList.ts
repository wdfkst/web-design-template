import { computed, reactive, ref, watch } from 'vue'
import type { CollectionStore } from '../data/repository'
import type { FieldModel } from '../data/types'

export function useAdminList(store: CollectionStore, fields: string[], model: Record<string, FieldModel> = {}) {
  const draft = reactive<Record<string, string | undefined>>({})
  const applied = ref<Record<string, string | undefined>>({})
  const page = ref(1), pageSize = ref(8)
  const selected = ref<(string | number)[]>([])
  const filtered = computed(() => store.rows.value.filter(row => fields.every(field => {
    const term = applied.value[field]
    if (term === undefined || term === '') return true
    if (model[field]?.type === 'enum' || model[field]?.type === 'boolean') return String(row[field]) === term
    return String(row[field] ?? '').toLowerCase().includes(term.toLowerCase())
  })))
  const visible = computed(() => filtered.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value))
  watch(filtered, rows => {
    page.value = Math.min(page.value, Math.max(1, Math.ceil(rows.length / pageSize.value)))
    const ids = new Set(rows.map(row => String(row.id)))
    selected.value = selected.value.filter(id => ids.has(String(id)))
  }, { deep: true })
  function query() { applied.value = { ...draft }; page.value = 1; selected.value = [] }
  function reset() { for (const field of fields) delete draft[field]; query() }
  return { draft, page, pageSize, selected, filtered, visible, query, reset }
}
