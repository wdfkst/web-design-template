<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { AdminPresentation } from '../../data/admin-config'
import { safeCoverUrl } from '../../data/cover'
import AdminMotif from './AdminMotif.vue'
const props = defineProps<{ src?: unknown; title: string; motif?: AdminPresentation['motif']; decorative?: boolean }>()
const url = computed(() => safeCoverUrl(props.src))
const failed = ref(false)
watch(() => props.src, () => { failed.value = false })
</script>
<template>
  <div class="card-cover">
    <img v-if="url && !failed" :src="url" :alt="title" loading="lazy" referrerpolicy="no-referrer" @error="failed = true" />
    <template v-else-if="decorative"><AdminMotif :motif="motif" compact /><span class="sr-only">装饰占位，非真实封面</span></template>
    <span v-else class="cover-empty">暂无封面</span>
  </div>
</template>
<style scoped>
.card-cover{height:170px;display:flex;align-items:center;justify-content:center;overflow:hidden;background:var(--admin-surface);border-bottom:1px solid var(--admin-border)}img{width:100%;height:100%;object-fit:cover}.cover-empty{font-size:12px;color:var(--admin-muted)}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
:global(.is-jelly[data-decoration=balanced]) .card-cover{background:radial-gradient(ellipse at 80% 5%,color-mix(in srgb,var(--admin-glow-c) 25%,transparent),transparent 65%),var(--jelly-tint,var(--admin-surface))}
</style>
