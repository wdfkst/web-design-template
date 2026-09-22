import type { BlockDefinition } from '../slot.js'

/** Logo is an iconify mark or plain text, so no generated asset. */
export const NavBarSimple: BlockDefinition = {
  component: 'NavBarSimple',
  pageTypes: ['landing', 'dashboard', 'form', 'list-detail', 'settings'],
  props: {
    brand: 'string',
    links: '{ label, to }[]',
    cta: '{ label, to }',
    orientation: '"horizontal" | "vertical"',
  },
  layoutOnly: true,
  slots: [],
}
