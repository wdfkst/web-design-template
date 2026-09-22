<script setup lang="ts">
interface Logo {
  name: string
  to: string
}

withDefaults(
  defineProps<{
    heading?: string
    logos?: Logo[]
  }>(),
  { heading: '', logos: () => [] },
)
</script>

<template>
  <section class="section logos">
    <div class="container">
      <p v-if="heading" class="logos__heading">{{ heading }}</p>
      <div v-if="logos.length > 0" class="logos__row">
        <a
          v-for="(logo, index) in logos"
          :key="index"
          :href="logo.to"
          class="logos__item"
        >{{ logo.name }}</a>
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
  text-decoration: none;
  opacity: 0.75;
  transition: opacity 0.15s ease;
}

.logos__item:hover {
  opacity: 1;
  color: var(--color-foreground);
}
</style>
