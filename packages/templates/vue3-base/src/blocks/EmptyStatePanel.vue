<script setup lang="ts">
import type { SlotAssets } from '../asset'

interface Cta {
  label: string
  to: string
}

withDefaults(
  defineProps<{
    headline?: string
    body?: string
    cta?: Cta
    assets?: SlotAssets
  }>(),
  { headline: '', body: '', assets: () => ({}) },
)
</script>

<template>
  <div class="empty">
    <!-- geometry mirrors EmptyStatePanel.slots.ts: illustration 1:1 512x512 -->
    <div class="empty__figure">
      <img
        v-if="assets.illustration"
        data-asset-slot="illustration"
        :src="assets.illustration.src"
        :alt="assets.illustration.alt"
        width="512"
        height="512"
        loading="lazy"
      />
    </div>
    <h3>{{ headline }}</h3>
    <p>{{ body }}</p>
    <router-link v-if="cta" class="button" :to="cta.to">{{ cta.label }}</router-link>
  </div>
</template>

<style scoped>
.empty {
  display: grid;
  justify-items: center;
  text-align: center;
  gap: 0.25rem;
  padding: calc(var(--space-unit) * 3);
  background: var(--color-surface);
  border-radius: var(--radius);
}

.empty__figure {
  aspect-ratio: 1 / 1;
  width: 160px;
}

.empty__figure img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.empty p {
  color: var(--color-muted);
  margin: 0 0 var(--space-unit);
}
</style>
