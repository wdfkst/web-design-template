import { expect, it } from 'vitest'
import { redactRequestObserver } from '../request-redaction.js'

it('redacts both platform keys in nested snapshot fields before storage', () => {
  let stored: unknown
  const observer = redactRequestObserver(request => {
    stored = request
    return () => {}
  }, ['structure-key', 'image-key'])
  observer?.({ kind: 'structure', model: 'model', messages: [{ role: 'user', content: 'structure-key image-key' }], parameters: { response_format: { type: 'image-key' } } })
  expect(JSON.stringify(stored)).not.toContain('structure-key')
  expect(JSON.stringify(stored)).not.toContain('image-key')
  expect(JSON.stringify(stored)).toContain('[REDACTED]')
})
