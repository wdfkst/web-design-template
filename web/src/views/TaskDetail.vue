<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AssetPanel from '../components/AssetPanel.vue'
import ExportButtons from '../components/ExportButtons.vue'
import SpecTree from '../components/SpecTree.vue'
import TaskSteps from '../components/TaskSteps.vue'
import { useTaskPolling } from '../composables/useTaskPolling.js'
import { ApiError, getSpec, type SpecView } from '../api/client.js'

const route = useRoute()
const router = useRouter()
const taskId = String(route.params.id)

const { task, error, notFound, start } = useTaskPolling(taskId)
const spec = ref<SpecView | undefined>(undefined)
const selectedRoute = ref('/')
const selectedAssetId = ref<string | undefined>(undefined)
const collapsed = ref(false)

onMounted(start)

/**
 * The spec appears partway through the run, so fetch it on the first status that
 * can have one. 409 simply means "not yet" — keep the previous value and let the
 * next status change try again.
 */
watch(
  () => task.value?.status,
  async (status) => {
    if (status === undefined || spec.value !== undefined) return
    if (status === 'queued') return
    try {
      spec.value = await getSpec(taskId)
    } catch (cause) {
      if (!(cause instanceof ApiError) || cause.status !== 409) throw cause
    }
  },
  { immediate: true },
)

const previewSrc = computed(() => {
  if (task.value?.status !== 'ready') return undefined
  // Generated projects use hash history with base './', so the route is a hash.
  return `/preview/${taskId}/#${selectedRoute.value}`
})

const selectedAsset = computed(() =>
  spec.value?.assets.find((asset) => asset.id === selectedAssetId.value),
)

function onSelectPage(nextRoute: string): void {
  selectedRoute.value = nextRoute
  selectedAssetId.value = undefined
}
</script>
<template>
  <a-space direction="vertical" size="large" style="width: 100%">
    <a-page-header title="任务详情" :sub-title="taskId" @back="router.push('/')">
      <template #extra>
        <ExportButtons
          v-if="task !== undefined"
          :task="task"
          @retried="router.push(`/task/${$event}`)"
        />
      </template>
    </a-page-header>

    <a-result
      v-if="notFound"
      status="404"
      title="任务不存在"
      sub-title="任务表是内存态，服务重启后历史任务不会保留。"
    >
      <template #extra>
        <a-button type="primary" @click="router.push('/')">回到列表</a-button>
      </template>
    </a-result>

    <template v-else-if="task !== undefined">
      <a-card>
        <TaskSteps :task="task" />
      </a-card>

      <!--
        Optional on purpose: the snapshot is written when a task is created, so
        tasks that predate the settings store (or a restart) simply have none.
      -->
      <a-card v-if="task.settings !== undefined" title="本任务使用的模型配置" size="small">
        <a-descriptions :column="2" size="small">
          <a-descriptions-item label="文案接口">
            {{ task.settings.spec.baseUrl }}
          </a-descriptions-item>
          <a-descriptions-item label="文案模型">
            {{ task.settings.spec.model }}
          </a-descriptions-item>
          <a-descriptions-item label="JSON 响应格式">
            {{ task.settings.spec.sendResponseFormat ? '开' : '关' }}
          </a-descriptions-item>
          <a-descriptions-item label="图片接口">
            {{ task.settings.image.baseUrl }}
          </a-descriptions-item>
          <a-descriptions-item label="图片模型">
            {{ task.settings.image.model }}
          </a-descriptions-item>
        </a-descriptions>
      </a-card>

      <a-alert v-if="error !== undefined" type="warning" show-icon :message="error" />

      <a-layout style="background: transparent">
        <a-layout-sider
          v-model:collapsed="collapsed"
          :width="280"
          collapsible
          breakpoint="lg"
          theme="light"
          style="border-radius: 8px; margin-right: 16px"
        >
          <div v-show="!collapsed" style="padding: 12px">
            <SpecTree
              v-if="spec !== undefined"
              :spec="spec"
              @select-page="onSelectPage"
              @select-asset="selectedAssetId = $event"
            />
            <a-empty v-else description="spec 产出后显示结构" />
          </div>
        </a-layout-sider>

        <a-layout-content>
          <a-space direction="vertical" size="middle" style="width: 100%">
            <AssetPanel
              v-if="selectedAsset !== undefined"
              :task-id="taskId"
              :asset="selectedAsset"
            />

            <a-card title="预览" :body-style="{ padding: 0 }">
              <template #extra>
                <a-typography-text type="secondary">{{ selectedRoute }}</a-typography-text>
              </template>
              <!--
                Keyed on the route so switching pages remounts the iframe. Whether
                changing only the hash reloads is inconsistent across browsers, and
                dist is local static files, so a reload costs tens of milliseconds.
              -->
              <iframe
                v-if="previewSrc !== undefined"
                :key="previewSrc"
                :src="previewSrc"
                title="生成站点预览"
                style="width: 100%; height: 600px; border: 0; display: block"
              />
              <a-empty v-else description="构建完成后这里显示预览" style="padding: 48px" />
            </a-card>
          </a-space>
        </a-layout-content>
      </a-layout>

    </template>

    <a-skeleton v-else active />
  </a-space>
</template>
