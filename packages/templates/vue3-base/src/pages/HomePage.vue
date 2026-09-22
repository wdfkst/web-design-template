<script setup lang="ts">
/**
 * Placeholder page. The generator replaces src/pages/ entirely, one file per
 * spec page, wiring each block's props and `assets` from the manifest. It is
 * kept here so the untouched template still builds and typechecks on its own.
 */
import NavBarSimple from '../blocks/NavBarSimple.vue'
import HeroSplit from '../blocks/HeroSplit.vue'
import FooterSimple from '../blocks/FooterSimple.vue'
</script>

<template>
  <NavBarSimple brand="Acme" />
  <HeroSplit headline="Template base" subhead="Replaced by the generator." />
  <FooterSimple brand="Acme" note="Template base" />
</template>
