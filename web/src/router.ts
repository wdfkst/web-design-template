import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'tasks', component: () => import('./views/TaskList.vue') },
  { path: '/task/:id', name: 'task-detail', component: () => import('./views/TaskDetail.vue') },
  { path: '/settings', name: 'settings', component: () => import('./views/SettingsView.vue') },
]

export const router = createRouter({ history: createWebHistory(), routes })
