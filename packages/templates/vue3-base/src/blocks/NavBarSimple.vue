<script setup lang="ts">
interface NavLink {
  label: string
  to: string
}

withDefaults(
  defineProps<{
    brand?: string
    links?: NavLink[]
    ctaLabel?: string
  }>(),
  { brand: 'Acme', links: () => [], ctaLabel: '' },
)
</script>

<template>
  <header class="nav">
    <div class="container nav__inner">
      <span class="nav__brand">{{ brand }}</span>
      <nav class="nav__links">
        <a v-for="link in links" :key="link.to" :href="link.to">{{ link.label }}</a>
      </nav>
      <a v-if="ctaLabel" class="button" href="#cta">{{ ctaLabel }}</a>
    </div>
  </header>
</template>

<style scoped>
.nav {
  border-bottom: 1px solid color-mix(in srgb, var(--color-muted) 25%, transparent);
  background: var(--color-background);
}

.nav__inner {
  display: flex;
  align-items: center;
  gap: calc(var(--space-unit) * 2);
  padding-block: var(--space-unit);
}

.nav__brand {
  font-family: var(--font-heading);
  font-weight: 700;
  font-size: 1.125rem;
}

.nav__links {
  display: flex;
  gap: calc(var(--space-unit) * 1.5);
  margin-inline-end: auto;
}

.nav__links a {
  color: var(--color-muted);
  text-decoration: none;
}

.nav__links a:hover {
  color: var(--color-foreground);
}
</style>
