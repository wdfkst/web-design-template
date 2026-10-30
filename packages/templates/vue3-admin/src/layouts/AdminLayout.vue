<script setup lang="ts">
import { computed, ref } from 'vue'
import AdminIcon from '../components/admin/AdminIcon.vue'
import { Dropdown, Menu, MenuItem } from 'ant-design-vue'
import type { AdminPresentation } from '../data/admin-config'
import { RouterLink, RouterView, useRoute } from 'vue-router'

interface NavItem { id: string; label: string; icon?: string; route?: string; children?: NavItem[] }
defineProps<{ brand: string; navigation: NavItem[]; presentation?: AdminPresentation }>()
const route = useRoute()
const collapsed = ref(false)
const mobileOpen = ref(false)
const chromeless = computed(() => route.meta.chrome === false)
</script>

<template>
  <div class="admin-layout" :data-decoration="presentation?.decoration" :class="{ 'is-jelly': presentation?.appearance === 'jelly', 'is-collapsed': collapsed, 'is-chromeless': chromeless, 'is-topbar': presentation?.shell === 'topbar', 'is-personalized': !!presentation, 'soft-glass': presentation?.appearance === 'soft-glass' }">
    <template v-if="!chromeless">
      <button v-if="mobileOpen" class="nav-backdrop" aria-label="关闭导航" @click="mobileOpen = false" />
      <aside :class="{ 'is-open': mobileOpen }" @keydown.esc="mobileOpen = false">
        <div class="admin-brand"><span class="brand-mark">{{ brand.slice(0, 1) }}</span><span v-if="!collapsed">{{ brand }}</span></div>
        <nav aria-label="业务导航">
          <template v-for="item in navigation" :key="item.id">
            <template v-if="item.children">
              <div class="nav-group" v-if="!collapsed">{{ item.label }}</div>
              <RouterLink v-for="child in item.children" :key="child.id" :to="child.route!" :title="child.label" :aria-current="route.path === child.route ? 'page' : undefined" @click="mobileOpen = false"><AdminIcon :name="child.icon" /> <span v-if="!collapsed">{{ child.label }}</span><span v-else-if="!child.icon">{{ child.label.slice(0, 1) }}</span></RouterLink>
            </template>
            <RouterLink v-else :to="item.route!" :title="item.label" :aria-current="route.path === item.route ? 'page' : undefined" @click="mobileOpen = false"><AdminIcon :name="item.icon" /> <span v-if="!collapsed">{{ item.label }}</span><span v-else-if="!item.icon">{{ item.label.slice(0, 1) }}</span></RouterLink>
          </template>
        </nav>
      </aside>
    </template>
    <div class="admin-workspace">
      <header v-if="!chromeless" class="admin-topbar">
        <nav v-if="presentation?.shell === 'topbar'" class="horizontal-nav" aria-label="顶部业务导航">
          <strong>{{ brand }}</strong>
          <template v-for="item in navigation" :key="item.id">
            <Dropdown v-if="item.children" :trigger="['click']">
              <button :aria-label="item.label + '分组'" aria-haspopup="menu"><AdminIcon :name="item.icon" />{{ item.label }}</button>
              <template #overlay><Menu><MenuItem v-for="child in item.children" :key="child.id"><RouterLink :to="child.route!" :aria-current="route.path === child.route ? 'page' : undefined"><AdminIcon :name="child.icon" /> {{ child.label }}</RouterLink></MenuItem></Menu></template>
            </Dropdown>
            <RouterLink v-else :to="item.route!" :aria-current="route.path === item.route ? 'page' : undefined"><AdminIcon :name="item.icon" /> {{ item.label }}</RouterLink>
          </template>
        </nav>
        <button v-if="presentation?.shell !== 'topbar'" class="desktop-toggle" aria-label="折叠菜单" :aria-expanded="!collapsed" @click="collapsed = !collapsed">☰</button>
        <button class="mobile-toggle" aria-label="打开导航" :aria-expanded="mobileOpen" @click="mobileOpen = !mobileOpen">☰</button>
        <nav aria-label="面包屑" class="breadcrumbs"><span>工作空间</span><span>/</span><RouterLink v-if="route.meta.parentRoute" :to="String(route.meta.parentRoute)">返回列表</RouterLink><span>{{ route.meta.title }}</span></nav>
      </header>
      <main :class="{ 'admin-content': !chromeless }"><RouterView /></main>
    </div>
  </div>
