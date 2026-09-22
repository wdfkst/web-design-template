import type { BlockDefinition } from '../slot.js'

export const StatsBand: BlockDefinition = {
  component: 'StatsBand',
  pageTypes: ['landing'],
  props: { heading: 'string', subheading: 'string', stats: '{ label, value, suffix? }[]' },
  slots: [],
}
