const savedSettings = new Map<string, Record<string, unknown>>()
export function readSettings(formId: string): Record<string, unknown> { return { ...savedSettings.get(formId) } }
export function saveSettings(formId: string, values: Record<string, unknown>): void { savedSettings.set(formId, { ...values }) }
