<script setup lang="ts">
import { computed, ref, watch } from 'vue'

interface Column {
  key: string
  label: string
  kind?: string
}

interface LegacyRow {
  cells: string[]
}

interface DataRow {
  id?: string
  [key: string]: unknown
}

const props = withDefaults(
  defineProps<{
    heading?: string
    subheading?: string
    columns?: Column[]
    rows?: LegacyRow[]
    collection?: string
    data?: DataRow[]
    searchable?: boolean
    sortable?: boolean
    pageable?: boolean
    pageSize?: number
    rowActions?: string
    searchText?: string
  }>(),
  {
    heading: '',
    subheading: '',
    columns: () => [],
    rows: () => [],
    collection: '',
    data: () => [],
    searchable: false,
    sortable: false,
    pageable: false,
    pageSize: 8,
    rowActions: '',
    searchText: '',
  },
)

const emit = defineEmits<{
  save: [row: DataRow]
  delete: [row: DataRow]
}>()

// Live-data path: search / sort / page are component-local state.
const dataMode = computed(() => props.data.length > 0)
const query = ref(props.searchText)
const sortField = ref('')
const sortDir = ref<'asc' | 'desc'>('asc')
const page = ref(1)

watch(
  () => props.searchText,
  (value) => {
    query.value = value ?? ''
  },
)

const sorted = computed(() => {
  let rows = [...props.data]
  const term = query.value.trim().toLowerCase()
  if (term !== '') {
    rows = rows.filter((row) => JSON.stringify(row).toLowerCase().includes(term))
  }
  if (sortField.value !== '') {
    const field = sortField.value
    const factor = sortDir.value === 'asc' ? 1 : -1
    const sortedCopy = [...rows].sort(
      (a, b) => String(a[field] ?? '').localeCompare(String(b[field] ?? '')) * factor,
    )
    rows = sortedCopy
  }
  return rows
})

const pageCount = computed(() => Math.max(1, Math.ceil(sorted.value.length / props.pageSize)))

const paged = computed(() => {
  const start = (page.value - 1) * props.pageSize
  return sorted.value.slice(start, start + props.pageSize)
})

const rowActions = computed(() =>
  props.rowActions
    .split(',')
    .map((kind) => kind.trim())
    .filter((kind) => kind !== ''),
)

function toggleSort(key: string): void {
  if (sortField.value === key) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  else {
    sortField.value = key
    sortDir.value = 'asc'
  }
}

function cellOf(row: DataRow, column: Column): string {
  return String(row[column.key] ?? '')
}
</script>

