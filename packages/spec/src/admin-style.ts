import { z } from 'zod'
import type { AdminPresentation } from './admin-presentation.js'
import type { StyleBible } from './style-bible.js'
import type { Theme } from './theme.js'

export const ADMIN_STYLE_IDS = Object.freeze(['soft', 'warm', 'mist', 'porcelain', 'aurora'] as const)
export const AdminStyleIdSchema = z.enum(ADMIN_STYLE_IDS)
export type AdminStyleId = z.infer<typeof AdminStyleIdSchema>
export const AdminStyleReferenceSchema = z.object({
  id: AdminStyleIdSchema,
  version: z.number().int().positive(),
}).strict()
export type AdminStyleReference = z.infer<typeof AdminStyleReferenceSchema>
export type AdminStyleMaterial = NonNullable<StyleBible['material']>

export interface AdminStyleDefinition extends AdminStyleReference {
  label: string
  theme: Theme
  presentation: AdminPresentation
  styleBible: Omit<StyleBible, 'seed' | 'palette'>
  material: AdminStyleMaterial
  shellVariant: 'icon-sidebar' | 'expanded-sidebar' | 'top-nav' | 'wide-sidebar' | 'top-nav-context'
  workbenchLayout: 'welcome-grid' | 'main-aside' | 'sectioned' | 'staggered' | 'main-context'
  skin: AdminStyleId
}

const font = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

type StyleConfig = Pick<AdminStyleDefinition, 'id' | 'label' | 'material' | 'shellVariant' | 'workbenchLayout'> & {
  colors: readonly [string, string, string, string, string, string, string]
  artStyle: StyleBible['artStyle']
}

function defineStyle(config: StyleConfig): AdminStyleDefinition {
  const [primary, secondary, accent, background, surface, foreground, muted] = config.colors
  return {
    id: config.id,
    version: 1,
    label: config.label,
    material: config.material,
    shellVariant: config.shellVariant,
    workbenchLayout: config.workbenchLayout,
    skin: config.id,
    theme: {
      colorTokens: { primary, secondary, accent, background, surface, foreground, muted },
      radius: config.id === 'soft' ? 'lg' : 'md',
      spacing: 'normal',
      fontPair: { heading: font, body: font },
      mode: config.id === 'aurora' ? 'dark' : 'light',
    },
    presentation: {
      appearance: config.id === 'soft' ? 'jelly' : config.id === 'warm' ? 'plain' : 'soft-glass',
      decoration: 'balanced',
      density: 'comfortable',
      shell: config.id === 'mist' || config.id === 'aurora' ? 'topbar' : 'sidebar',
    },
    styleBible: {
      artStyle: config.artStyle,
      lineWeight: config.id === 'warm' ? 'thin' : 'none',
      shading: 'soft-gradient',
      perspective: 'three-quarter',
      backgroundTreatment: 'subtle-gradient',
      negativePrompt: 'text, watermark, user interface screenshot',
    },
  }
}

// Published versions stay private; consumers receive independent copies.
const v1: Record<AdminStyleId, AdminStyleDefinition> = {
  soft: defineStyle({
    id: 'soft', label: '柔和立体', material: 'soft-clay', artStyle: '3d-clay',
    shellVariant: 'icon-sidebar', workbenchLayout: 'welcome-grid',
    colors: ['#7550B5', '#9C6A36', '#D19643', '#F8F4FF', '#FFFFFF', '#282135', '#706779'],
  }),
  warm: defineStyle({
    id: 'warm', label: '温润自然', material: 'natural-paper', artStyle: 'hand-drawn',
    shellVariant: 'expanded-sidebar', workbenchLayout: 'main-aside',
    colors: ['#6A7353', '#9A6247', '#A4783D', '#F7F3E9', '#FFFCF5', '#302E26', '#716C60'],
  }),
  mist: defineStyle({
    id: 'mist', label: '雾色微光', material: 'frosted-glass', artStyle: 'isometric',
    shellVariant: 'top-nav', workbenchLayout: 'sectioned',
    colors: ['#526998', '#77719C', '#487E83', '#F1F5FA', '#FFFFFF', '#253247', '#637086'],
  }),
  porcelain: defineStyle({
    id: 'porcelain', label: '光瓷科技', material: 'porcelain-metal', artStyle: 'isometric',
    shellVariant: 'wide-sidebar', workbenchLayout: 'staggered',
    colors: ['#356B9B', '#66798D', '#40868B', '#F3F7FB', '#FFFFFF', '#253341', '#617385'],
  }),
  aurora: defineStyle({
    id: 'aurora', label: '极光空间', material: 'aurora-optical', artStyle: 'isometric',
    shellVariant: 'top-nav-context', workbenchLayout: 'main-context',
    colors: ['#A7C6FF', '#C3ACFA', '#83D5CE', '#141B2D', '#202A40', '#EEF3FC', '#ACB8CE'],
  }),
}

export function getCurrentAdminStyleReference(id: unknown): AdminStyleReference | undefined {
  const parsed = AdminStyleIdSchema.safeParse(id)
  return parsed.success ? { id: parsed.data, version: 1 } : undefined
}

export function resolveAdminStyle(ref: unknown): AdminStyleDefinition | undefined {
  const parsed = AdminStyleReferenceSchema.safeParse(ref)
  if (!parsed.success || parsed.data.version !== 1) return undefined
  return structuredClone(v1[parsed.data.id])
}
