<script setup lang="ts">
interface Faq {
  question: string
  answer: string
}

withDefaults(
  defineProps<{
    heading?: string
    subheading?: string
    faqs?: Faq[]
  }>(),
  { heading: '', subheading: '', faqs: () => [] },
)
</script>

<template>
  <section class="section faq">
    <div class="container faq__inner">
      <header v-if="heading || subheading" class="faq__head">
        <h2 v-if="heading" class="faq__title">{{ heading }}</h2>
        <p v-if="subheading" class="faq__sub">{{ subheading }}</p>
      </header>
      <div v-if="faqs.length > 0" class="faq__list">
        <details v-for="faq in faqs" :key="faq.question" class="faq__item">
          <summary class="faq__question">{{ faq.question }}</summary>
          <p class="faq__answer">{{ faq.answer }}</p>
        </details>
      </div>
    </div>
  </section>
</template>

<style scoped>
.faq__head {
  text-align: center;
  margin-bottom: calc(var(--space-unit) * 3);
}

.faq__title {
  font-family: var(--font-heading);
  font-size: clamp(1.5rem, 3vw, 2.25rem);
  margin: 0 0 var(--space-unit);
}

.faq__sub {
  color: var(--color-muted);
  max-width: 48ch;
  margin: 0 auto;
}

.faq__list {
  max-width: 720px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-unit);
}

.faq__item {
  border: 1px solid color-mix(in srgb, var(--color-muted) 25%, transparent);
  border-radius: var(--radius);
  background: var(--color-surface);
  padding: 0 calc(var(--space-unit) * 1.5);
}

.faq__question {
  cursor: pointer;
  padding: calc(var(--space-unit) * 1.25) 0;
  font-family: var(--font-heading);
  font-weight: 600;
  list-style: none;
}

.faq__question::-webkit-details-marker {
  display: none;
}

.faq__answer {
  color: var(--color-muted);
  padding-bottom: calc(var(--space-unit) * 1.25);
  margin: 0;
}
</style>
