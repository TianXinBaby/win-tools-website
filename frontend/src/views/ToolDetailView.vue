<script setup>
import { watch } from 'vue'
import { useRoute } from 'vue-router'
import { getToolDetail } from '../api/tools'
import { useResource } from '../composables/useResource'
import ResourceState from '../components/ResourceState.vue'
import { recordRecentTool } from '../utils/toolPreferences'
const route = useRoute()
const { data, loading, error, reload } = useResource(getToolDetail, () => route.params.slug)
watch(data, (tool) => {
  if (tool?.slug === route.params.slug) recordRecentTool(tool.slug)
})
</script>
<template>
  <RouterLink class="back-link" to="/tools">← 返回工具列表</RouterLink>
  <ResourceState
    :loading="loading"
    :error="error"
    :empty="!data"
    empty-text="暂无该工具介绍。"
    @retry="reload"
    ><article v-if="data" class="card detail-card">
      <span class="resource-symbol tool-symbol">{{ data.icon || '{ }' }}</span>
      <h1>{{ data.name }}</h1>
      <ElTag type="info" effect="plain">{{ data.category || '通用工具' }}</ElTag>
      <p class="detail-description">{{ data.description || '暂无简介。' }}</p>
      <ElAlert
        title="该工具将在下一阶段开放"
        description="当前仅提供工具介绍，实际操作功能尚未实现。"
        type="info"
        :closable="false"
        show-icon
      /></article
  ></ResourceState>
</template>
