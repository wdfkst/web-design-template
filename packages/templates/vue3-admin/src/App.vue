<script setup lang="ts">
import { ConfigProvider } from 'ant-design-vue'
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import AdminLayout from './layouts/AdminLayout.vue'
import { brand, navigation } from './navigation'
import { adminTheme } from './theme/tokens'
</script>
<template><ConfigProvider :theme="adminTheme" :locale="zhCN"><AdminLayout :brand="brand" :navigation="navigation" /></ConfigProvider></template>
