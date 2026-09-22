import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import HomePage from './pages/HomePage.vue'

/**
 * The generator rewrites this file, one entry per spec page. Hash history keeps
 * the built dist working inside a preview iframe with no server rewrites.
 */
const routes: RouteRecordRaw[] = [{ path: '/', name: 'home', component: HomePage }]

export const router = createRouter({ history: createWebHashHistory(), routes })
