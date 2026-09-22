<script setup lang="ts">
import { computed } from 'vue'
import { assetImageUrl, type AssetView } from '../api/client.js'

const props = defineProps<{ taskId: string; asset: AssetView }>()

const src = computed(() => assetImageUrl(props.taskId, props.asset.contentHash))
</script>

<template>
  <a-card :title="`资产 ${asset.id}`" size="small">
    <a-row :gutter="16">
      <a-col :xs="24" :md="10">
        <a-image :src="src" :alt="asset.alt" style="max-width: 100%" />
      </a-col>
      <a-col :xs="24" :md="14">
        <a-descriptions :column="1" size="small" bordered>
          <a-descriptions-item label="几何">
            {{ asset.aspectRatio }} · {{ asset.renderSize.w }}×{{ asset.renderSize.h }}
          </a-descriptions-item>
          <a-descriptions-item label="透明底">
            {{ asset.transparent ? '是' : '否' }}
          </a-descriptions-item>
          <a-descriptions-item label="alt">{{ asset.alt }}</a-descriptions-item>
          <a-descriptions-item label="contentHash">
            <a-typography-text code copyable>{{ asset.contentHash }}</a-typography-text>
          </a-descriptions-item>
          <a-descriptions-item label="prompt">
            <a-typography-paragraph :copyable="{ text: asset.prompt }" style="margin: 0">
              {{ asset.prompt }}
            </a-typography-paragraph>
          </a-descriptions-item>
        </a-descriptions>
      </a-col>
    </a-row>
  </a-card>
</template>
