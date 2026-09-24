import type { BlockDefinition } from '../slot.js'

/** Data table for list-detail pages: header + rows of cells. Props-only. */
export const DataTable: BlockDefinition = {
  component: 'DataTable',
  pageTypes: ['list-detail', 'dashboard'],
  props: {
    heading: 'string',
    subheading: 'string',
    columns: '{ key, label, kind? }[]',
    rows: '{ cells: string[] }[]',
  },
  slots: [],
}
