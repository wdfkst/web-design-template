import type { BlockDefinition } from '../slot.js'

/** Shown when a list has no rows. Transparent so it drops onto any surface. */
export const EmptyStatePanel: BlockDefinition = {
  component: 'EmptyStatePanel',
  pageTypes: ['dashboard', 'list-detail'],
  props: { headline: 'string', body: 'string', ctaLabel: 'string' },
  slots: [
    {
      name: 'illustration',
      purpose: 'empty-state',
      aspectRatio: '1:1',
      renderSize: { w: 512, h: 512 },
      transparent: true,
      composition: 'centered',
      defaultPrompt: 'friendly depiction of an empty container or shelf, no text',
      defaultAlt: 'Nothing here yet',
    },
  ],
}
