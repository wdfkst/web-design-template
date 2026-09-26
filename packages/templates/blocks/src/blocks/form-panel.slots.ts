import type { BlockDefinition } from '../slot.js'

/**
 * Sectioned settings form: labelled inputs and one submit. Static usage still
 * renders the fields; a bound form adds per-field validation and a submit
 * toast, calling the codegen-injected onSave handler.
 */
export const FormPanel: BlockDefinition = {
  component: 'FormPanel',
  pageTypes: ['settings', 'form'],
  props: {
    heading: 'string',
    subheading: 'string',
    fields: '{ key, label, type, required?, placeholder?, validate?, options? }[]',
    submitLabel: 'string',
    // Codegen-consumed selector; stripped from the emitted props const.
    form: 'string',
    // Injected by codegen; the model never writes it.
    onSave: '(row: Record<string, unknown>) => void',
  },
  slots: [],
}
