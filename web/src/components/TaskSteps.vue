<script setup lang="ts">
import { computed } from 'vue'
import { ACTIVE_STATUSES } from '../api/client.js'
import type { TaskView } from '../api/client.js'
import { useNow } from '../composables/useNow.js'
import {
  buildDescription,
  currentStep,
  draftDescription,
  elapsedLabel,
  stepStatus,
} from './taskProgress.js'

const props = defineProps<{ task: TaskView }>()

// 终态任务不再走表：这是「无残留定时器」那条纪律在页面上的落点。
const { now } = useNow(() => ACTIVE_STATUSES.includes(props.task.status))

const step = computed(() => currentStep(props.task))
const status = computed(() => stepStatus(props.task))
const draftText = computed(() => draftDescription(props.task))
const buildText = computed(() => buildDescription(props.task))
const elapsed = computed(() => elapsedLabel(props.task, now.value))
</script>

<template>
  <a-space direction="vertical" size="middle" style="width: 100%">
    <a-steps :current="step" :status="status" size="small">
      <a-step title="排队" />
      <a-step title="draft spec" :description="draftText" />
      <a-step title="构建" :description="buildText" />
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
