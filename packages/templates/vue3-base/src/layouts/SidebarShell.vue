<script setup lang="ts">
import NavBarSimple from '../blocks/NavBarSimple.vue'

interface NavLink {
  label: string
  to: string
}

withDefaults(
  defineProps<{
    brand?: string
    links?: NavLink[]
    cta?: NavLink
    chromeless?: boolean
  }>(),
  { brand: '', links: () => [], chromeless: false },
)
</script>

<template>
  <div class="shell">
    <aside v-if="!chromeless" class="shell__aside">
      <NavBarSimple :brand="brand" :links="links" :cta="cta" orientation="vertical" />
    </aside>
    <main class="shell__main">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.shell {
  display: grid;
  grid-template-columns: 240px 1fr;
  min-height: 100vh;
}

.shell__aside {
  height: 100%;
}

.shell__main {
  min-width: 0;
}

/* A hidden aside must not keep reserving its column. */
.shell:has(.shell__main:only-child) {
  grid-template-columns: 1fr;
}
</style>
