import type { BlockDefinition } from '../slot.js'

export const PricingCard: BlockDefinition = {
  component: 'PricingCard',
  pageTypes: ['landing'],
  props: {
    heading: 'string',
    subheading: 'string',
    plans: '{ name, price, period?, tagline?, features: string[], cta?: { label, to }, featured? }[]',
    note: 'string',
  },
  slots: [],
}
