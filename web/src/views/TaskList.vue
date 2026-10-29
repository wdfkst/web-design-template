<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useTaskList } from '../composables/useTaskList.js'
import { ACTIVE_STATUSES } from '../api/client.js'
import type { TaskStatus, TaskView } from '../api/client.js'
import { useNow } from '../composables/useNow.js'
import { elapsedLabel, progressLabel } from '../components/taskProgress.js'
import GenerationArtwork from '../components/GenerationArtwork.vue'

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
    if (created !== undefined) {
      description.value = ''
      await router.push(`/task/${created.id}`)
    }
  } finally {
    submitting.value = false
  }
}

function formatTime(value: number): string {
  return new Date(value).toLocaleString()
}
</script>

<template>
  <div class="studio-workspace"><div class="studio-canvas">
    <header class="studio-topbar"><div><h1>把下一份构想，做成项目</h1><p>描述业务、页面与风格，生成可运行的 Vue 3 项目。</p></div></header>
    <section class="studio-hero"><div class="studio-hero-content"><span class="studio-hero-label">构想工坊 / 新建项目</span><h2>不止是页面，更是起点。</h2><p>从业务后台到品牌网站，让结构、代码和插画围绕你的需求生成。</p><div class="studio-hero-tags"><span>多页项目</span><span>独立插画</span><span>源码导出</span></div></div><GenerationArtwork /></section>
    <section class="studio-composer"><div class="studio-section-heading"><h2>这次想搭建什么？</h2><span class="studio-muted">描述越具体，结果越贴近需求</span></div>
      <a-space direction="vertical" style="width: 100%">
        <a-textarea
          v-model:value="description"
          :rows="4"
          :maxlength="4000"
          show-count
          placeholder="例如：一个库存管理后台，包含商品列表、库存筛选、新增与编辑表单、业务概览。使用清爽的蓝绿色，搭配仓储主题插画。也可以描述品牌网站或其他多页项目。"
        />
        <div class="studio-composer-footer"><span class="studio-muted">生成期间可查看真实进度与完整请求提示词。</span><a-button type="primary" size="large" :disabled="!canSubmit" :loading="submitting" @click="onSubmit">开始生成</a-button></div>
      </a-space>
    </section>

    <a-alert v-if="error !== undefined" type="error" show-icon :message="error" />

    <section class="studio-content-panel"><div class="studio-section-heading"><h2>最近的项目</h2><span class="studio-muted">本次服务运行期间的任务</span></div><div class="studio-table-wrap">
      <a-table
        :columns="columns"
        :data-source="tasks"
        :loading="loading"
        row-key="id"
        size="middle"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <a-tag :color="statusColor(record.status)">{{ ({ queued: '排队中', drafting: '生成结构', building: '构建中', ready: '已就绪', failed: '失败' } as Record<string, string>)[record.status] }}</a-tag>
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
    </div></section>
  </div><aside class="studio-welcome-aside"><header class="studio-panel-heading"><span class="studio-symbol">✦</span><div><h2>你的生成搭档</h2><p>每一步，都有迹可循</p></div></header><div class="studio-guide-step"><span>1</span><div><h3>描述业务与页面</h3><p>说明谁来使用、需要哪些操作，以及你偏好的视觉风格。</p></div></div><div class="studio-guide-step"><span>2</span><div><h3>查看真实生成过程</h3><p>结构请求、校验、代码、图片和构建，展示实际执行阶段。</p></div></div><div class="studio-guide-step"><span>3</span><div><h3>预览并带走源码</h3><p>选择页面检查效果，导出源码继续开发，或下载构建产物。</p></div></div><div class="studio-inspector-footer">模型与接口在「模型与配置」中管理。<br>真实提示词会在任务详情中逐次记录。</div></aside></div>
</template>

<style scoped>
.task-list__elapsed {
  margin-left: 8px;
  color: var(--studio-muted);
}
</style>
