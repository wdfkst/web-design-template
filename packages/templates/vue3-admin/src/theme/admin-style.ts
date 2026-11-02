export type AdminStyleId = 'soft' | 'warm' | 'mist' | 'porcelain' | 'aurora'
export interface AdminStyleReference { id: AdminStyleId; version: number }
export interface AdminStyleLayout {
  shellVariant: 'icon-sidebar' | 'expanded-sidebar' | 'top-nav' | 'wide-sidebar' | 'top-nav-context'
  workbenchLayout: 'welcome-grid' | 'main-aside' | 'sectioned' | 'staggered' | 'main-context'
  skin: AdminStyleId
}
