<script setup lang="ts">
withDefaults(
  defineProps<{
    brand?: string
    note?: string
  }>(),
  { brand: 'Acme', note: '' },
)
</script>

<template>
  <footer class="footer">
    <div class="container footer__inner">
      <span>{{ brand }}</span>
      <span class="footer__note">{{ note }}</span>
    </div>
  </footer>
</template>

<style scoped>
.footer {
  border-top: 1px solid color-mix(in srgb, var(--color-muted) 25%, transparent);
}

.footer__inner {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--space-unit);
  padding-block: calc(var(--space-unit) * 2);
}

.footer__note {
  color: var(--color-muted);
}
</style>
