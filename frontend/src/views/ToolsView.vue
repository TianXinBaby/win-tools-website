<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getTools } from '../api/tools'
import { useResource } from '../composables/useResource'
import ResourceState from '../components/ResourceState.vue'
import ToolCard from '../components/ToolCard.vue'
import ToolSearch from '../components/ToolSearch.vue'
import { filterTools, getToolCategories } from '../utils/toolDiscovery'

const route = useRoute()
const { data, loading, error, reload } = useResource(getTools)
const query = ref('')
const category = ref('')
watch(
  () => [route.query.q, route.query.category],
  ([nextQuery, nextCategory]) => {
    query.value = typeof nextQuery === 'string' ? nextQuery : ''
    category.value = typeof nextCategory === 'string' ? nextCategory : ''
  },
  { immediate: true },
)
const categories = computed(() => getToolCategories(data.value || []))
const filtered = computed(() => filterTools(data.value || [], query.value, category.value))
</script>
<template>
  <div class="page-heading">
    <p class="eyebrow">TOOLKIT</p>
    <h1>在线工具</h1>
    <p>
      已开放 JSON、UUID
      v4、时间戳、SHA-256、Base64、二维码、图片处理，以及昵称、ASCII艺术、转盘、反应速度、魔法键盘、老电视、FPS、打字速度、Mikutap、在线钢琴、随机头像和声控弹力球，均在浏览器本地运行。反应和打字测试的最佳成绩仅保存在当前浏览器。
    </p>
  </div>
  <ToolSearch v-model:query="query" v-model:category="category" :categories="categories" />
  <ResourceState :loading="loading" :error="error" :empty="!data?.length" @retry="reload">
    <p class="tool-results-count" role="status">找到 {{ filtered.length }} 个工具</p>
    <div v-if="filtered.length" class="card-grid">
      <ToolCard v-for="item in filtered" :key="item.id" :item="item" />
    </div>
    <p v-else class="state-panel">没有找到符合条件的工具，请调整关键词或分类。</p>
  </ResourceState>
</template>
