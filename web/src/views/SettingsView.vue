<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { getSettings, putSettings, testSettings, type ProbeReport } from '../api/client.js'
import {
  emptyForm,
  formFromEnvelope,
  payloadFromForm,
  probeFailure,
  saveFailure,
  sourceLabel,
  type Failure,
} from './settingsForm.js'

const form = ref(emptyForm())
const loading = ref(true)
const saving = ref(false)
const testing = ref(false)
const report = ref<ProbeReport | null>(null)
const failure = ref<Failure | null>(null)
const saved = ref(false)
/** Latched once the server answers 501: the probe does not exist in this deployment. */
const probeUnavailable = ref(false)

async function load(): Promise<void> {
  loading.value = true
  failure.value = null
  try {
    form.value = formFromEnvelope(await getSettings())
  } catch (cause) {
    failure.value = saveFailure(cause)
  } finally {
    loading.value = false
  }
}

async function save(): Promise<void> {
  saving.value = true
  failure.value = null
  saved.value = false
  try {
    form.value = formFromEnvelope(await putSettings(payloadFromForm(form.value)))
    saved.value = true
  } catch (cause) {
    const result = saveFailure(cause)
    failure.value = result
    // A 500 already persisted the body, so the form must show what the server
    // actually holds now instead of the stale inputs or a "lost" claim.
    if (result.refetch) {
      try {
        form.value = formFromEnvelope(await getSettings())
      } catch {
        /* keep the save failure visible; the re-read is best effort */
      }
    }
  } finally {
    saving.value = false
  }
}

async function probe(): Promise<void> {
  testing.value = true
  failure.value = null
  report.value = null
  try {
    report.value = await testSettings(payloadFromForm(form.value))
  } catch (cause) {
    const result = probeFailure(cause)
    failure.value = result
    if (result.kind === 'unsupported') probeUnavailable.value = true
  } finally {
    testing.value = false
  }
}

onMounted(load)
</script>

<template>
  <a-spin :spinning="loading">
    <a-alert
      v-if="failure"
      :type="failure.kind === 'server-config' ? 'warning' : 'error'"
      :message="failure.message"
      show-icon
      style="margin-bottom: 16px"
    />
    <a-alert
      v-if="saved"
      type="success"
      message="已保存。新设置只影响之后创建的任务。"
      show-icon
      style="margin-bottom: 16px"
    />

    <a-card title="文案模型（spec）" style="margin-bottom: 16px">
      <a-form layout="vertical">
        <a-form-item label="接口地址">
          <a-input v-model:value="form.spec.baseUrl" :placeholder="form.placeholders.spec.baseUrl" />
          <small>{{ sourceLabel(form.sources.spec.baseUrl) }}</small>
        </a-form-item>
        <a-form-item label="模型名">
          <a-input v-model:value="form.spec.model" :placeholder="form.placeholders.spec.model" />
          <small>{{ sourceLabel(form.sources.spec.model) }}</small>
        </a-form-item>
        <a-form-item label="发送 JSON 响应格式">
          <a-switch v-model:checked="form.spec.sendResponseFormat" />
          <small style="display: block">
            部分中转站不认 response_format 参数，会返回 400。关掉它仍能正常解析。
          </small>
        </a-form-item>
      </a-form>
      <a-alert
        v-if="report"
        :type="report.spec.ok ? 'success' : 'error'"
        :message="
          report.spec.ok
            ? '连接正常'
            : `连接失败${report.spec.status ? '（' + report.spec.status + '）' : ''}`
        "
        :description="report.spec.hint ?? report.spec.bodyExcerpt"
        show-icon
      />
    </a-card>

    <a-card title="图片模型（image）" style="margin-bottom: 16px">
      <a-form layout="vertical">
        <a-form-item label="接口地址">
          <a-input
            v-model:value="form.image.baseUrl"
            :placeholder="form.placeholders.image.baseUrl"
          />
          <small>{{ sourceLabel(form.sources.image.baseUrl) }}</small>
        </a-form-item>
        <a-form-item label="模型名">
          <a-input v-model:value="form.image.model" :placeholder="form.placeholders.image.model" />
          <small>{{ sourceLabel(form.sources.image.model) }}</small>
        </a-form-item>
      </a-form>
      <a-alert
        v-if="report"
        :type="report.image.ok ? 'success' : 'error'"
        :message="
          report.image.ok
            ? '连接正常'
            : `连接失败${report.image.status ? '（' + report.image.status + '）' : ''}`
        "
        :description="report.image.hint ?? report.image.bodyExcerpt"
        show-icon
      />
    </a-card>

    <a-space>
      <a-button type="primary" :loading="saving" @click="save">保存</a-button>
      <a-button :loading="testing" :disabled="probeUnavailable" @click="probe">测试连通性</a-button>
      <a-button @click="load">重置</a-button>
    </a-space>
    <p v-if="probeUnavailable" style="margin-top: 12px; color: rgba(0, 0, 0, 0.45)">
      该部署未配置 API key，连通性测试不可用。
    </p>
    <p style="margin-top: 12px; color: rgba(0, 0, 0, 0.45)">
      API key 不在这里配置，仍由环境变量提供。测试按钮会真实调用一次文案模型，产生极小的用量。
    </p>
  </a-spin>
</template>
