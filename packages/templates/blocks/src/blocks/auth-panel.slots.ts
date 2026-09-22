import type { BlockDefinition } from '../slot.js'

export const AuthPanel: BlockDefinition = {
  component: 'AuthPanel',
  pageTypes: ['auth'],
  props: {
    mode: 'sign-in | sign-up',
    heading: 'string',
    subheading: 'string',
    fields: '{ label, type, placeholder? }[]',
    submitLabel: 'string',
    altActionLabel: 'string',
    note: 'string',
  },
  slots: [],
}
