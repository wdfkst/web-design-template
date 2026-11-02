<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import type { AdminStyleId } from '@vudt/spec'
import AdminStylePreview from './AdminStylePreview.vue'
import { adminStyleCatalog, loadPreviewManifest, previewEntry, type AdminStyleCard } from './adminStyleCatalog.js'

defineProps<{ modelValue?: AdminStyleId | undefined; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: AdminStyleId | undefined] }>()
const preview = ref<AdminStyleCard>()
const ready = ref(false)
const error = ref(false)
const loading = ref(false)
let controller: AbortController | undefined
async function load() {
  controller?.abort()
  const current = new AbortController(); controller = current
  loading.value = true; error.value = false; ready.value = false
  try { await loadPreviewManifest(current.signal); if (!current.signal.aborted) ready.value = true }
  catch { if (!current.signal.aborted) error.value = true }
  finally { if (!current.signal.aborted) loading.value = false }
}
onMounted(load)
onUnmounted(() => controller?.abort())
</script>

<template>
  <section class="style-picker" aria-label="后台风格选择">
    <p>选择一套后台风格。布局、组件和插画会保持该风格，业务内容按你的需求生成。</p>
    <p v-if="loading" role="status">正在加载风格预览…</p>
    <div v-if="error" role="alert">预览不可用或版本不一致。请先运行 <code>pnpm build:admin-previews</code>，再重试。<button type="button" @click="load">重试加载预览</button></div>
    <div class="style-picker__grid">
      <article v-for="style in adminStyleCatalog" :key="style.id" class="style-picker__card" :class="{ 'is-selected': modelValue === style.id }">
        <div class="style-picker__thumbnail" aria-hidden="true" inert>
          <iframe v-if="ready" :src="`${previewEntry(style)}#/`" :title="`${style.name}工作台缩略图`" sandbox="allow-scripts" tabindex="-1" loading="lazy" referrerpolicy="no-referrer" />
          <span v-else>工作台预览待加载</span>
        </div>
        <div class="style-picker__body"><button class="style-picker__choose" type="button" :aria-label="`选择${style.name}`" :aria-pressed="modelValue === style.id" :disabled="disabled" @click="emit('update:modelValue', style.id)"><strong>{{ style.name }}</strong><span>{{ modelValue === style.id ? '已选择' : '选择' }}</span></button>
          <p>{{ style.description }}</p>
          <small>{{ style.assetKind === 'illustration' ? '本地示意插画 · 非 AI 成图' : 'AI 示例插画' }}</small>
          <button class="style-picker__open" type="button" :aria-label="`预览${style.name}`" :disabled="!ready || disabled" @click="preview = style">查看三页预览</button>
        </div>
      </article>
    </div>
    <AdminStylePreview v-if="preview" :style="preview" @close="preview = undefined" />
  </section>
</template>

<style scoped>
.style-picker { margin: 12px 0; color: var(--studio-text, #243545); }
.style-picker > p { margin: 0 0 14px; font-size: 13px; line-height: 1.7; }
.style-picker__grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 210px), 1fr)); gap: 14px; }
.style-picker__card { min-width: 0; overflow: hidden; border: 1px solid #cedae2; border-radius: 12px; background: #fff; }
.style-picker__card.is-selected { border-color: #296f7b; box-shadow: 0 0 0 2px #296f7b; }
.style-picker__thumbnail { height: 146px; overflow: hidden; background: #eef3f6; position: relative; }
.style-picker__thumbnail iframe { width: 1440px; height: 920px; transform: scale(.23); transform-origin: top left; border: 0; pointer-events: none; }
.style-picker__thumbnail > span { display: block; padding: 32px 16px; color: #536574; font-size: 13px; }
.style-picker__body { padding: 12px; }
.style-picker__body p { min-height: 42px; font-size: 12px; line-height: 1.7; margin: 8px 0; }
.style-picker__body small { display: block; font-size: 11px; color: #536574; }
button { font: inherit; cursor: pointer; color: #243545; }
.style-picker__choose { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 5px 0; background: none; border: 0; text-align: left; gap: 8px; }
.style-picker__choose span { font-size: 12px; color: #296f7b; }
.style-picker__open { margin-top: 12px; background: #f3f8fa; border: 1px solid #cedae2; border-radius: 6px; padding: 7px 10px; width: 100%; font-size: 12px; }
button:focus-visible { outline: 3px solid #296f7b; outline-offset: 3px; }
button:disabled { opacity: .5; cursor: not-allowed; }
[role='alert'] { margin-bottom: 14px; padding: 12px; background: #fff2f2; color: #8b2828; font-size: 13px; line-height: 1.7; }
[role='alert'] button { margin-left: 8px; }
</style>