<template>
  <section class="section table">
    <div class="container">
      <header v-if="props.heading || props.subheading" class="table__head">
        <h2 v-if="props.heading" class="table__title">{{ props.heading }}</h2>
        <p v-if="props.subheading" class="table__sub">{{ props.subheading }}</p>
      </header>

      <template v-if="dataMode">
        <div class="table__toolbar">
          <input
            v-if="props.searchable"
            v-model="query"
            class="table__search"
            type="search"
            placeholder="搜索…"
          />
        </div>
        <div v-if="props.columns.length > 0" class="table__wrap">
          <table class="table__grid">
            <thead>
              <tr>
                <th
                  v-for="column in props.columns"
                  :key="column.key"
                  scope="col"
                  class="table__th"
                  :class="{ 'table__th--sortable': props.sortable }"
                  :aria-sort="
                    sortField === column.key
                      ? sortDir === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : undefined
                  "
                  @click="props.sortable && toggleSort(column.key)"
                >
                  {{ column.label }}
                </th>
                <th v-if="rowActions.length > 0" scope="col" class="table__th">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in paged" :key="row.id ?? JSON.stringify(row)" class="table__row">
                <td v-for="column in props.columns" :key="column.key" class="table__td">
                  {{ cellOf(row, column) }}
                </td>
                <td v-if="rowActions.length > 0" class="table__td table__actions">
                  <button
                    v-if="rowActions.includes('edit')"
                    class="table__action"
                    @click="emit('save', row)"
                  >
                    编辑
                  </button>
                  <button
                    v-if="rowActions.includes('delete')"
                    class="table__action table__action--danger"
                    @click="emit('delete', row)"
                  >
                    删除
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="props.pageable" class="table__pager">
          <button
            class="button button--ghost table__page"
            :disabled="page <= 1"
            @click="page -= 1"
          >
            上一页
          </button>
          <span class="table__pageinfo">{{ page }} / {{ pageCount }}</span>
          <button
            class="button button--ghost table__page"
            :disabled="page >= pageCount"
            @click="page += 1"
          >
            下一页
          </button>
        </div>
      </template>

      <div v-else-if="props.columns.length > 0" class="table__wrap">
        <table class="table__grid">
          <thead>
            <tr>
              <th v-for="column in props.columns" :key="column.key" scope="col" class="table__th">
                {{ column.label }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in props.rows" :key="i" class="table__row">
              <td v-for="(column, j) in props.columns" :key="j" class="table__td">
                <template v-if="column.kind === 'badge'">
                  <span class="table__badge">{{ row.cells[j] ?? '' }}</span>
                </template>
                <template v-else-if="column.kind === 'status'">
                  <span class="table__status">{{ row.cells[j] ?? '' }}</span>
                </template>
                <template v-else-if="column.kind === 'link'">
                  <span class="table__link">{{ row.cells[j] ?? '' }}</span>
                </template>
                <template v-else>
                  {{ row.cells[j] ?? '' }}
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<style scoped>
.table__head {
  margin-bottom: calc(var(--space-unit) * 1.5);
}

.table__title {
  font-family: var(--font-heading);
  font-size: 1.5rem;
  margin: 0 0 0.25rem;
}

.table__sub {
  color: var(--color-muted);
  margin: 0;
}

.table__wrap {
  overflow-x: auto;
  border: 1px solid color-mix(in srgb, var(--color-muted) 25%, transparent);
  border-radius: var(--radius);
  background: var(--color-surface);
}

.table__grid {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.table__th {
  text-align: left;
  padding: 0.75rem 1rem;
  color: var(--color-muted);
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid color-mix(in srgb, var(--color-muted) 25%, transparent);
}

.table__td {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid color-mix(in srgb, var(--color-muted) 15%, transparent);
}

.table__row:last-child .table__td {
  border-bottom: 0;
}

.table__badge,
.table__status {
  display: inline-block;
  padding: 0.15rem 0.6rem;
  border-radius: calc(var(--radius) * 0.6);
  font-size: 0.8rem;
  font-weight: 600;
}

.table__badge {
  background: color-mix(in srgb, var(--color-primary) 15%, transparent);
  color: var(--color-primary);
}

.table__status {
  background: color-mix(in srgb, var(--color-accent) 15%, transparent);
  color: var(--color-accent);
}

.table__link {
  color: var(--color-primary);
}

.table__toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: calc(var(--space-unit) * 0.75);
}

.table__search {
  padding: 0.45em 0.9em;
  border: 1px solid color-mix(in srgb, var(--color-muted) 40%, transparent);
  border-radius: var(--radius);
  background: var(--color-background);
  color: var(--color-foreground);
  font: inherit;
  font-size: 0.85rem;
  width: 16rem;
}

.table__th--sortable {
  cursor: pointer;
  user-select: none;
}

.table__actions {
  white-space: nowrap;
}

.table__action {
  background: none;
  border: 0;
  padding: 0;
  margin-right: 0.75rem;
  color: var(--color-primary);
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
}

.table__action--danger {
  color: color-mix(in srgb, var(--color-foreground) 70%, red);
}

.table__pager {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: calc(var(--space-unit) * 0.75);
  padding: calc(var(--space-unit) * 0.75) 0;
}

.table__page {
  padding: 0.35em 0.9em;
  font-size: 0.85rem;
}

.table__pageinfo {
  color: var(--color-muted);
  font-size: 0.85rem;
}
</style>
