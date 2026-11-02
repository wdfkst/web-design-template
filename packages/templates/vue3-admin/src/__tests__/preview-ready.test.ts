import { afterEach, expect, it, vi } from 'vitest'
import { reportPreviewReady } from '../preview-ready'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); history.replaceState(null, '', '/'); document.body.innerHTML = '' })
function preview() {
  history.replaceState(null, '', '/admin-style-previews/soft/1/index.html?previewSession=sample#/orders')
  document.body.innerHTML = '<div id="app"><main><h1>订单列表</h1></main></div>'
  const postMessage = vi.fn()
  vi.stubGlobal('parent', { postMessage })
  return postMessage
}
it('reports readiness only after application rendering finishes', async () => {
  const post = preview()
  let finish!: () => void
  const pending = reportPreviewReady(new Promise<void>(resolve => { finish = resolve }))
  await Promise.resolve()
  expect(post).not.toHaveBeenCalled()
  finish(); await pending
  expect(post).toHaveBeenCalledWith({ type: 'admin-preview-ready', session: 'sample', route: '/orders' }, '*')
})
it('waits for all rendered images to decode', async () => {
  const post = preview()
  const image = document.createElement('img')
  let finish!: () => void
  image.decode = () => new Promise<void>(resolve => { finish = resolve })
  document.querySelector('main')!.append(image)
  const pending = reportPreviewReady(Promise.resolve())
  await Promise.resolve()
  expect(post).not.toHaveBeenCalled()
  finish(); await pending
  expect(post).toHaveBeenCalledWith(expect.objectContaining({ type: 'admin-preview-ready' }), '*')
})
it.each(['render', 'image', 'empty'])('reports %s failure instead of readiness', async failure => {
  const post = preview()
  if (failure === 'empty') document.querySelector('main')!.replaceChildren()
  if (failure === 'image') {
    const image = document.createElement('img')
    image.decode = () => Promise.reject(new Error('broken image'))
    document.querySelector('main')!.append(image)
  }
  await reportPreviewReady(failure === 'render' ? Promise.reject(new Error('route failed')) : Promise.resolve())
  expect(post).toHaveBeenCalledExactlyOnceWith({ type: 'admin-preview-failed', session: 'sample', route: '/orders' }, '*')
})
it('does not declare readiness when a stylesheet failed to load', async () => {
  const post = preview()
  const link = document.createElement('link')
  link.rel = 'stylesheet'; link.href = '/missing.css'
  document.body.append(link)
  const pending = reportPreviewReady(Promise.resolve())
  await Promise.resolve(); await Promise.resolve()
  expect(post).not.toHaveBeenCalled()
  link.dispatchEvent(new Event('error'))
  await pending
  expect(post).toHaveBeenCalledWith(expect.objectContaining({ type: 'admin-preview-failed' }), '*')
})
it('does not send messages from ordinary exported applications', async () => {
  const post = preview()
  history.replaceState(null, '', '/export/index.html?previewSession=sample#/orders')
  await reportPreviewReady(Promise.resolve())
  expect(post).not.toHaveBeenCalled()
})
it('does not send messages for thumbnails without a session', async () => {
  const post = preview()
  history.replaceState(null, '', '/admin-style-previews/soft/1/index.html#/orders')
  await reportPreviewReady(Promise.resolve())
  expect(post).not.toHaveBeenCalled()
})
