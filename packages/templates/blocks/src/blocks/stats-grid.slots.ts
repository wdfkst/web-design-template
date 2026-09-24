import type { BlockDefinition } from '../slot.js'

/** Four-up KPI grid for a dashboard. Props-only: no image slots. */
export const StatsGrid: BlockDefinition = {
  component: 'StatsGrid',
  pageTypes: ['dashboard'],
  props: { heading: 'string', stats: '{ label, value, delta?, suffix? }[]' },
  slots: [],
}
