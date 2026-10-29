import type { ThemeConfig } from 'ant-design-vue/es/config-provider/context'
import { primaryTextColor } from './contrast'

export const adminThemeMode: 'light' | 'dark' | 'both' = 'light'
export const adminThemeModes: { light: ThemeConfig; dark: ThemeConfig } | undefined = undefined
export const adminTheme: ThemeConfig = {
  token: { colorPrimary: '#087f75', colorTextLightSolid: primaryTextColor('#087f75'), borderRadius: 6, fontSize: 14, controlHeight: 34 },
}
