<script setup lang="ts">
interface Column {
  key: string
  label: string
  kind?: string
}

interface Row {
  cells: string[]
}

withDefaults(
  defineProps<{
    heading?: string
    subheading?: string
    columns?: Column[]
    rows?: Row[]
  }>(),
  { heading: '', subheading: '', columns: () => [], rows: () => [] },
)
</script>

<template>
  <section class="section table">
    <div class="container">
      <header v-if="heading || subheading" class="table__head">
        <h2 v-if="heading" class="table__title">{{ heading }}</h2>
        <p v-if="subheading" class="table__sub">{{ subheading }}</p>
      </header>
      <div v-if="columns.length > 0" class="table__wrap">
        <table class="table__grid">
          <thead>
            <tr>
              <th v-for="column in columns" :key="column.key" scope="col" class="table__th">
                {{ column.label }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in rows" :key="i" class="table__row">
              <td v-for="(column, j) in columns" :key="j" class="table__td">
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
</style>
