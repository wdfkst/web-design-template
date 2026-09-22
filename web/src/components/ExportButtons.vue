<script setup lang="ts">
import { computed, ref } from 'vue'
import { message } from 'ant-design-vue'
import { ApiError, exportUrl, retryTask, type TaskView } from '../api/client.js'
import { canExportDist, canExportSource } from './exportRules.js'

const props = defineProps<{ task: TaskView }>()
const emit = defineEmits<{ retried: [newTaskId: string] }>()

const retrying = ref(false)

const sourceHref = computed(() => exportUrl(props.task.id, 'source'))
const distHref = computed(() => exportUrl(props.task.id, 'dist'))
const sourceEnabled = computed(() => canExportSource(props.task))
const distEnabled = computed(() => canExportDist(props.task))

async function onRetry(): Promise<void> {
  retrying.value = true
  try {
    const created = await retryTask(props.task.id)
    message.success('已新建重试任务')
    emit('retried', created.id)
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 503) {
      message.warning('队列已满，稍后再试')
    } else {
      message.error(cause instanceof ApiError ? cause.message : '重试失败')
    }
  } finally {
    retrying.value = false
  }
}
</script>

<template>
  <a-space>
    <a-button :disabled="!sourceEnabled" :href="sourceEnabled ? sourceHref : undefined" download>
      导出源码
    </a-button>
    <a-button :disabled="!distEnabled" :href="distEnabled ? distHref : undefined" download>
      导出 dist
    </a-button>
    <a-button type="primary" :loading="retrying" @click="onRetry">重试</a-button>
  </a-space>
</template>
