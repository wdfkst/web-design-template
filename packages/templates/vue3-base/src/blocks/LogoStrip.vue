<script setup lang="ts">
withDefaults(
  defineProps<{
    heading?: string
    logos?: string[]
  }>(),
  { heading: '', logos: () => [] },
)
</script>

<template>
  <section class="section logos">
    <div class="container">
      <p v-if="heading" class="logos__heading">{{ heading }}</p>
      <!--
        Names only, no links. The product is fictional, so any domain the model
        writes is invented — and an invented domain is worse than no link at all.
      -->
      <div v-if="logos.length > 0" class="logos__row">
        <span v-for="(name, index) in logos" :key="index" class="logos__item">{{ name }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.logos__heading {
  text-align: center;
  color: var(--color-muted);
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: calc(var(--space-unit) * 2);
}

.logos__row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: calc(var(--space-unit) * 2) calc(var(--space-unit) * 4);
}

.logos__item {
  color: var(--color-muted);
  font-family: var(--font-heading);
  font-weight: 700;
  font-size: 1.125rem;
  opacity: 0.75;
}
</style>
