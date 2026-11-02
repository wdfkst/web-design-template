<script setup lang="ts">
import type { WorkbenchModule } from '../../data/admin-config'
import type { WorkbenchResult } from '../../data/workbench'
import type { FieldModel } from '../../data/types'
import type { AdminStyleLayout } from '../../theme/admin-style'
import AdminWorkbenchModule from './AdminWorkbenchModule.vue'
defineProps<{ layout: AdminStyleLayout['workbenchLayout']; modules: { module: WorkbenchModule; result: WorkbenchResult; model: Record<string, FieldModel> }[] }>()
</script>
<template>
  <div class="style-workbench" :class="`layout-${layout}`">
    <div v-if="layout === 'welcome-grid'" class="style-card-grid"><AdminWorkbenchModule v-for="item in modules" :key="item.module.id" v-bind="item" /></div>
    <template v-else-if="layout === 'sectioned'">
      <section v-for="item in modules" :key="item.module.id" :aria-label="item.module.title"><AdminWorkbenchModule v-bind="item" /></section>
    </template>
    <template v-else>
      <div class="style-primary"><AdminWorkbenchModule v-if="modules[0]" v-bind="modules[0]" /></div>
      <div v-if="layout === 'staggered' && modules.length > 1" class="style-secondary"><AdminWorkbenchModule v-for="item in modules.slice(1)" :key="item.module.id" v-bind="item" /></div>
      <aside v-else-if="modules.length > 1" class="style-context" :aria-label="layout === 'main-context' ? '工作上下文' : '辅助业务模块'"><AdminWorkbenchModule v-for="item in modules.slice(1)" :key="item.module.id" v-bind="item" /></aside>
    </template>
  </div>
</template>
<style scoped>
.style-workbench,.style-card-grid,.style-secondary,.style-context{display:grid;gap:20px;min-width:0;align-items:start}.style-primary,.style-workbench>section{min-width:0}.style-card-grid{grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr))}.layout-main-aside:has(.style-context){grid-template-columns:minmax(0,2fr) minmax(260px,1fr)}.layout-main-context:has(.style-context){grid-template-columns:minmax(0,1fr) 300px}.layout-staggered:has(.style-secondary){grid-template-columns:minmax(0,1.4fr) minmax(0,1fr)}.layout-staggered .style-secondary{padding-top:40px}.layout-sectioned{gap:28px}.layout-sectioned>section+section{padding-top:24px;border-top:1px solid var(--admin-border)}
@media(max-width:1000px){.layout-main-aside:has(.style-context),.layout-main-context:has(.style-context),.layout-staggered:has(.style-secondary){grid-template-columns:minmax(0,1fr)}.layout-staggered .style-secondary{padding-top:0}}
</style>
