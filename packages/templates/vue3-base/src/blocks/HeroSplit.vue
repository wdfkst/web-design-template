<script setup lang="ts">
import type { SlotAssets } from '../asset'

withDefaults(
  defineProps<{
    headline?: string
    subhead?: string
    primaryCta?: string
    secondaryCta?: string
    assets?: SlotAssets
  }>(),
  { headline: '', subhead: '', primaryCta: '', secondaryCta: '', assets: () => ({}) },
)
</script>

<template>
  <section class="section hero">
    <div class="container hero__inner">
      <div class="hero__copy">
        <h1>{{ headline }}</h1>
        <p class="hero__subhead">{{ subhead }}</p>
        <div class="hero__actions">
          <a v-if="primaryCta" class="button" href="#cta">{{ primaryCta }}</a>
          <a v-if="secondaryCta" class="button button--ghost" href="#features">
            {{ secondaryCta }}
          </a>
        </div>
      </div>
      <!-- geometry mirrors HeroSplit.slots.ts: illustration 4:3 960x720 -->
      <div class="hero__figure">
        <img
          v-if="assets.illustration"
          data-asset-slot="illustration"
          :src="assets.illustration.src"
          :alt="assets.illustration.alt"
          width="960"
          height="720"
          loading="eager"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.hero__inner {
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: center;
  gap: calc(var(--space-unit) * 3);
}

.hero__subhead {
  color: var(--color-muted);
  font-size: 1.125rem;
  max-width: 34ch;
}

.hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-unit);
  margin-top: calc(var(--space-unit) * 1.5);
}

/* Reserves the 4:3 box so the copy never reflows when the image lands. */
.hero__figure {
  aspect-ratio: 4 / 3;
}

.hero__figure img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

@media (max-width: 860px) {
  .hero__inner {
    grid-template-columns: 1fr;
  }
}
</style>
