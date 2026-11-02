import type { AdminStyleId } from '@vudt/spec'

// Browser-safe directory only; full generation parameters stay in the spec registry.
export const adminStyleCatalog = [
  { id: 'soft', version: 1, name: '柔和立体', description: '图标侧栏 · 软质立体 · 欢迎区与卡片网格', entry: 'soft/1/index.html', assetKind: 'ai-sample' },
  { id: 'warm', version: 1, name: '温润自然', description: '展开侧栏 · 自然纸感 · 主区与辅助栏', entry: 'warm/1/index.html', assetKind: 'ai-sample' },
  { id: 'mist', version: 1, name: '雾色微光', description: '顶部导航 · 磨砂柔光 · 分区工作台', entry: 'mist/1/index.html', assetKind: 'ai-sample' },
  { id: 'porcelain', version: 1, name: '光瓷科技', description: '宽侧导航 · 陶瓷金属 · 错落主次模块', entry: 'porcelain/1/index.html', assetKind: 'illustration' },
  { id: 'aurora', version: 1, name: '极光空间', description: '顶部导航 · 深色光学 · 上下文侧区', entry: 'aurora/1/index.html', assetKind: 'illustration' },
] as const satisfies readonly { id: AdminStyleId; version: number; name: string; description: string; entry: string; assetKind: string }[]
export type AdminStyleCard = typeof adminStyleCatalog[number]
export function adminStyleName(id: string): string {
  return adminStyleCatalog.find(style => style.id === id)?.name ?? id
}
export function previewEntry(style: AdminStyleCard): string {
  return `/admin-style-previews/${style.entry}`
}
export async function loadPreviewManifest(signal?: AbortSignal): Promise<void> {
  const response = await fetch('/admin-style-previews/manifest.json', { cache: 'no-store', signal: signal ?? null })
  if (!response.ok) throw new Error('预览清单无法加载')
  const value: unknown = await response.json()
  if (!value || typeof value !== 'object') throw new Error('预览清单无效')
  const data = value as Record<string, unknown>
  if (data.schemaVersion !== 1 || typeof data.templateFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(data.templateFingerprint) || !Array.isArray(data.styles) || data.styles.length !== adminStyleCatalog.length) throw new Error('预览清单版本不一致')
  for (const style of adminStyleCatalog) {
    const items = data.styles.filter((item: unknown) => item && typeof item === 'object' && 'id' in item && item.id === style.id)
    const item = items[0]
    if (items.length !== 1 || item.version !== style.version || item.entry !== style.entry || item.assetKind !== style.assetKind) throw new Error('预览风格版本不一致')
  }
}
