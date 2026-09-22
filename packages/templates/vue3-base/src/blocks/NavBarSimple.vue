<script setup lang="ts">
interface NavLink {
  label: string
  to: string
}

withDefaults(
  defineProps<{
    brand?: string
    links?: NavLink[]
    cta?: NavLink
    orientation?: 'horizontal' | 'vertical'
  }>(),
  { brand: 'Acme', links: () => [], orientation: 'horizontal' },
)
</script>

<template>
  <header class="nav" :class="`nav--${orientation}`">
    <div class="container nav__inner">
      <!--
        The brand is deliberately not a link: the platform cannot promise that a
        project declares "/", and a brand that points nowhere is the exact defect
        this file was rewritten to remove.
      -->
      <span class="nav__brand">{{ brand }}</span>
      <nav class="nav__links">
        <router-link
          v-for="link in links"
          :key="link.to"
          class="nav__link"
          :to="link.to"
        >{{ link.label }}</router-link>
      </nav>
      <router-link v-if="cta" class="button" :to="cta.to">{{ cta.label }}</router-link>
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

.nav__link {
  color: var(--color-muted);
  text-decoration: none;
}

.nav__link:hover,
.nav__link.router-link-active {
  color: var(--color-foreground);
}

/* The sidebar shell stacks this same nav down the left edge. */
.nav--vertical {
  border-bottom: 0;
  border-inline-end: 1px solid color-mix(in srgb, var(--color-muted) 25%, transparent);
  height: 100%;
}

.nav--vertical .nav__inner {
  flex-direction: column;
  align-items: flex-start;
  gap: calc(var(--space-unit) * 1.5);
  padding-block: calc(var(--space-unit) * 2);
}

.nav--vertical .nav__links {
  flex-direction: column;
  margin-inline-end: 0;
}
</style>
