import type { BlockDefinition } from '../slot.js'

/** Sectioned settings form: labelled inputs and one submit. Props-only. */
export const FormPanel: BlockDefinition = {
  component: 'FormPanel',
  pageTypes: ['settings', 'form'],
  props: {
    heading: 'string',
    subheading: 'string',
    fields: '{ label, type, placeholder? }[]',
    submitLabel: 'string',
  },
  slots: [],
}
