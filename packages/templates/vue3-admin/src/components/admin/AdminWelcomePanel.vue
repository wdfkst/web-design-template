<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { AdminPresentation } from '../../data/admin-config'
import AdminMotif from './AdminMotif.vue'
export interface WelcomePanel { headline?: string; body?: string; assets?: Record<string, { src: string; alt: string; w: number; h: number }> }
const props = defineProps<WelcomePanel & { presentation?: AdminPresentation }>()
const failed = ref(false)
const jelly = computed(() => props.presentation?.appearance === 'jelly')
const decorated = computed(() => props.presentation?.decoration !== 'minimal')
watch(() => props.assets?.illustration?.src, () => { failed.value = false })
</script>
<template>
  <section class="welcome-panel" :class="{ 'jelly-welcome': jelly }">
    <div class="welcome-copy"><h2 v-if="headline">{{ headline }}</h2><p v-if="body">{{ body }}</p></div>
    <img v-if="assets?.illustration && (!jelly || decorated && !failed)" data-asset-slot="illustration" :src="assets.illustration.src" :alt="assets.illustration.alt" :width="assets.illustration.w" :height="assets.illustration.h" @error="failed = true" />
    <AdminMotif v-else-if="jelly && decorated" :motif="presentation?.motif" />
  </section>
</template>
<style scoped>
.welcome-panel{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:28px 32px;margin-bottom:24px;border:1px solid var(--admin-border);border-radius:var(--admin-radius,12px);background:radial-gradient(ellipse at 100% 0,var(--admin-glow-b,transparent),transparent 65%),var(--admin-surface);overflow:hidden}.welcome-copy{min-width:0;max-width:65ch}h2{font-size:25px;line-height:1.4;margin:0 0 12px;color:var(--admin-text);overflow-wrap:anywhere}p{margin:0;color:var(--admin-muted);line-height:1.8;overflow-wrap:anywhere}img{width:180px;height:180px;object-fit:contain;flex-shrink:0}@media(max-width:600px){.welcome-panel{padding:20px;gap:16px;flex-wrap:wrap}img{width:120px;height:120px}h2{font-size:21px}}
.jelly-welcome{border-radius:var(--admin-jelly-hero-radius,28px);background:var(--admin-surface);box-shadow:inset 0 2px 0 #ffffff30,0 6px 0 color-mix(in srgb,var(--admin-glow-b) 14%,var(--admin-surface));padding:28px 36px}.jelly-welcome .welcome-copy{border-left:5px solid var(--admin-glow-b);padding-left:22px}.jelly-welcome h2{font-size:30px;letter-spacing:-.6px}.jelly-welcome :deep(.admin-motif){margin-block:-12px}@media(max-width:600px){.jelly-welcome{padding:24px}.jelly-welcome h2{font-size:25px}.jelly-welcome :deep(.admin-motif){width:160px;height:134px;margin-left:auto}}
</style>
