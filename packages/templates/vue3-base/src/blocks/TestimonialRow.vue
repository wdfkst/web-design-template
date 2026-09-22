<script setup lang="ts">
interface Testimonial {
  quote: string
  author: string
  role?: string
}

withDefaults(
  defineProps<{
    heading?: string
    testimonials?: Testimonial[]
  }>(),
  { heading: '', testimonials: () => [] },
)
</script>

<template>
  <section class="section quotes">
    <div class="container">
      <h2 v-if="heading" class="quotes__title">{{ heading }}</h2>
      <div v-if="testimonials.length > 0" class="quotes__grid">
        <figure v-for="(item, index) in testimonials" :key="item.author" class="quotes__card">
          <blockquote class="quotes__quote">"{{ item.quote }}"</blockquote>
          <figcaption class="quotes__byline">
            <strong class="quotes__author">{{ item.author }}</strong>
            <span v-if="item.role" class="quotes__role">{{ item.role }}</span>
          </figcaption>
        </figure>
      </div>
    </div>
  </section>
</template>

<style scoped>
.quotes__title {
  font-family: var(--font-heading);
  text-align: center;
  font-size: clamp(1.5rem, 3vw, 2.25rem);
  margin: 0 0 calc(var(--space-unit) * 3);
}

.quotes__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: calc(var(--space-unit) * 2);
}

.quotes__card {
  margin: 0;
  padding: calc(var(--space-unit) * 2);
  border-radius: var(--radius);
  background: var(--color-surface);
  border: 1px solid color-mix(in srgb, var(--color-muted) 25%, transparent);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: var(--space-unit);
}

.quotes__quote {
  margin: 0;
  font-size: 1.05rem;
  line-height: 1.6;
}

.quotes__byline {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.quotes__author {
  font-family: var(--font-heading);
}

.quotes__role {
  color: var(--color-muted);
  font-size: 0.875rem;
}
</style>
