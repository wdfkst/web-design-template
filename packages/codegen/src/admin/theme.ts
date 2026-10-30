import type { ProjectSpec } from '@vudt/spec'
import { adminLiteral } from './page.js'

function luminance(color: string): number {
  const hex = color.length === 4 ? [...color.slice(1)].map(c => c + c).join('') : color.slice(1)
  const channels = [0, 2, 4].map(offset => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return channels[0]! * .2126 + channels[1]! * .7152 + channels[2]! * .0722
}
function readable(background: string, desired: string): string {
  const a = luminance(background), b = luminance(desired)
  if ((Math.max(a, b) + .05) / (Math.min(a, b) + .05) >= 4.5) return desired
  return a > .179 ? '#000000' : '#ffffff'
}
function renderPersonalizedTheme(spec: ProjectSpec, radius: number): Record<string, string> {
  const presentation = spec.experience?.kind === 'admin' ? spec.experience.presentation! : undefined!
  const colors = spec.theme.colorTokens
  const spacing = presentation.density === 'comfortable' ? 'normal' : presentation.density ?? spec.theme.spacing
  const controlHeight = spacing === 'compact' ? 30 : spacing === 'relaxed' ? 38 : 34
  const lightSurface = luminance(colors.surface) > .5 ? colors.surface : '#f8f9fc'
  const darkSurface = luminance(colors.surface) < .08 ? colors.surface : '#202332'
  const modes = {
    light: { surface: lightSurface, bg: '#eef0f7', text: readable(lightSurface, colors.foreground), muted: readable(lightSurface, colors.muted) },
    dark: { surface: darkSurface, bg: '#151722', text: readable(darkSurface, '#f0f1f8'), muted: readable(darkSurface, '#bbc0d2') },
  }
  const token = (mode: 'light' | 'dark') => ({ colorPrimary: colors.primary, colorBgBase: modes[mode].bg, colorBgContainer: modes[mode].surface, colorText: modes[mode].text, colorTextSecondary: modes[mode].muted, colorTextLightSolid: readable(colors.primary, '#ffffff'), borderRadius: radius, controlHeight, fontSize: 14 })
  const css = (mode: 'light' | 'dark') => {
    const m = modes[mode]
    const jelly = presentation.appearance === 'jelly' ? '--admin-jelly-panel-radius:16px;--admin-jelly-card-radius:20px;--admin-jelly-hero-radius:28px;--admin-jelly-control-radius:12px;' : ''
    return `${jelly}--admin-bg:${m.bg};--admin-surface:${m.surface};--admin-text:${m.text};--admin-muted:${m.muted};--admin-primary:${colors.primary};--admin-on-primary:${readable(colors.primary, '#ffffff')};--admin-border:color-mix(in srgb, ${m.text} 18%, ${m.surface});--admin-nav:${m.surface};--admin-nav-text:${m.text};--admin-overlay:#00000066;--admin-glass:color-mix(in srgb, ${m.surface} 86%, transparent);--admin-glow-a:${colors.primary};--admin-glow-b:${colors.secondary};--admin-glow-c:${colors.accent};--admin-radius:${Math.max(radius, 12)}px;--admin-space:${spacing === 'compact' ? 16 : spacing === 'relaxed' ? 28 : 24}px;--admin-shadow:0 16px 44px #000000${mode === 'dark' ? '30' : '10'};color-scheme:${mode};`
  }
  return {
    'src/theme/presentation.ts': `import type { AdminPresentation } from '../data/admin-config'\nexport const presentation: AdminPresentation = ${adminLiteral(presentation)}\n`,
    'src/theme/tokens.ts': `import { theme } from 'ant-design-vue'\nimport type { ThemeConfig } from 'ant-design-vue/es/config-provider/context'\nimport './generated.css'\nexport const adminThemeMode: 'light' | 'dark' | 'both' = ${adminLiteral(spec.theme.mode)}\nexport const adminThemeModes: {light:ThemeConfig;dark:ThemeConfig} = {light:{algorithm:theme.defaultAlgorithm,token:${adminLiteral(token('light'))}},dark:{algorithm:theme.darkAlgorithm,token:${adminLiteral(token('dark'))}}}\nexport const adminTheme = adminThemeModes.${spec.theme.mode === 'dark' ? 'dark' : 'light'}\n`,
    'src/theme/generated.css': `:root{${css(spec.theme.mode === 'dark' ? 'dark' : 'light')}}\n:root[data-admin-mode="light"]{${css('light')}}\n:root[data-admin-mode="dark"]{${css('dark')}}\n`,
  }
}

export function renderAdminTheme(spec: ProjectSpec): Record<string, string> {
  const colors = spec.theme.colorTokens
  const hex = colors.primary.length === 4 ? [...colors.primary.slice(1)].map(channel => channel + channel).join('') : colors.primary.slice(1)
  const channels = [0, 2, 4].map(offset => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  const luminance = channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722
  const onPrimary = (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05) ? '#000000' : '#ffffff'
  const radius = { none: 0, sm: 4, md: 8, lg: 12, full: 16 }[spec.theme.radius]
  const token = { colorPrimary: colors.primary, colorBgBase: colors.background, colorBgContainer: colors.surface, colorText: colors.foreground, colorTextSecondary: colors.muted, borderRadius: radius, controlHeight: spec.theme.spacing === 'compact' ? 30 : 34, fontSize: 14 }
  const presentation = spec.experience?.kind === 'admin' ? spec.experience.presentation : undefined
  if (presentation) return renderPersonalizedTheme(spec, radius)
  return {
    'src/theme/presentation.ts': `import type { AdminPresentation } from '../data/admin-config'\nexport const presentation: AdminPresentation | undefined = undefined\n`,
    'src/theme/tokens.ts': `import { theme } from 'ant-design-vue'\nimport type { ThemeConfig } from 'ant-design-vue/es/config-provider/context'\nimport { primaryTextColor } from './contrast'\nimport './generated.css'\nexport const adminThemeMode: 'light' | 'dark' | 'both' = ${adminLiteral(spec.theme.mode)}\nexport const adminThemeModes: { light: ThemeConfig; dark: ThemeConfig } | undefined = undefined\nexport const adminTheme: ThemeConfig = { algorithm: theme.${spec.theme.mode === 'dark' ? 'darkAlgorithm' : 'defaultAlgorithm'}, token: { ...${adminLiteral(token)}, colorTextLightSolid: primaryTextColor(${adminLiteral(colors.primary)}) } }\n`,
    'src/theme/generated.css': `:root {\n  --admin-bg: ${colors.background};\n  --admin-surface: ${colors.surface};\n  --admin-text: ${colors.foreground};\n  --admin-muted: ${colors.muted};\n  --admin-primary: ${colors.primary};\n  --admin-on-primary: ${onPrimary};\n  --admin-border: color-mix(in srgb, ${colors.foreground} 18%, ${colors.surface});\n  --admin-nav: ${colors.surface};\n  --admin-nav-text: ${colors.foreground};\n  --admin-overlay: #00000066;\n  color-scheme: ${spec.theme.mode === 'dark' ? 'dark' : 'light'};\n}\n`,
  }
}
