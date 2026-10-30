import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const css = readFileSync('src/theme/jelly.css', 'utf8')

function reducedStyle(element: Element, property: string) {
  const style = document.createElement('style')
  style.textContent = css
  document.head.append(style)
  try {
    const media = Array.from(style.sheet!.cssRules).filter(rule => rule.type === 4 && (rule as CSSMediaRule).media.mediaText.includes('prefers-reduced-motion')) as CSSMediaRule[]
    return media.flatMap(rule => Array.from(rule.cssRules) as CSSStyleRule[])
      .filter(rule => rule.selectorText.split(',').some(selector => !selector.includes('::') && element.matches(selector.trim())))
      .map(rule => rule.style.getPropertyValue(property)).filter(Boolean).at(-1)
  } finally {
    style.remove()
  }
}

it('disables jelly card and button motion without resetting drawer or modal transforms', () => {
  const layout = document.createElement('div')
  layout.className = 'is-jelly'
  layout.innerHTML = '<article class="jelly-card"></article><button class="ant-btn"></button><div class="ant-drawer-content-wrapper"></div><div class="ant-modal"></div><span class="anticon-loading"></span>'
  for (const selector of ['.jelly-card', '.ant-btn']) {
    expect(reducedStyle(layout.querySelector(selector)!, 'transform')).toBe('none')
    expect(reducedStyle(layout.querySelector(selector)!, 'transition')).toBe('none')
  }
  for (const selector of ['.ant-drawer-content-wrapper', '.ant-modal', '.anticon-loading']) {
    expect(reducedStyle(layout.querySelector(selector)!, 'transform')).toBeUndefined()
    expect(reducedStyle(layout.querySelector(selector)!, 'animation')).toBeUndefined()
  }
})
