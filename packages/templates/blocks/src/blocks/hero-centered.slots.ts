import type { BlockDefinition } from '../slot.js'

/**
 * Headline stacked over a wide backdrop. Opaque and full-bleed so the style
 * bible's backgroundTreatment applies, and the copy sits in the upper third.
 */
export const HeroCentered: BlockDefinition = {
  component: 'HeroCentered',
  pageTypes: ['landing', 'auth'],
  props: { headline: 'string', subhead: 'string', primaryCta: '{ label, to }' },
  slots: [
    {
      name: 'backdrop',
      purpose: 'background',
      aspectRatio: '16:9',
      renderSize: { w: 1600, h: 900 },
      transparent: false,
      composition: 'full-bleed',
      defaultPrompt: 'wide atmospheric backdrop, low detail in the upper third, no text',
      defaultAlt: 'Decorative backdrop',
    },
  ],
}
