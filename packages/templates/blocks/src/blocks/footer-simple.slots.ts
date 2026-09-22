import type { BlockDefinition } from '../slot.js'

export const FooterSimple: BlockDefinition = {
  component: 'FooterSimple',
  pageTypes: ['landing', 'dashboard', 'form', 'list-detail', 'settings'],
  props: { brand: 'string', note: 'string' },
  layoutOnly: true,
  slots: [],
}
