<script setup lang="ts">
defineProps<{ title: string; description?: string }>()
</script>
<template>
  <section class="admin-page">
    <header class="page-heading"><div><h1>{{ title }}</h1><p v-if="description">{{ description }}</p></div><div><slot name="actions" /></div></header>
    <slot />
  </section>
</template>
<style scoped>
.admin-page{min-width:0}.page-heading{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:22px;flex-wrap:wrap}
h1{font-size:22px;font-weight:600;margin:0 0 6px}p{margin:0;color:var(--admin-muted);line-height:1.6;font-size:13px}
</style>
