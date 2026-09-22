<script setup lang="ts">
import { computed } from 'vue'
import type { SpecView } from '../api/client.js'
import { buildTreeData, type TreeNode } from './specTree.js'

const props = defineProps<{ spec: SpecView }>()
const emit = defineEmits<{
  'select-page': [route: string]
  'select-asset': [assetId: string]
}>()

const treeData = computed(() => buildTreeData(props.spec))

function onSelect(_keys: unknown, info: { node: TreeNode }): void {
  const node = info.node
  if (node.kind === 'page' && node.route !== undefined) emit('select-page', node.route)
  if (node.kind === 'asset' && node.assetId !== undefined) emit('select-asset', node.assetId)
}
</script>

<template>
  <a-tree
    :tree-data="treeData"
    default-expand-all
    :show-line="true"
    block-node
    @select="onSelect"
  />
</template>
