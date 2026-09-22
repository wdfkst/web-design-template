import type { BlockDefinition } from '../slot.js'

export const FAQAccordion: BlockDefinition = {
  component: 'FAQAccordion',
  pageTypes: ['landing', 'form'],
  props: { heading: 'string', subheading: 'string', faqs: '{ question, answer }[]' },
  slots: [],
}
