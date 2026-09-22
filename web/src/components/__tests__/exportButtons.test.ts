import { describe, expect, it } from 'vitest'
import { canExportDist, canExportSource } from '../exportRules.js'
import type { TaskStatus, TaskView } from '../../api/client.js'

function taskAt(status: TaskStatus): TaskView {
  return { id: 'abc', status, description: 'x', createdAt: 1 }
}

describe('canExportSource', () => {
  it('allows a ready task', () => {
    expect(canExportSource(taskAt('ready'))).toBe(true)
  })

  it('allows a failed task — the workspace survives and is how you debug it', () => {
    expect(canExportSource(taskAt('failed'))).toBe(true)
  })

  it('allows a task mid-build', () => {
    expect(canExportSource(taskAt('building'))).toBe(true)
  })

  it('refuses a queued task, whose workspace is not allocated yet', () => {
    expect(canExportSource(taskAt('queued'))).toBe(false)
  })

  it('refuses a task still drafting', () => {
    // allocate() runs only after drafting succeeds.
    expect(canExportSource(taskAt('drafting'))).toBe(false)
  })
})

describe('canExportDist', () => {
  it('allows only a ready task', () => {
    expect(canExportDist(taskAt('ready'))).toBe(true)
    expect(canExportDist(taskAt('failed'))).toBe(false)
    expect(canExportDist(taskAt('building'))).toBe(false)
    expect(canExportDist(taskAt('queued'))).toBe(false)
  })
})
