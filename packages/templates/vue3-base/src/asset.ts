/**
 * What a block receives for one image slot. `src` and `alt` come from the
 * manifest; `w`/`h` are the sidecar's renderSize, written into the markup so
 * the browser reserves the right box before the image loads.
 */
export interface SlotAsset {
  src: string
  alt: string
  w: number
  h: number
}

export type SlotAssets = Record<string, SlotAsset>
