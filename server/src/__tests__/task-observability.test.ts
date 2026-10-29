import { describe, expect, it } from 'vitest'
import { TaskObservability } from '../task-observability.js'

describe('TaskObservability', () => {
  it('records a pending request immediately and preserves its isolated snapshot', () => {
    const trace = new TaskObservability()
    const messages = [{ role: 'user', content: 'inventory' }]
    const id = trace.startRequest({ kind: 'structure', model: 'test', messages })
    messages[0]!.content = 'changed'
    expect(trace.snapshot().requests[0]).toMatchObject({ id, status: 'pending', messages: [{ role: 'user', content: 'inventory' }] })
    trace.finishRequest(id, 'succeeded')
    expect(trace.snapshot().requests[0]).toMatchObject({ status: 'succeeded', finishedAt: expect.any(Number) })
    expect(new TaskObservability().snapshot().requests).toEqual([])
  })

  it('only stores allowed parameters and redacts known secrets throughout text', () => {
    const trace = new TaskObservability({ secrets: ['secret-value'] })
    trace.startRequest({ kind: 'image', model: 'secret-value', prompt: 'draw secret-value', parameters: { size: '1024x1024', authorization: 'secret-value', apiKey: 'other-secret' } })
    const json = JSON.stringify(trace.snapshot())
    expect(json).not.toContain('secret-value')
    expect(json).not.toContain('other-secret')
    expect(json).not.toContain('authorization')
    expect(trace.snapshot().requests[0]!.parameters).toEqual({ size: '1024x1024' })
  })

  it('retains monotonic events and explicitly marks retention limits', () => {
    const trace = new TaskObservability({ maxEvents: 2, maxRequests: 1, maxRequestChars: 100 })
    trace.event('writing', 'started', 'writing')
    trace.event('images', 'started', 'images')
    trace.event('typecheck', 'started', 'typecheck')
    expect(trace.snapshot().events.map(event => event.seq)).toEqual([2, 3])
    expect(trace.snapshot().eventsTruncated).toBe(true)
    trace.startRequest({ kind: 'image', model: 'test', prompt: 'x'.repeat(101) })
    expect(trace.snapshot().requests[0]).toMatchObject({ omittedReason: 'request-too-large' })
    expect(trace.snapshot().requests[0]!.prompt).toBeUndefined()
    trace.startRequest({ kind: 'image', model: 'test', prompt: 'small' })
    expect(trace.snapshot().requests).toHaveLength(1)
    expect(trace.snapshot().requestsTruncated).toBe(true)
  })
})