</template>

<style scoped>
.admin-layout{display:grid;grid-template-columns:220px minmax(0,1fr);min-height:100vh}
.admin-layout.is-collapsed{grid-template-columns:72px minmax(0,1fr)}
.admin-layout.is-chromeless{grid-template-columns:minmax(0,1fr)}
aside{background:var(--admin-nav);color:var(--admin-nav-text);padding:20px 12px}
.admin-brand{display:flex;gap:10px;align-items:center;padding:4px 8px 28px;font-weight:600;font-size:17px}
.brand-mark{width:32px;height:32px;display:grid;place-items:center;border-radius:8px;background:var(--admin-primary);color:var(--admin-on-primary);flex-shrink:0}
nav a{display:block;padding:11px 14px;border-radius:6px;color:inherit;text-decoration:none;margin:4px 0}
nav a[aria-current=page]{background:var(--admin-primary);color:var(--admin-on-primary)}
.nav-group{font-size:12px;opacity:.75;padding:20px 14px 8px}
.admin-workspace{min-width:0}.admin-topbar{height:60px;background:var(--admin-surface);border-bottom:1px solid var(--admin-border);display:flex;align-items:center;gap:20px;padding:0 20px}
.admin-topbar button{border:0;background:transparent;color:var(--admin-text);font-size:20px;cursor:pointer;padding:6px}
.breadcrumbs{display:flex;gap:12px;align-items:center;font-size:12px;color:var(--admin-muted)}
.breadcrumbs a{padding:0}.admin-content{padding:24px;min-width:0}.mobile-toggle,.nav-backdrop{display:none}
@media(max-width:700px){.admin-layout,.admin-layout.is-collapsed{grid-template-columns:minmax(0,1fr)}aside{display:none}aside.is-open{display:block;position:fixed;inset:0 auto 0 0;width:220px;z-index:101}.nav-backdrop{display:block;position:fixed;inset:0;background:var(--admin-overlay);border:0;z-index:100}.desktop-toggle{display:none}.mobile-toggle{display:block}.admin-content{padding:16px}.admin-topbar{padding:0 16px}}
.is-topbar{grid-template-columns:minmax(0,1fr)}.is-topbar>aside{display:none}.horizontal-nav{display:flex;align-items:center;gap:18px;flex-wrap:wrap;min-width:0}.horizontal-nav strong{overflow-wrap:anywhere}.is-topbar .admin-topbar{height:auto;min-height:68px;flex-wrap:wrap;padding-block:12px}.is-topbar .breadcrumbs{margin-left:auto}
.is-personalized .admin-content{padding:var(--admin-space,24px)}.is-personalized :is(button,a):focus-visible{outline:3px solid var(--admin-primary);outline-offset:3px}.soft-glass{background:radial-gradient(ellipse at 85% 0%,color-mix(in srgb,var(--admin-glow-a) 15%,transparent),transparent 48%),radial-gradient(ellipse at 0% 80%,color-mix(in srgb,var(--admin-glow-b) 12%,transparent),transparent 50%),var(--admin-bg)}.soft-glass>aside,.soft-glass .admin-topbar{background:var(--admin-surface);border:1px solid var(--admin-border);box-shadow:var(--admin-shadow)}.soft-glass .admin-content{padding-top:28px}.soft-glass .brand-mark{border-radius:12px;box-shadow:inset 0 1px 1px #ffffff66,0 4px 12px #00000018}.soft-glass nav a[aria-current=page]{box-shadow:0 4px 12px #00000018}
@supports(backdrop-filter:blur(12px)){.soft-glass>aside,.soft-glass .admin-topbar{background:var(--admin-glass);backdrop-filter:blur(18px)}}
@media(max-width:700px){.horizontal-nav{display:none}.is-topbar>aside.is-open{display:block}.is-personalized .admin-content{padding:16px}.is-topbar .breadcrumbs{margin-left:0}}
@media(prefers-reduced-motion:reduce){.is-personalized *{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
</style>
