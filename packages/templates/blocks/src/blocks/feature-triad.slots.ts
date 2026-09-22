import type { BlockDefinition } from '../slot.js'

/** Three equal cards. Square and transparent so the cards tile predictably. */
export const FeatureTriad: BlockDefinition = {
  component: 'FeatureTriad',
  pageTypes: ['landing'],
  props: { heading: 'string', features: '{ title, body }[]' },
  slots: [
    {
      name: 'featureOne',
      purpose: 'feature-illustration',
      aspectRatio: '1:1',
      renderSize: { w: 512, h: 512 },
      transparent: true,
      composition: 'centered',
      defaultPrompt: 'single icon-like object representing the first feature, no text',
      defaultAlt: 'First feature illustration',
    },
    {
      name: 'featureTwo',
      purpose: 'feature-illustration',
      aspectRatio: '1:1',
      renderSize: { w: 512, h: 512 },
      transparent: true,
      composition: 'centered',
      defaultPrompt: 'single icon-like object representing the second feature, no text',
      defaultAlt: 'Second feature illustration',
    },
    {
      name: 'featureThree',
      purpose: 'feature-illustration',
      aspectRatio: '1:1',
      renderSize: { w: 512, h: 512 },
      transparent: true,
      composition: 'centered',
      defaultPrompt: 'single icon-like object representing the third feature, no text',
      defaultAlt: 'Third feature illustration',
    },
  ],
}
