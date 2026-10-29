<script setup lang="ts">
export interface WelcomePanel { headline?: string; body?: string; assets?: Record<string, { src: string; alt: string; w: number; h: number }> }
defineProps<WelcomePanel>()
</script>
<template>
  <section class="welcome-panel">
    <div class="welcome-copy"><h2 v-if="headline">{{ headline }}</h2><p v-if="body">{{ body }}</p></div>
    <img v-if="assets?.illustration" data-asset-slot="illustration" :src="assets.illustration.src" :alt="assets.illustration.alt" :width="assets.illustration.w" :height="assets.illustration.h" />
  </section>
</template>
<style scoped>
.welcome-panel{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:28px 32px;margin-bottom:24px;border:1px solid var(--admin-border);border-radius:var(--admin-radius,12px);background:radial-gradient(ellipse at 100% 0,var(--admin-glow-b,transparent),transparent 65%),var(--admin-surface);overflow:hidden}.welcome-copy{min-width:0;max-width:65ch}h2{font-size:25px;line-height:1.4;margin:0 0 12px;color:var(--admin-text);overflow-wrap:anywhere}p{margin:0;color:var(--admin-muted);line-height:1.8;overflow-wrap:anywhere}img{width:180px;height:180px;object-fit:contain;flex-shrink:0}@media(max-width:600px){.welcome-panel{padding:20px;gap:16px;flex-wrap:wrap}img{width:120px;height:120px}h2{font-size:21px}}
</style>
