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
  slots: [
    {
      name: 'illustration',
      purpose: 'hero-illustration',
      aspectRatio: '1:1',
      renderSize: { w: 512, h: 512 },
      transparent: true,
      composition: 'centered',
      defaultPrompt: 'a friendly login or sign-up illustration, no text',
      defaultAlt: 'Sign in illustration',
    },
    {
      name: 'icon',
      purpose: 'logo-mark',
      aspectRatio: '1:1',
      renderSize: { w: 128, h: 128 },
      transparent: true,
      composition: 'centered',
      defaultPrompt: 'a simple brand mark or logo icon, no text',
      defaultAlt: 'Brand icon',
    },
  ],
}
