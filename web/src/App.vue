<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const selectedKeys = computed(() => {
  if (route.name === 'tasks') return ['tasks']
  if (route.name === 'settings') return ['settings']
  return ['detail']
})
</script>

<template>
  <a-layout style="min-height: 100vh">
    <a-layout-header style="display: flex; align-items: center; gap: 16px">
      <span style="color: #fff; font-weight: 600">AI 前端模板生成平台</span>
      <a-menu
        theme="dark"
        mode="horizontal"
        :selected-keys="selectedKeys"
        style="flex: 1; min-width: 0"
      >
        <a-menu-item key="tasks">
          <router-link to="/">任务</router-link>
        </a-menu-item>
        <a-menu-item key="settings">
          <router-link to="/settings">配置</router-link>
        </a-menu-item>
      </a-menu>
    </a-layout-header>
    <a-layout-content style="padding: 24px">
      <router-view />
    </a-layout-content>
  </a-layout>
</template>
