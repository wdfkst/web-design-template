<script setup lang="ts">
import { ref, watch } from 'vue'
import AdminIcon from './AdminIcon.vue'
const props = defineProps<{ asset?: { src: string; alt: string; w: number; h: number }; passwordFocused?: boolean }>()
const failed = ref(false)
watch(() => props.asset?.src, () => { failed.value = false })
</script>
<template>
  <div class="auth-artwork">
    <img v-if="asset?.src && !failed" class="auth-generated-art" :src="asset.src" :alt="asset.alt" :width="asset.w" :height="asset.h" @error="failed = true" />
    <div v-else class="auth-scene" role="img" aria-label="银灰色立体机器人插画">
      <div class="auth-orbit" /><div class="auth-platform" /><div class="auth-orb" />
      <div class="auth-robot" :class="{ 'is-shy': passwordFocused }" aria-hidden="true">
        <div class="auth-antenna" /><div class="auth-robot-head"><div class="auth-visor"><i /><i /></div></div>
        <div class="auth-torso"><AdminIcon name="grid" /></div><div class="auth-arm" /><div class="auth-arm is-right" /><div class="auth-foot" /><div class="auth-foot is-right" />
      </div>
      <div class="auth-float-card" aria-hidden="true"><AdminIcon name="grid" /><span>让协作更有序</span></div>
    </div>
  </div>
</template>
