import { expect, it } from 'vitest'
import { formatAdminValue } from '../data/format'

it('formats dates and currency and hides missing or non-finite values', () => {
  expect(formatAdminValue('2026-10-28', 'date')).toBe('2026-10-28')
  expect(formatAdminValue('not-a-date', 'date')).toBe('—')
  expect(formatAdminValue(1250, 'currency')).toContain('1,250.00')
  for (const value of [undefined, null, '', NaN, Infinity]) expect(formatAdminValue(value)).toBe('—')
  expect(formatAdminValue(false)).toBe('否')
  expect(formatAdminValue(true)).toBe('是')
})
