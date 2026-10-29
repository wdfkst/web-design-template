import type { ThemeConfig } from 'ant-design-vue/es/config-provider/context'
import { primaryTextColor } from './contrast'

export const adminTheme: ThemeConfig = {
  token: { colorPrimary: '#087f75', colorTextLightSolid: primaryTextColor('#087f75'), borderRadius: 6, fontSize: 14, controlHeight: 34 },
}
