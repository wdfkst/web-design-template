import type { ProjectSpec } from '@vudt/spec'
import { adminLiteral } from './page.js'

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
  return {
    'src/theme/tokens.ts': `import { theme } from 'ant-design-vue'\nimport type { ThemeConfig } from 'ant-design-vue/es/config-provider/context'\nimport { primaryTextColor } from './contrast'\nimport './generated.css'\nexport const adminTheme: ThemeConfig = { algorithm: theme.${spec.theme.mode === 'dark' ? 'darkAlgorithm' : 'defaultAlgorithm'}, token: { ...${adminLiteral(token)}, colorTextLightSolid: primaryTextColor(${adminLiteral(colors.primary)}) } }\n`,
    'src/theme/generated.css': `:root {\n  --admin-bg: ${colors.background};\n  --admin-surface: ${colors.surface};\n  --admin-text: ${colors.foreground};\n  --admin-muted: ${colors.muted};\n  --admin-primary: ${colors.primary};\n  --admin-on-primary: ${onPrimary};\n  --admin-border: color-mix(in srgb, ${colors.foreground} 18%, ${colors.surface});\n  --admin-nav: ${colors.surface};\n  --admin-nav-text: ${colors.foreground};\n  --admin-overlay: #00000066;\n  color-scheme: ${spec.theme.mode === 'dark' ? 'dark' : 'light'};\n}\n`,
  }
}
