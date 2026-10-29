import type { BlockDefinition } from '../slot.js'

export const AdminWelcomePanel: BlockDefinition = {
  component: 'AdminWelcomePanel',
  pageTypes: ['dashboard', 'list-detail'],
  props: { headline: 'string', body: 'string' },
  slots: [{
    name: 'illustration',
    purpose: 'empty-state',
    aspectRatio: '1:1',
    renderSize: { w: 512, h: 512 },
    transparent: true,
    composition: 'centered',
    defaultPrompt: 'a welcoming illustration of the workspace subject, no text',
    defaultAlt: 'Workspace illustration',
  }],
}
