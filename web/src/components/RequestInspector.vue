<script setup lang="ts">
import { computed, ref } from 'vue'
import type { TaskRequest } from '../api/client.js'
const props = defineProps<{ requests: TaskRequest[]; truncated?: boolean }>()
const kind = ref<'structure' | 'image'>('structure')
const selectedId = ref('')
const copyMessage = ref('')
const requests = computed(() => props.requests.filter(item => item.kind === kind.value))
const selected = computed(() => requests.value.find(item => item.id === selectedId.value) ?? requests.value.at(-1))
const content = computed(() => selected.value?.messages?.map(message => `[${message.role}]\n${message.content}`).join('\n\n') ?? selected.value?.prompt ?? '')
async function copy() {
  try { await navigator.clipboard.writeText(content.value); copyMessage.value = '已复制' }
  catch { copyMessage.value = '复制不可用，请在下方选中文本复制' }
}
</script>
<template>
  <aside class="studio-inspector">
    <header class="studio-panel-heading"><span class="studio-symbol">{ }</span><div><h2>请求检查器</h2><p>查看实际发送的提示词</p></div></header>
    <div class="studio-segment" aria-label="请求类型">
      <button data-kind="structure" :aria-pressed="kind === 'structure'" @click="kind = 'structure'">页面结构 <span>{{ props.requests.filter(r => r.kind === 'structure').length }}</span></button>
      <button data-kind="image" :aria-pressed="kind === 'image'" @click="kind = 'image'">图片生成 <span>{{ props.requests.filter(r => r.kind === 'image').length }}</span></button>
    </div>
    <p v-if="truncated" class="studio-notice">请求记录达到保存上限，部分请求未保留。</p>
    <template v-if="selected">
      <label class="studio-field">选择请求
        <select :value="selected.id" aria-label="选择请求" @change="selectedId = ($event.target as HTMLSelectElement).value">
          <option v-for="request in requests" :key="request.id" :value="request.id">{{ request.assetId ?? `第 ${request.attempt ?? 1} 次结构请求` }} · {{ request.id }}</option>
        </select>
      </label>
      <div class="studio-request-meta"><strong>{{ selected.model }}</strong><span :class="`studio-state-${selected.status}`">{{ selected.status === 'pending' ? '等待模型响应' : selected.status === 'failed' ? '请求失败' : '请求完成' }}</span></div>
      <p class="studio-muted">{{ new Date(selected.startedAt).toLocaleTimeString() }}<template v-if="selected.finishedAt"> · 耗时 {{ Math.max(0, Math.round((selected.finishedAt - selected.startedAt) / 1000)) }} 秒</template></p>
      <details v-if="selected.parameters && Object.keys(selected.parameters).length" class="studio-parameters"><summary>请求参数</summary><pre>{{ JSON.stringify(selected.parameters, null, 2) }}</pre></details>
      <p v-if="selected.omittedReason" class="studio-notice">本次请求超过保存上限，完整提示词未保存。</p>
      <template v-else>
        <div class="studio-prompt-toolbar"><strong>实际提示词</strong><button class="studio-text-button" @click="copy">复制全文</button></div>
        <p v-if="copyMessage" role="status" class="studio-muted">{{ copyMessage }}</p>
        <pre class="studio-prompt" tabindex="0">{{ content }}</pre>
      </template>
    </template>
    <div v-else class="studio-empty"><span class="studio-empty-icon">⌘</span><h3>暂无请求快照</h3><p>请求发出后会在这里显示。缓存命中不会产生新的模型请求；旧任务不会补造历史提示词。</p></div>
    <footer class="studio-inspector-footer">只读快照 · 不包含认证请求头<br>修改全局配置不会改变历史请求。</footer>
  </aside>
</template>
