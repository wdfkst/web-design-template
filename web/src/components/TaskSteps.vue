<script setup lang="ts">
import { computed } from 'vue'
import type { TaskView } from '../api/client.js'

const props = defineProps<{ task: TaskView }>()

/**
 * Four steps against five server statuses: 'building' covers both image
 * generation and the vite build. providerCalls carries the sub-progress, which
 * beats inventing a status the runner would have to maintain.
 */
const currentStep = computed(() => {
  switch (props.task.status) {
    case 'queued':
      return 0
    case 'drafting':
      return 1
    case 'building':
      return 2
    default:
      return 3
  }
})

const status = computed(() => (props.task.status === 'failed' ? 'error' : 'process'))

const buildDescription = computed(() =>
  props.task.providerCalls === undefined
    ? '生成图片 + vite build'
    : `已生成 ${props.task.providerCalls} 张图`,
)

const draftDescription = computed(() =>
  props.task.specAttempts === undefined ? 'LLM 产出 spec' : `第 ${props.task.specAttempts} 次尝试通过`,
)

const elapsed = computed(() => {
  const { createdAt, finishedAt } = props.task
  if (finishedAt === undefined) return undefined
  return `${((finishedAt - createdAt) / 1000).toFixed(1)}s`
})
</script>

<template>
  <a-space direction="vertical" size="middle" style="width: 100%">
    <a-steps :current="currentStep" :status="status" size="small">
      <a-step title="排队" />
      <a-step title="draft spec" :description="draftDescription" />
      <a-step title="构建" :description="buildDescription" />
      <a-step title="完成" :description="elapsed" />
    </a-steps>

    <a-alert
      v-if="task.error !== undefined"
      type="error"
      show-icon
      :message="task.error.message"
      :description="task.error.detail"
    />
  </a-space>
</template>
