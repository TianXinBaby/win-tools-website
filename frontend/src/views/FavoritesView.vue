<script setup>
import { computed } from 'vue'
import { getTools } from '../api/tools'
import { useResource } from '../composables/useResource'
import ResourceState from '../components/ResourceState.vue'
import ToolCard from '../components/ToolCard.vue'
import { useToolPreferences } from '../utils/toolPreferences'

const { data, loading, error, reload } = useResource(getTools)
const { favorites } = useToolPreferences()
const favoriteTools = computed(() => {
  const catalog = new Map((data.value || []).map((tool) => [tool.slug, tool]))
  return favorites.value.map((slug) => catalog.get(slug)).filter(Boolean)
})
</script>

<template>
  <div class="page-heading">
    <p class="eyebrow">MY TOOLKIT</p>
    <h1>我的收藏</h1>
    <p>收藏仅保存在当前浏览器；从任意工具卡片点击星标，即可在这里快速找到。</p>
  </div>
  <ResourceState :loading="loading" :error="error" :empty="!data?.length" @retry="reload">
    <div v-if="favoriteTools.length" class="tool-grid">
      <ToolCard v-for="item in favoriteTools" :key="item.slug" :item="item" />
    </div>
    <div v-else class="state-panel">
      <p>还没有收藏的工具。</p>
      <RouterLink to="/tools">浏览在线工具 →</RouterLink>
    </div>
  </ResourceState>
</template>
