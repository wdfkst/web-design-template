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
  <section class="section cta">
    <!-- geometry mirrors CtaBanner.slots.ts: decoration 16:9 1280x720, subject-right -->
    <img
      v-if="assets.decoration"
      class="cta__decoration"
      data-asset-slot="decoration"
      :src="assets.decoration.src"
      :alt="assets.decoration.alt"
      width="1280"
      height="720"
      loading="lazy"
      aria-hidden="true"
    />
    <div class="container cta__inner">
      <div class="cta__copy">
        <h2>{{ headline }}</h2>
        <p>{{ body }}</p>
      </div>
      <router-link v-if="cta" class="button" :to="cta.to">{{ cta.label }}</router-link>
    </div>
  </section>
</template>

<style scoped>
.cta {
  position: relative;
  overflow: hidden;
  background: var(--color-surface);
}

/*
 * The subject sits right of center, so the decoration is anchored right and the
 * copy column keeps the left half clear.
 */
.cta__decoration {
  position: absolute;
  inset-block: 0;
  inset-inline-end: 0;
  height: 100%;
  width: auto;
  object-fit: cover;
  object-position: right center;
  pointer-events: none;
}

.cta__inner {
  position: relative;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: calc(var(--space-unit) * 2);
}

.cta__copy {
  max-width: 48%;
}

.cta__copy p {
  color: var(--color-muted);
  margin: 0;
}

@media (max-width: 860px) {
  .cta__copy {
    max-width: 100%;
  }
}
</style>
