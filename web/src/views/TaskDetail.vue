<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AssetPanel from '../components/AssetPanel.vue'
import ExportButtons from '../components/ExportButtons.vue'
import SpecTree from '../components/SpecTree.vue'
import TaskTimeline from '../components/TaskTimeline.vue'
import RequestInspector from '../components/RequestInspector.vue'
import GenerationArtwork from '../components/GenerationArtwork.vue'
import { useTaskPolling } from '../composables/useTaskPolling.js'
import { useTaskObservability } from '../composables/useTaskObservability.js'
import { ApiError, getSpec, type SpecView } from '../api/client.js'
const route = useRoute()
const router = useRouter()
const taskId = String(route.params.id)
const { task, error, notFound, start } = useTaskPolling(taskId)
const { data: trace, error: traceError, refresh } = useTaskObservability(taskId, task)
const spec = ref<SpecView>()
const specError = ref('')
const selectedRoute = ref('/')
const selectedAssetId = ref<string>()
const tab = ref<'preview' | 'structure' | 'settings'>('preview')
let disposed = false
let loadingSpec = false
onMounted(start)
onUnmounted(() => { disposed = true })
watch(task, async next => {
  if (!next || spec.value || loadingSpec || next.status === 'queued') return
  loadingSpec = true
  try {
    const result = await getSpec(taskId)
    if (!disposed) { spec.value = result; specError.value = '' }
  } catch (cause) {
    if (!disposed && (!(cause instanceof ApiError) || cause.status !== 409)) specError.value = '项目结构暂时无法加载'
  } finally { loadingSpec = false }
})
const previewSrc = computed(() => task.value?.status === 'ready' ? `/preview/${encodeURIComponent(taskId)}/#${selectedRoute.value}` : undefined)
const selectedAsset = computed(() => spec.value?.assets.find(asset => asset.id === selectedAssetId.value))
const title = computed(() => task.value?.status === 'ready' ? '你的项目，已准备就绪' : task.value?.status === 'failed' ? '生成遇到了问题' : task.value?.status === 'queued' ? '需求已收到，等待开始' : '正在把构想变成项目')
function onSelectPage(nextRoute: string) { selectedRoute.value = nextRoute; selectedAssetId.value = undefined; tab.value = 'preview' }
</script>
<template>
  <div class="studio-workspace">
    <div class="studio-canvas">
      <header class="studio-topbar"><div><h1>项目工作台</h1><p>{{ taskId }}</p></div><ExportButtons v-if="task" :task="task" @retried="router.push(`/task/${$event}`)" /></header>
      <a-result v-if="notFound" status="404" title="任务不存在" sub-title="任务记录保存在内存中，服务重启后不会保留。"><template #extra><a-button @click="router.push('/')">回到项目列表</a-button></template></a-result>
      <template v-else-if="task">
        <section class="studio-hero"><div class="studio-hero-content"><span class="studio-hero-label">需求 → 页面 → 可运行项目</span><h2>{{ title }}</h2><p class="studio-description">{{ task.description }}</p><div class="studio-hero-tags"><span>Vue 3</span><span>TypeScript</span><span>{{ task.status === 'ready' ? '可预览 · 可导出' : '真实执行记录' }}</span></div></div><GenerationArtwork /></section>
        <a-alert v-if="error" class="studio-inline-warning" type="warning" show-icon :message="error" />
        <a-alert v-if="task.error" class="studio-inline-warning" type="error" show-icon :message="task.error.message" :description="task.error.detail" />
        <TaskTimeline :task="task" :events="trace?.events ?? []" :truncated="trace?.eventsTruncated ?? false" />
        <section class="studio-content-panel">
          <div class="studio-tabs" role="tablist" aria-label="项目内容"><button role="tab" :aria-selected="tab === 'preview'" @click="tab = 'preview'">◈ 项目预览</button><button role="tab" :aria-selected="tab === 'structure'" @click="tab = 'structure'">▤ 页面与图片</button><button role="tab" :aria-selected="tab === 'settings'" @click="tab = 'settings'">⚙ 配置快照</button></div>
          <div v-if="tab === 'preview'">
            <label v-if="spec" class="studio-field" style="margin-bottom: 16px">预览页面<select v-model="selectedRoute" aria-label="预览页面"><option v-for="page in spec.pages" :key="page.route" :value="page.route">{{ page.name }} · {{ page.route }}</option></select></label>
            <iframe v-if="previewSrc" :key="previewSrc" :src="previewSrc" title="生成站点预览" class="studio-preview" />
            <div v-else class="studio-empty"><span class="studio-empty-icon">▧</span><h3>项目构建完成后开放预览</h3><p>上方查看当前阶段，右侧查看实际模型请求。</p></div>
          </div>
          <div v-else-if="tab === 'structure'">
            <p v-if="specError" class="studio-notice">{{ specError }}</p>
            <SpecTree v-if="spec" :spec="spec" @select-page="onSelectPage" @select-asset="selectedAssetId = $event" />
            <div v-else class="studio-empty">结构校验通过后，将显示页面与图片清单。</div>
            <AssetPanel v-if="selectedAsset" :task-id="taskId" :asset="selectedAsset" />
          </div>
          <div v-else class="studio-models"><template v-if="task.settings"><h3>本任务使用的模型配置</h3><p>这是创建任务时的配置，后续设置修改不会覆盖它。</p><dl><dt>结构模型</dt><dd>{{ task.settings.spec.model }}</dd><dt>结构接口</dt><dd>{{ task.settings.spec.baseUrl }}</dd><dt>JSON 格式</dt><dd>{{ task.settings.spec.sendResponseFormat ? '开启' : '关闭' }}</dd><dt>图片模型</dt><dd>{{ task.settings.image.model }}</dd><dt>图片接口</dt><dd>{{ task.settings.image.baseUrl }}</dd></dl></template><p v-else>此任务没有模型配置快照。</p></div>
        </section>
      </template>
      <a-skeleton v-else active />
    </div>
    <div class="studio-request-column"><div v-if="traceError" class="studio-inline-warning" role="alert">{{ traceError }} <button class="studio-text-button" @click="refresh">重试加载</button></div><RequestInspector :requests="trace?.requests ?? []" :truncated="trace?.requestsTruncated ?? false" /></div>
  </div>
</template>
