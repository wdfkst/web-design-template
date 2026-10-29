<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { theme } from 'ant-design-vue'
import './styles/workspace.css'
const route = useRoute()
const media = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : undefined
const dark = ref(media?.matches ?? false)
const updateTheme = (event: MediaQueryListEvent) => { dark.value = event.matches }
media?.addEventListener('change', updateTheme)
onUnmounted(() => media?.removeEventListener('change', updateTheme))
const config = computed(() => ({ algorithm: dark.value ? theme.darkAlgorithm : theme.defaultAlgorithm, token: { colorPrimary: dark.value ? '#91a7ff' : '#294ff2', borderRadius: 10, fontFamily: '"Segoe UI", "Microsoft YaHei", sans-serif' } }))
</script>
<template>
  <a-config-provider :theme="config">
    <div class="studio-shell">
      <aside class="studio-sidebar">
        <router-link to="/" class="studio-brand"><span class="studio-brand-icon" aria-hidden="true">〈/〉</span><span>构想工坊<small>Vue 3 生成工作台</small></span></router-link>
        <router-link to="/" class="studio-create">＋ 新建项目</router-link>
        <nav aria-label="主导航"><router-link to="/" :class="{ selected: route.path !== '/settings' }"><span aria-hidden="true">▦</span> 项目工作台</router-link><router-link to="/settings" :class="{ selected: route.path === '/settings' }"><span aria-hidden="true">⚙</span> 模型与配置</router-link></nav>
        <div class="studio-sidebar-note"><div class="studio-file-art" aria-hidden="true"><i/><i/><i>Vue</i></div><h3>从需求到项目</h3><p>页面结构、业务插画与可运行代码，在同一个工作台完成。</p><div class="studio-tech-tags"><span>Vue 3</span><span>TypeScript</span></div></div>
        <footer class="studio-sidebar-footer"><span class="studio-live-dot"/> 本地工作空间<p>任务记录随服务重启清空</p></footer>
      </aside>
      <main class="studio-main"><router-view v-slot="{ Component }"><component :is="Component" :key="route.path" /></router-view></main>
    </div>
  </a-config-provider>
</template>
