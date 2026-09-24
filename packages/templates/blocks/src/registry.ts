import type { BlockDefinition, SlotSpec } from './slot.js'
import { AuthPanel } from './blocks/auth-panel.slots.js'
import { NavBarSimple } from './blocks/nav-bar-simple.slots.js'
import { HeroSplit } from './blocks/hero-split.slots.js'
import { HeroCentered } from './blocks/hero-centered.slots.js'
import { FeatureTriad } from './blocks/feature-triad.slots.js'
import { CtaBanner } from './blocks/cta-banner.slots.js'
import { DataTable } from './blocks/data-table.slots.js'
import { FooterSimple } from './blocks/footer-simple.slots.js'
import { FormPanel } from './blocks/form-panel.slots.js'
import { EmptyStatePanel } from './blocks/empty-state-panel.slots.js'
import { FAQAccordion } from './blocks/faq-accordion.slots.js'
import { StatsBand } from './blocks/stats-band.slots.js'
import { StatsGrid } from './blocks/stats-grid.slots.js'
import { LogoStrip } from './blocks/logo-strip.slots.js'
import { PricingCard } from './blocks/pricing-card.slots.js'
import { TestimonialRow } from './blocks/testimonial-row.slots.js'

const definitions: readonly BlockDefinition[] = [
  AuthPanel,
  CtaBanner,
  DataTable,
  EmptyStatePanel,
  FAQAccordion,
  FeatureTriad,
  FooterSimple,
  FormPanel,
  HeroCentered,
  HeroSplit,
  LogoStrip,
  NavBarSimple,
  PricingCard,
  StatsBand,
  StatsGrid,
  TestimonialRow,
]

export const BLOCK_REGISTRY: ReadonlyMap<string, BlockDefinition> = new Map(
  definitions.map((definition) => [definition.component, definition]),
)

export function getBlockDefinition(component: string): BlockDefinition | undefined {
  return BLOCK_REGISTRY.get(component)
}

export function listBlockComponents(): string[] {
  return [...BLOCK_REGISTRY.keys()].sort()
}

/** Advisory helper for prompt construction: which blocks suit a page type. */
export function blocksForPageType(pageType: string): BlockDefinition[] {
  return [...BLOCK_REGISTRY.values()].filter((d) => d.pageTypes.includes(pageType))
}

export function getSlot(component: string, slotName: string): SlotSpec | undefined {
  return getBlockDefinition(component)?.slots.find((slot) => slot.name === slotName)
}

export {
  AuthPanel,
  CtaBanner,
  DataTable,
  EmptyStatePanel,
  FAQAccordion,
  FeatureTriad,
  FooterSimple,
  FormPanel,
  HeroCentered,
  HeroSplit,
  LogoStrip,
  NavBarSimple,
  PricingCard,
  StatsBand,
  StatsGrid,
  TestimonialRow,
}
