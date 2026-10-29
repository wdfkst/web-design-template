<script setup lang="ts">
import { ref } from 'vue'
import { Alert, Button, Input } from 'ant-design-vue'
interface Asset { src: string; alt: string; w: number; h: number }
defineProps<{ title: string; panel: { heading?: string; subheading?: string; fields?: { label: string; type: string; placeholder?: string }[]; submitLabel?: string; assets?: Record<string, Asset> } }>()
const notice = ref(false)
</script>
<template>
  <main class="auth-page"><section class="auth-panel">
    <img v-if="panel.assets?.icon" v-bind="{ src: panel.assets.icon.src, alt: panel.assets.icon.alt, width: panel.assets.icon.w, height: panel.assets.icon.h }" class="auth-icon" />
    <h1>{{ panel.heading || title }}</h1><p>{{ panel.subheading }}</p>
    <img v-if="panel.assets?.illustration" :src="panel.assets.illustration.src" :alt="panel.assets.illustration.alt" :width="panel.assets.illustration.w" :height="panel.assets.illustration.h" class="auth-art" />
    <form @submit.prevent="notice = true"><label v-for="(field, index) in panel.fields" :key="index" :for="`auth-${index}`">{{ field.label }}<Input :id="`auth-${index}`" :type="field.type === 'password' ? 'password' : field.type === 'email' ? 'email' : 'text'" :placeholder="field.placeholder" /></label><Button type="primary" html-type="submit" block>{{ panel.submitLabel || '继续' }}</Button></form>
    <Alert v-if="notice" type="info" message="这是界面演示，尚未接入身份验证。" show-icon />
    <p class="muted">界面演示，不验证或发送登录信息。</p>
  </section></main>
</template>
<style scoped>
.auth-page{min-height:100vh;display:grid;place-items:center;padding:24px;background:var(--admin-bg)}.auth-panel{width:100%;max-width:460px;padding:32px;background:var(--admin-surface);border:1px solid var(--admin-border);border-radius:12px}.auth-icon{width:48px;height:48px}.auth-art{display:block;max-width:100%;height:auto;max-height:220px;object-fit:contain;margin:auto}form,label{display:flex;flex-direction:column;gap:12px}form{gap:20px;margin:24px 0}.muted{color:var(--admin-muted);font-size:12px}
</style>
