<script setup lang="ts">
import FooterSimple from '../blocks/FooterSimple.vue'
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
    note?: string
    chromeless?: boolean
  }>(),
  { brand: '', links: () => [], note: '', chromeless: false },
)
</script>

<template>
  <div class="shell">
    <NavBarSimple v-if="!chromeless" :brand="brand" :links="links" :cta="cta" />
    <main class="shell__main">
      <slot />
    </main>
    <FooterSimple v-if="!chromeless" :brand="brand" :note="note" />
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.shell__main {
  flex: 1;
}
</style>
