<script setup lang="ts">
import type { SlotAssets } from '../asset'
withDefaults(defineProps<{
    headline?: string
    body?: string
    assets?: SlotAssets
}>(), { headline: '', body: '', assets: () => ({}) })
</script>
<template>
  <section class="welcome">
    <div><h2>{{ headline }}</h2><p>{{ body }}</p></div>
    <img v-if="assets.illustration" data-asset-slot="illustration" :src="assets.illustration.src" :alt="assets.illustration.alt" :width="assets.illustration.w" :height="assets.illustration.h" />
  </section>
</template>
<style scoped>
.welcome{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:24px;padding:24px;background:var(--color-surface);border-radius:var(--radius)}.welcome>div{min-width:0;max-width:65ch;overflow-wrap:anywhere}.welcome p{color:var(--color-muted)}img{width:160px;height:160px;object-fit:contain;max-width:100%}
</style>
