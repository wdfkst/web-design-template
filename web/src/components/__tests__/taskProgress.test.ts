import { describe, expect, it } from 'vitest'
import type { TaskView } from '../../api/client.js'
import {
  buildDescription,
  currentStep,
  draftDescription,
  elapsedLabel,
  progressLabel,
  stepStatus,
} from '../taskProgress.js'

function task(overrides: Partial<TaskView> = {}): TaskView {
  return { id: 'abc', status: 'queued', description: 'x', createdAt: 1_000, ...overrides }
}

describe('currentStep / stepStatus', () => {
  it.each([
    { status: 'queued' as const, step: 0 },
    { status: 'drafting' as const, step: 1 },
    { status: 'building' as const, step: 2 },
    { status: 'ready' as const, step: 3 },
    { status: 'failed' as const, step: 3 },
  ])('maps $status to step $step', ({ status, step }) => {
    expect(currentStep(task({ status }))).toBe(step)
  })

  it('marks only failed as an error', () => {
    expect(stepStatus(task({ status: 'failed' }))).toBe('error')
    expect(stepStatus(task({ status: 'ready' }))).toBe('process')
    expect(stepStatus(task({ status: 'drafting' }))).toBe('process')
  })
})

describe('draftDescription', () => {
  it('says which attempt is running while drafting', () => {
    expect(draftDescription(task({ status: 'drafting', specAttempts: 2 }))).toBe('第 2 次尝试')
  })

  it('says the attempt passed once the spec is in', () => {
    expect(draftDescription(task({ status: 'building', specAttempts: 1 }))).toBe('第 1 次尝试通过')
    expect(draftDescription(task({ status: 'ready', specAttempts: 3 }))).toBe('第 3 次尝试通过')
  })

  it('stays neutral after a failure instead of claiming the attempt passed', () => {
    // The regression this guards: progressive writing leaves specAttempts set on a
    // task whose every attempt failed, and the old wording claimed '通过'.
    expect(draftDescription(task({ status: 'failed', specAttempts: 3 }))).toBe('第 3 次尝试')
  })

  it('falls back when no attempt has been reported', () => {
    expect(draftDescription(task({ status: 'queued' }))).toBe('LLM 产出 spec')
  })
})

describe('buildDescription', () => {
  it('counts up while images are still coming', () => {
    expect(buildDescription(task({ status: 'building', assetsDone: 2, assetsTotal: 5 }))).toBe(
      '已出 2/5 张图',
    )
  })

  it('names the vite build once every image has landed', () => {
    expect(buildDescription(task({ status: 'building', assetsDone: 5, assetsTotal: 5 }))).toBe(
      '图片完成，正在 vite 构建',
    )
  })

  it('treats an image-free spec as immediately ready to build', () => {
    expect(buildDescription(task({ status: 'building', assetsDone: 0, assetsTotal: 0 }))).toBe(
      '图片完成，正在 vite 构建',
    )
  })

  it('falls back before the first progress event arrives', () => {
    expect(buildDescription(task({ status: 'building' }))).toBe('生成图片 + vite build')
  })

  it('keeps the partial count on a failed task', () => {
    expect(buildDescription(task({ status: 'failed', assetsDone: 1, assetsTotal: 5 }))).toBe(
      '已出 1/5 张图',
    )
  })

  it('reports the manifest size once the images are done', () => {
    expect(buildDescription(task({ status: 'ready', assetsDone: 5, assetsTotal: 5 }))).toBe(
      '已生成 5 张图',
    )
  })
})

describe('progressLabel', () => {
  it('names the queue before the runner picks the task up', () => {
    expect(progressLabel(task({ status: 'queued' }))).toBe('排队中')
  })

  it('follows the stage', () => {
    expect(progressLabel(task({ status: 'drafting', specAttempts: 1 }))).toBe('第 1 次尝试')
    expect(progressLabel(task({ status: 'building', assetsDone: 1, assetsTotal: 5 }))).toBe(
      '已出 1/5 张图',
    )
    expect(progressLabel(task({ status: 'ready', specAttempts: 1 }))).toBe('完成')
  })

  it('picks the stage a failure happened in without claiming the draft passed', () => {
    expect(progressLabel(task({ status: 'failed', specAttempts: 2 }))).toBe('第 2 次尝试')
    expect(progressLabel(task({ status: 'failed', assetsDone: 1, assetsTotal: 5 }))).toBe(
      '已出 1/5 张图',
    )
  })
})

describe('elapsedLabel', () => {
  it('uses one decimal below a minute', () => {
    expect(elapsedLabel(task({ createdAt: 0, finishedAt: 43_200 }), 99_999)).toBe('43.2s')
    expect(elapsedLabel(task({ createdAt: 0, finishedAt: 59_940 }), 99_999)).toBe('59.9s')
  })

  it('switches to minutes at the boundary', () => {
    expect(elapsedLabel(task({ createdAt: 0, finishedAt: 60_000 }), 99_999)).toBe('1m0s')
    expect(elapsedLabel(task({ createdAt: 0, finishedAt: 297_300 }), 99_999)).toBe('4m57s')
  })

  it('ticks off the clock while the task is still running', () => {
    expect(elapsedLabel(task({ createdAt: 1_000 }), 101_000)).toBe('1m40s')
  })

  it('freezes on the recorded finish', () => {
    // `now` is far past finishedAt; the label must not move.
    expect(elapsedLabel(task({ createdAt: 0, finishedAt: 5_000 }), 900_000)).toBe('5.0s')
  })

  it('never goes negative when the clocks disagree', () => {
    expect(elapsedLabel(task({ createdAt: 10_000 }), 4_000)).toBe('0.0s')
  })
})
