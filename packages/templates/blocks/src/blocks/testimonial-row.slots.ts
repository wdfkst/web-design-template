import type { BlockDefinition } from '../slot.js'

export const TestimonialRow: BlockDefinition = {
  component: 'TestimonialRow',
  pageTypes: ['landing'],
  props: { heading: 'string', testimonials: '{ quote, author, role? }[]' },
  slots: [],
}
