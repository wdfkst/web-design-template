import type { BlockDefinition } from '../slot.js'

/**
 * Closing call to action. The decoration sits behind the button cluster on the
 * right, so the subject is pushed right to leave the left side clear for copy.
 */
export const CtaBanner: BlockDefinition = {
  component: 'CtaBanner',
  pageTypes: ['landing'],
  props: { headline: 'string', body: 'string', cta: '{ label, to }' },
  slots: [
    {
      name: 'decoration',
      purpose: 'section-decoration',
      aspectRatio: '16:9',
      renderSize: { w: 1280, h: 720 },
      transparent: true,
      composition: 'subject-right',
      defaultPrompt: 'loose abstract shapes suggesting forward motion, no text',
      defaultAlt: 'Decorative shapes',
    },
  ],
}
