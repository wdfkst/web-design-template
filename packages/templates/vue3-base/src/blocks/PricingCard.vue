<script setup lang="ts">
interface Cta {
  label: string
  to: string
}

interface Plan {
  name: string
  price: string
  period?: string
  tagline?: string
  features: string[]
  cta?: Cta
  featured?: boolean
}

withDefaults(
  defineProps<{
    heading?: string
    subheading?: string
    plans?: Plan[]
    note?: string
  }>(),
  { heading: '', subheading: '', plans: () => [], note: '' },
)
</script>

<template>
  <section class="section pricing">
    <div class="container">
      <header v-if="heading || subheading" class="pricing__head">
        <h2 v-if="heading" class="pricing__title">{{ heading }}</h2>
        <p v-if="subheading" class="pricing__sub">{{ subheading }}</p>
      </header>
      <div v-if="plans.length > 0" class="pricing__grid">
        <article
          v-for="plan in plans"
          :key="plan.name"
          class="pricing__card"
          :class="{ 'pricing__card--featured': plan.featured }"
        >
          <h3 class="pricing__name">{{ plan.name }}</h3>
          <p v-if="plan.tagline" class="pricing__tagline">{{ plan.tagline }}</p>
          <p class="pricing__price">
            <span class="pricing__amount">{{ plan.price }}</span>
            <span v-if="plan.period" class="pricing__period">/ {{ plan.period }}</span>
          </p>
          <ul class="pricing__features">
            <li v-for="feature in plan.features" :key="feature" class="pricing__feature">
              {{ feature }}
            </li>
          </ul>
          <router-link
            v-if="plan.cta"
            :to="plan.cta.to"
            class="button"
            :class="{ 'button--ghost': !plan.featured }"
          >{{ plan.cta.label }}</router-link>
        </article>
      </div>
      <p v-if="note" class="pricing__note">{{ note }}</p>
    </div>
  </section>
</template>

<style scoped>
.pricing__head {
  text-align: center;
  margin-bottom: calc(var(--space-unit) * 3);
}

.pricing__title {
  font-family: var(--font-heading);
  font-size: clamp(1.5rem, 3vw, 2.25rem);
  margin: 0 0 var(--space-unit);
}

.pricing__sub {
  color: var(--color-muted);
  max-width: 48ch;
  margin: 0 auto;
}

.pricing__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: calc(var(--space-unit) * 2);
  align-items: stretch;
}

.pricing__card {
  display: flex;
  flex-direction: column;
  gap: var(--space-unit);
  padding: calc(var(--space-unit) * 2);
  border: 1px solid color-mix(in srgb, var(--color-muted) 25%, transparent);
  border-radius: var(--radius);
  background: var(--color-surface);
}

.pricing__card--featured {
  border-color: var(--color-primary);
  box-shadow: 0 4px 24px color-mix(in srgb, var(--color-primary) 18%, transparent);
}

.pricing__name {
  font-family: var(--font-heading);
  font-size: 1.25rem;
  margin: 0;
}

.pricing__tagline {
  color: var(--color-muted);
  font-size: 0.9rem;
  margin: 0;
}

.pricing__price {
  margin: 0;
}

.pricing__amount {
  font-family: var(--font-heading);
  font-size: 2rem;
  font-weight: 700;
}

.pricing__period {
  color: var(--color-muted);
}

.pricing__features {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-unit);
  flex: 1;
}

.pricing__feature::before {
  content: '✓';
  margin-right: 0.5em;
  color: var(--color-accent);
}

.pricing__note {
  text-align: center;
  color: var(--color-muted);
  margin-top: calc(var(--space-unit) * 2);
}
</style>
