<script setup lang="ts">
import type { SlotAssets } from '../asset'

withDefaults(
  defineProps<{
    headline?: string
    subhead?: string
    primaryCta?: string
    assets?: SlotAssets
  }>(),
  { headline: '', subhead: '', primaryCta: '', assets: () => ({}) },
)
</script>

<template>
  <section class="hero-centered">
    <!-- geometry mirrors HeroCentered.slots.ts: backdrop 16:9 1600x900 -->
    <img
      v-if="assets.backdrop"
      class="hero-centered__backdrop"
      data-asset-slot="backdrop"
      :src="assets.backdrop.src"
      :alt="assets.backdrop.alt"
      width="1600"
      height="900"
      loading="eager"
    />
    <div class="container hero-centered__copy">
      <h1>{{ headline }}</h1>
      <p class="hero-centered__subhead">{{ subhead }}</p>
      <a v-if="primaryCta" class="button" href="#cta">{{ primaryCta }}</a>
    </div>
  </section>
</template>

<style scoped>
.hero-centered {
  position: relative;
  display: grid;
  place-items: center;
  min-height: min(56.25vw, 620px);
  overflow: hidden;
  text-align: center;
}

/* full-bleed: the backdrop crops rather than letterboxes. */
.hero-centered__backdrop {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

/* Copy sits in the upper third, matching the slot's prompt contract. */
.hero-centered__copy {
  position: relative;
  padding-block: calc(var(--space-unit) * 4);
  align-self: start;
}

.hero-centered__subhead {
  color: var(--color-muted);
  margin-inline: auto;
  max-width: 46ch;
}
</style>
