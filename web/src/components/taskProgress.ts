import type { TaskView } from '../api/client.js'

/**
 * 视图逻辑放在这里而不是 SFC 里，是为了可测：web 的测试不挂载组件，纯函数才
 * 是能被断言的形状（同 `settingsForm.ts`、`exportRules.ts`）。列表页与详情页
 * 消费同一组函数，所以两屏不可能显示不一致。
 */

/** 0-3，对应模板里渲染的四个步骤：排队 / draft spec / 构建 / 完成。 */
export function currentStep(task: TaskView): number {
  switch (task.status) {
    case 'queued':
      return 0
    case 'drafting':
      return 1
    case 'building':
      return 2
    default:
      return 3
  }
}

export function stepStatus(task: TaskView): 'error' | 'process' {
  return task.status === 'failed' ? 'error' : 'process'
}

/**
 * `specAttempts` 现在是**渐进写**的：drafting 期间它表示「正在第几次」，成功后
 * 表示「第几次成功的」，同一个量。但失败之后它两样都不是 —— 每一次都可能没
 * 通过，所以措辞必须中性，不能声称通过。
 *
 * 不用「`assetsTotal` 在不在」来区分失败发生在哪个阶段：`buildTask` 在
 * maxAssets 超限时抛错，那时 spec 明明已经通过、`assetsTotal` 却仍不存在，
 * 那条推断会说谎。
 */
export function draftDescription(task: TaskView): string {
  if (task.specAttempts === undefined) return 'LLM 产出 spec'
  if (task.status === 'drafting' || task.status === 'failed') return `第 ${task.specAttempts} 次尝试`
  return `第 ${task.specAttempts} 次尝试通过`
}

/**
 * 图片进度。`done === total` 是「图片已跑完」的信号 —— 之后到 vite 启动只隔
 * 一次 assertExpectedAssetsExist（毫秒级），所以这里可以直接改口说 vite。
 *
 * 注意这条是**隐式约定**：哪天在图片与 vite 之间插进一个**长**步骤，这个派生
 * 就会说谎，届时必须补一个真正的阶段字段。
 */
export function buildDescription(task: TaskView): string {
  const { status, assetsDone, assetsTotal } = task
  if (assetsDone === undefined || assetsTotal === undefined) return '生成图片 + vite build'
  if (assetsDone < assetsTotal) return `已出 ${assetsDone}/${assetsTotal} 张图`
  return status === 'building' ? '图片完成，正在 vite 构建' : `已生成 ${assetsTotal} 张图`
}

/** 列表页那一列用的单行摘要：当前阶段 + 走到哪儿了。 */
export function progressLabel(task: TaskView): string {
  switch (task.status) {
    case 'queued':
      return '排队中'
    case 'drafting':
      return draftDescription(task)
    case 'building':
      return buildDescription(task)
    case 'ready':
      return '完成'
    default:
      // 失败：`assetsTotal` 在不在只用来挑**说哪句真话**（图片阶段的进度 vs 中性的
      // 尝试次数），两种措辞都不声称结果 —— 所以这条推断在这里是安全的。
      return task.assetsTotal === undefined ? draftDescription(task) : buildDescription(task)
  }
}

/**
 * 已耗时。起点是 `createdAt` 而不是记录上那个 `startedAt`：排队中的任务因此从
 * **提交时刻**起算，runner 接手时数字不会跳回 0；终态任务显示的数字也与改动前
 * 逐字节相同（现有实现就是 finishedAt - createdAt）。代价是排队时长也算在内 ——
 * 状态那一列已经写着「排队」了。
 */
export function elapsedLabel(task: TaskView, now: number): string {
  const end = task.finishedAt ?? now
  // 浏览器与服务的时钟可能不同步，先夹到 0，免得出现 '-3.2s'。
  const seconds = Math.max(0, end - task.createdAt) / 1000
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const whole = Math.floor(seconds)
  return `${Math.floor(whole / 60)}m${whole % 60}s`
}
