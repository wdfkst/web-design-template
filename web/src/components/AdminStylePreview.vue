<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { previewEntry, type AdminStyleCard } from './adminStyleCatalog.js'

const props = defineProps<{ style: AdminStyleCard }>()
const emit = defineEmits<{ close: [] }>()
const dialog = ref<HTMLDialogElement>()
const closeButton = ref<HTMLButtonElement>()
const iframe = ref<HTMLIFrameElement>()
const session = ref(crypto.randomUUID())
const selectedPage = ref('/')
const loading = ref(true)
const failed = ref(false)
const revision = ref(0)
const pages = [{ route: '/', name: '工作台' }, { route: '/orders', name: '订单列表' }, { route: '/products/edit', name: '商品编辑' }]
const src = computed(() => `${previewEntry(props.style)}?previewSession=${session.value}#${selectedPage.value}`)
let timeout: ReturnType<typeof setTimeout> | undefined
let previousFocus: HTMLElement | null = null
function beginLoad() {
  clearTimeout(timeout)
  loading.value = true; failed.value = false
  timeout = setTimeout(onError, 20000)
}
function onError() { clearTimeout(timeout); loading.value = false; failed.value = true }
function onMessage(event: MessageEvent) {
  if (!loading.value || failed.value || !iframe.value || event.source !== iframe.value.contentWindow || event.origin !== 'null') return
  const data: unknown = event.data
  if (!data || typeof data !== 'object' || !('session' in data) || data.session !== session.value || !('route' in data) || data.route !== selectedPage.value || !('type' in data)) return
  if (data.type === 'admin-preview-failed') onError()
  else if (data.type === 'admin-preview-ready') { clearTimeout(timeout); loading.value = false }
}
function changePage(route: string) { selectedPage.value = route; retry() }
function retry() { session.value = crypto.randomUUID(); revision.value++; beginLoad() }
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') { event.preventDefault(); emit('close'); return }
  if (event.key !== 'Tab') return
  const targets = dialog.value?.querySelectorAll<HTMLElement>('button:not(:disabled), iframe')
  if (!targets?.length) return
  const first = targets[0], last = targets[targets.length - 1]
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
}
onMounted(async () => {
  window.addEventListener('message', onMessage)
  previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  if (typeof dialog.value?.showModal === 'function') dialog.value.showModal()
  else dialog.value?.setAttribute('open', '')
  await nextTick(); closeButton.value?.focus(); beginLoad()
})
onUnmounted(() => { window.removeEventListener('message', onMessage); clearTimeout(timeout); previousFocus?.focus() })
</script>

<template>
  <dialog ref="dialog" class="style-preview" role="dialog" aria-modal="true" aria-labelledby="style-preview-title" @keydown="onKeydown" @cancel.prevent="emit('close')">
    <header><div><h2 id="style-preview-title">{{ style.name }} <small>v{{ style.version }}</small></h2><p>同一咖啡业务的示例数据；实际生成内容随需求变化。</p></div><button ref="closeButton" type="button" aria-label="关闭预览" @click="emit('close')">关闭预览</button></header>
    <p class="asset-note">{{ style.assetKind === 'illustration' ? '插画为本地示意，非 AI 成图。' : '插画为已授权的 AI 示例素材。' }} 仅浏览静态样例，不会创建生成任务。</p>
    <nav aria-label="风格预览页面"><button v-for="page in pages" :key="page.route" type="button" :aria-pressed="selectedPage === page.route" @click="changePage(page.route)">{{ page.name }}</button></nav>
    <p v-if="loading" role="status">正在加载预览…</p>
    <div v-if="failed" role="alert">预览加载失败。请检查静态资源或运行 pnpm build:admin-previews。<button type="button" @click="retry">重试预览</button></div>
    <iframe v-else ref="iframe" :key="revision" :src="src" :title="`${style.name}页面预览`" sandbox="allow-scripts" referrerpolicy="no-referrer" @error="onError" />
  </dialog>
</template>

<style scoped>
.style-preview { box-sizing: border-box; position: fixed; inset: 0; width: min(1440px, calc(100vw - 32px)); max-width: none; height: min(940px, calc(100dvh - 32px)); max-height: none; margin: auto; padding: 20px; border: 1px solid var(--studio-line, #dce4e8); border-radius: 18px; background: var(--studio-panel, #fff); color: var(--studio-text, #243545); box-shadow: 0 20px 80px #14263740; }
.style-preview[open] { display: flex; flex-direction: column; gap: 12px; }
.style-preview::backdrop { background: #15233199; }
header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
h2, p { margin: 0; } h2 { font-size: 21px; } small { font-size: 13px; font-weight: 400; } header p, .asset-note { font-size: 13px; line-height: 1.6; }
nav { display: flex; gap: 8px; flex-wrap: wrap; }
button { font: inherit; padding: 8px 12px; border: 1px solid #c5d3dc; border-radius: 8px; background: #fff; color: #243545; cursor: pointer; }
button[aria-pressed='true'] { background: #e5f3f5; border-color: #296f7b; }
button:focus-visible { outline: 3px solid #296f7b; outline-offset: 3px; }
iframe { flex: 1; min-height: 0; width: 100%; border: 1px solid #dce4e8; border-radius: 8px; background: #fff; }
[role='alert'] { padding: 16px; color: #8b2828; background: #fff2f2; } [role='alert'] button { margin-left: 12px; }
@media (max-width: 600px) { .style-preview { padding: 12px; } header { gap: 8px; } header > button { flex-shrink: 0; } h2 { font-size: 18px; } }
</style>
