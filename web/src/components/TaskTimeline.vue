<script setup lang="ts">
import { computed } from 'vue'
import { ACTIVE_STATUSES, type TaskView, type TaskEvent } from '../api/client.js'
import { useNow } from '../composables/useNow.js'
const props = defineProps<{ task: TaskView; events: TaskEvent[]; truncated?: boolean }>()
const stages = [{ key: 'drafting', label: '页面结构' }, { key: 'validation', label: '结构校验' }, { key: 'writing', label: '生成代码' }, { key: 'images', label: '业务插画' }, { key: 'typecheck', label: '类型检查' }, { key: 'vite', label: '项目构建' }]
const labels: Record<string, string> = { queued: '排队等待', ready: '项目已就绪', ...Object.fromEntries(stages.map(s => [s.key, s.label])) }
const active = computed(() => ACTIVE_STATUSES.includes(props.task.status))
const { now } = useNow(() => active.value)
const current = computed(() => props.task.stage ?? (props.task.status === 'building' ? 'building' : props.task.status))
const elapsed = computed(() => Math.max(0, Math.floor(((props.task.finishedAt ?? now.value) - (props.task.stageStartedAt ?? props.task.createdAt)) / 1000)))
function state(key: string) {
  if (current.value === key) return props.task.status === 'failed' ? 'failed' : 'active'
  const event = [...props.events].reverse().find(e => e.stage === key)
  return event?.state === 'succeeded' ? 'done' : 'waiting'
}
</script>
<template>
  <section class="studio-timeline">
    <div class="studio-section-heading"><h2>生成进度</h2><span class="studio-muted">约 1.5 秒同步一次</span></div>
    <div class="studio-current" data-current-stage><span class="studio-live-dot" :class="{ 'is-active': active }" /><strong>{{ labels[current] ?? '处理中' }}</strong><span>{{ task.status === 'failed' ? '此阶段失败' : active ? `本阶段已等待 ${elapsed} 秒` : '处理结束' }}</span></div>
    <ol class="studio-stage-track"><li v-for="stage in stages" :key="stage.key" :class="state(stage.key)"><span class="studio-stage-node">{{ state(stage.key) === 'done' ? '✓' : '·' }}</span>{{ stage.label }}</li></ol>
    <p v-if="task.assetsTotal !== undefined" class="studio-muted">图片文件 {{ task.assetsDone ?? 0 }} / {{ task.assetsTotal }} 已就绪（包含缓存复用）</p>
    <details class="studio-event-log" open><summary>执行记录 <span>{{ events.length }}</span></summary><p v-if="truncated" class="studio-notice">较早的记录已截断。</p><p v-if="!events.length" class="studio-muted">等待任务开始；旧任务没有执行记录。</p><ol><li v-for="event in events" :key="event.seq"><time>{{ new Date(event.at).toLocaleTimeString() }}</time><span :class="{ 'studio-state-failed': event.state === 'failed' }">{{ labels[event.stage] ?? event.stage }} · {{ event.message }}</span></li></ol></details>
  </section>
</template>
