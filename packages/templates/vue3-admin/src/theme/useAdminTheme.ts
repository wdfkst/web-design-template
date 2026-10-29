import { computed, onUnmounted, ref, watchEffect } from 'vue'
import { adminTheme, adminThemeMode, adminThemeModes } from './tokens'

export function useAdminTheme() {
  const media = adminThemeModes && adminThemeMode === 'both' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)') : undefined
  const dark = ref(adminThemeMode === 'dark' || (adminThemeMode === 'both' && media?.matches === true))
  const update = (event: MediaQueryListEvent) => { dark.value = event.matches }
  media?.addEventListener('change', update)
  const mode = computed(() => dark.value ? 'dark' as const : 'light' as const)
  const previous = document.documentElement.dataset.adminMode
  if (adminThemeModes) watchEffect(() => { document.documentElement.dataset.adminMode = mode.value })
  onUnmounted(() => {
    media?.removeEventListener('change', update)
    if (adminThemeModes) {
      if (previous === undefined) delete document.documentElement.dataset.adminMode
      else document.documentElement.dataset.adminMode = previous
    }
  })
  return { theme: computed(() => adminThemeModes?.[mode.value] ?? adminTheme), mode }
}
