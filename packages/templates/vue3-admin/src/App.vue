<script setup lang="ts">
import { ConfigProvider } from 'ant-design-vue'
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import AdminLayout from './layouts/AdminLayout.vue'
import { brand, navigation } from './navigation'
import { useAdminTheme } from './theme/useAdminTheme'
import { presentation } from './theme/presentation'
const { theme: adminTheme } = useAdminTheme()
</script>
<template><ConfigProvider :theme="adminTheme" :locale="zhCN"><AdminLayout :brand="brand" :navigation="navigation" :presentation="presentation" /></ConfigProvider></template>
