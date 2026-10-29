<script setup lang="ts">
import { Empty } from 'ant-design-vue'
export interface EmptyPanel {
  headline?: string
  body?: string
  cta?: { label: string; to: string }
  assets?: { illustration?: { src: string; alt: string; w: number; h: number } }
}
defineProps<{ panel?: EmptyPanel; description: string }>()
</script>
<template>
  <div v-if="panel" class="empty-state">
    <img v-if="panel.assets?.illustration" v-bind="{ src: panel.assets.illustration.src, alt: panel.assets.illustration.alt, width: panel.assets.illustration.w, height: panel.assets.illustration.h }" />
    <strong v-if="panel.headline">{{ panel.headline }}</strong>
    <p>{{ description }}</p><p v-if="panel.body">{{ panel.body }}</p>
    <RouterLink v-if="panel.cta" :to="panel.cta.to">{{ panel.cta.label }}</RouterLink>
    <slot />
  </div>
  <Empty v-else :description="description"><slot /></Empty>
</template>
<style scoped>
.empty-state{display:flex;flex-direction:column;align-items:center;gap:12px;padding:24px;text-align:center;color:var(--admin-muted)}.empty-state img{max-width:min(100%,240px);height:auto}.empty-state strong{color:var(--admin-text)}.empty-state p{margin:0}
</style>
