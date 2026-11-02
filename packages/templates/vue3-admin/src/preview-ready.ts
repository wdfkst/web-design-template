/** Only the platform's isolated, static samples participate in this protocol. */
export async function reportPreviewReady(rendered: Promise<unknown>): Promise<void> {
  const session = new URLSearchParams(location.search).get('previewSession')
  const enabled = window.parent !== window && session && /^\/admin-style-previews\/(soft|warm|mist|porcelain|aurora)\/1\/index\.html$/.test(location.pathname)
  const route = location.hash.slice(1)
  try {
    await rendered
    if (!enabled) return
    const main = document.querySelector('#app main')
    if (!main?.children.length) throw new Error('Preview page did not render')
    await Promise.all([
      ...Array.from(document.querySelectorAll<HTMLImageElement>('#app img'), image => image.decode()),
      ...Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'), link => {
        if (link.sheet) return Promise.resolve()
        return new Promise<void>((resolve, reject) => {
          link.addEventListener('load', () => resolve(), { once: true })
          link.addEventListener('error', () => reject(new Error('Preview stylesheet failed')), { once: true })
        })
      }),
    ])
    window.parent.postMessage({ type: 'admin-preview-ready', session, route }, '*')
  } catch {
    if (enabled) window.parent.postMessage({ type: 'admin-preview-failed', session, route }, '*')
  }
}
