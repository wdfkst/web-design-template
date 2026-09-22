import type { BlockDefinition } from '../slot.js'

/**
 * Two-column hero: copy left, illustration right. Transparent because the
 * section already has a themed background, and centered because the column
 * crops evenly on both sides as the viewport narrows.
 */
export const HeroSplit: BlockDefinition = {
  component: 'HeroSplit',
  pageTypes: ['landing'],
  props: { headline: 'string', subhead: 'string', primaryCta: 'string', secondaryCta: 'string' },
  slots: [
    {
      name: 'illustration',
      purpose: 'hero-illustration',
      aspectRatio: '4:3',
      renderSize: { w: 960, h: 720 },
      transparent: true,
      composition: 'centered',
      defaultPrompt: 'the product in use, one clear focal subject, no text',
      defaultAlt: 'Product illustration',
    },
  ],
}
