import { expect, it } from 'vitest'
import { createOpenAISpecDrafter } from '../openai-spec-drafter.js'
import { createOpenAIImageProvider } from '../openai-image-provider.js'

it('records the exact structure body before the response and completes after parsing', async () => {
  const events: any[] = []
  let resolve!: (response: Response) => void
  let sent: any
  const drafter = createOpenAISpecDrafter({ apiKey: 'test-secret', model: 'test',
    onRequest: input => { events.push(input); return status => events.push(status) },
    fetch: async (_url, init) => { sent = JSON.parse(String(init?.body)); return new Promise(done => { resolve = done }) },
  })
  const pending = drafter.draft({ description: 'inventory', attempt: 2, feedback: 'repair test-secret' })
  expect(events).toHaveLength(1)
  expect(events[0].messages[0]).toEqual(sent.messages[0])
  expect(events[0].messages[2].content).toContain('[REDACTED]')
  expect(JSON.stringify(events)).not.toContain('test-secret')
  resolve(new Response(JSON.stringify({ choices: [{ message: { content: '{}' } }] })))
  await pending
  expect(events[1]).toBe('succeeded')
})

it('records the final image prompt and reports rejected requests', async () => {
  const events: any[] = []
  let sent: any
  const provider = createOpenAIImageProvider({ apiKey: 'secret', model: 'test',
    onRequest: input => { events.push(input); return status => events.push(status) },
    fetch: async (_url, init) => { sent = JSON.parse(String(init?.body)); return new Response('', { status: 403 }) },
  })
  await expect(provider.generate({ assetId: 'hero', prompt: 'tray', negativePrompt: 'text', size: { w: 1024, h: 1024 }, transparent: false, seed: 1 })).rejects.toThrow('403')
  expect(events[0].prompt).toBe(sent.prompt)
  expect(events[0].prompt).toBe('tray\n\nAvoid: text')
  expect(events[1]).toBe('failed')
})
