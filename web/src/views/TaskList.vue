<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useTaskList } from '../composables/useTaskList.js'
import { ACTIVE_STATUSES } from '../api/client.js'
import type { TaskStatus, TaskView } from '../api/client.js'
import { useNow } from '../composables/useNow.js'
import { elapsedLabel, progressLabel } from '../components/taskProgress.js'

const router = useRouter()
const { tasks, loading, error, start, submit } = useTaskList()
const description = ref('')
const submitting = ref(false)

// 全表 N 行共用这一个时钟；全是终态任务时它不推进，也就不会重渲染。
const { now } = useNow(() => tasks.value.some((task) => ACTIVE_STATUSES.includes(task.status)))

function progressText(task: TaskView): string {
  return progressLabel(task)
}

function elapsedText(task: TaskView): string {
  return elapsedLabel(task, now.value)
}

onMounted(start)

const STATUS_COLOR: Record<TaskStatus, string> = {
  queued: 'default',
  drafting: 'processing',
  building: 'processing',
  ready: 'success',
  failed: 'error',
}

// The table's bodyCell slot types `record` as `any`, so narrow here rather than
// indexing STATUS_COLOR with an unchecked value in the template.
function statusColor(status: TaskStatus): string {
  return STATUS_COLOR[status] ?? 'default'
}

const columns = [
  { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
  { title: '状态', dataIndex: 'status', key: 'status', width: 120 },
  { title: '进度', key: 'progress', width: 220 },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 180 },
  { title: '图片调用', dataIndex: 'providerCalls', key: 'providerCalls', width: 100 },
  { title: '', key: 'actions', width: 100 },
]

const canSubmit = computed(() => description.value.trim() !== '' && !submitting.value)

async function onSubmit(): Promise<void> {
  submitting.value = true
  try {
    const created = await submit(description.value.trim())
    if (created !== undefined) description.value = ''
  } finally {
    submitting.value = false
  }
}

function formatTime(value: number): string {
  return new Date(value).toLocaleString()
}
</script>

<template>
  <a-space direction="vertical" size="large" style="width: 100%">
    <a-card title="新建任务">
      <a-space direction="vertical" style="width: 100%">
        <a-textarea
          v-model:value="description"
          :rows="4"
          :maxlength="4000"
          show-count
          placeholder="用自然语言描述要生成的前端项目，例如：一个 SaaS 产品落地页，含英雄区、三栏特性、价格表和页脚"
        />
        <a-button type="primary" :disabled="!canSubmit" :loading="submitting" @click="onSubmit">
          生成
        </a-button>
      </a-space>
    </a-card>

    <a-alert v-if="error !== undefined" type="error" show-icon :message="error" />

    <a-card title="历史任务">
      <a-table
        :columns="columns"
        :data-source="tasks"
        :loading="loading"
        row-key="id"
        size="middle"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <a-tag :color="statusColor(record.status)">{{ record.status }}</a-tag>
          </template>
          <template v-else-if="column.key === 'progress'">
            {{ progressText(record) }}
            <span class="task-list__elapsed">{{ elapsedText(record) }}</span>
          </template>
          <template v-else-if="column.key === 'createdAt'">
            {{ formatTime(record.createdAt) }}
          </template>
          <template v-else-if="column.key === 'actions'">
            <a @click="router.push(`/task/${record.id}`)">查看</a>
          </template>
        </template>
      </a-table>
    </a-card>
  </a-space>
</template>

<style scoped>
.task-list__elapsed {
  margin-left: 8px;
  color: rgba(0, 0, 0, 0.45);
}
</style>
