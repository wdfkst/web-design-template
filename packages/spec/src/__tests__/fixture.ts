import type { ProjectSpecInput } from '../project-spec.js'

/** A minimal valid spec. Tests clone and break one field at a time. */
export function validSpecInput(): ProjectSpecInput {
  return {
    meta: {
      name: 'Acme Landing',
      description: 'A marketing landing page for a developer tooling product.',
      targetStack: 'vue3',
    },
    theme: {
      colorTokens: {
        primary: '#4f46e5',
        secondary: '#0ea5e9',
        accent: '#f59e0b',
        background: '#ffffff',
        surface: '#f8fafc',
        foreground: '#0f172a',
        muted: '#64748b',
      },
      radius: 'lg',
      spacing: 'normal',
      fontPair: { heading: 'Inter', body: 'Inter' },
      mode: 'light',
    },
    styleBible: {
      artStyle: 'flat-vector',
      lineWeight: 'none',
      shading: 'soft-gradient',
      perspective: 'three-quarter',
      palette: ['#4f46e5', '#0ea5e9', '#f59e0b'],
      backgroundTreatment: 'subtle-gradient',
      negativePrompt: 'no text, no watermark',
      seed: 1234,
    },
    pages: [
      {
        route: '/',
        title: 'Home',
        pageType: 'landing',
        blocks: [
          {
            component: 'HeroSplit',
            props: { headline: 'Ship faster' },
            assetBindings: { illustration: 'hero-main' },
          },
        ],
      },
    ],
    assets: [
      {
        id: 'hero-main',
        purpose: 'hero-illustration',
        aspectRatio: '4:3',
        renderSize: { w: 800, h: 600 },
        transparent: true,
        composition: 'subject-right',
        prompt: 'a developer at a desk reviewing code on a large monitor',
        alt: 'Developer reviewing code',
      },
    ],
  }
}
