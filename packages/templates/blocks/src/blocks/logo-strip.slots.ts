import type { BlockDefinition } from '../slot.js'

export const LogoStrip: BlockDefinition = {
  component: 'LogoStrip',
  pageTypes: ['landing'],
  props: { heading: 'string', logos: '{ name, to }[]' },
  slots: [],
}
