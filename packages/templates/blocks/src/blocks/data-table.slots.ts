import type { BlockDefinition } from '../slot.js'

/**
 * Data table for list-detail pages. Static usage (columns/rows) still works;
 * a bound collection switches it to live data with search/sort/paging and,
 * when actions allow, row-level edit/delete emitting save/delete.
 */
export const DataTable: BlockDefinition = {
  component: 'DataTable',
  pageTypes: ['list-detail', 'dashboard'],
  props: {
    heading: 'string',
    subheading: 'string',
    columns: '{ key, label, kind? }[]',
    rows: '{ cells: string[] }[]',
    // Codegen-consumed selector; stripped from the emitted props const.
    collection: 'string',
    // Bound by codegen from the collection (search/sort/page/row ops).
    data: '{ id?: string, [key: string]: unknown }[]',
    searchable: 'boolean',
    sortable: 'boolean',
    pageable: 'boolean',
    pageSize: 'number',
    rowActions: 'string',
    searchText: 'string',
  },
  slots: [],
}
