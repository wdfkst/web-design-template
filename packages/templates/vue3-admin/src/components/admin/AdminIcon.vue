<script setup lang="ts">
import { computed, type Component } from 'vue'
import { InboxOutlined, AppstoreOutlined, TeamOutlined, SettingOutlined, FileOutlined, DatabaseOutlined, BarChartOutlined, ImportOutlined, ExportOutlined, ToolOutlined } from '@ant-design/icons-vue'
const props = defineProps<{ name?: string }>()
const icons: Record<string, Component> = { box: InboxOutlined, grid: AppstoreOutlined, users: TeamOutlined, settings: SettingOutlined, file: FileOutlined, layers: DatabaseOutlined, chart: BarChartOutlined, in: ImportOutlined, out: ExportOutlined, tool: ToolOutlined }
const icon = computed(() => props.name && Object.hasOwn(icons, props.name) ? icons[props.name] : undefined)
</script>
<template><component v-if="icon" :is="icon" aria-hidden="true" /></template>
