import type { BlockDefinition } from '../slot.js'

/** Status card for a dashboard: labelled values with an optional tone. Props-only. */
export const StatusCard: BlockDefinition = {
  component: 'StatusCard',
  pageTypes: ['dashboard', 'list-detail'],
  props: {
    heading: 'string',
    items: '{ label, value, tone?, chart?, series? }[]',
    icon: 'string',
  },
  slots: [],
}
