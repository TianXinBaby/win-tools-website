<script setup>
import { computed, ref } from 'vue'
import { getWindows } from '../api/windows'
import { getTools } from '../api/tools'
import { getArticles } from '../api/articles'
import { useResource } from '../composables/useResource'
import ResourceState from '../components/ResourceState.vue'
import WindowsCard from '../components/WindowsCard.vue'
import ToolCard from '../components/ToolCard.vue'
import ToolSearch from '../components/ToolSearch.vue'
import PopularTools from '../components/PopularTools.vue'
import ArticleCard from '../components/ArticleCard.vue'
import { filterTools, getToolCategories } from '../utils/toolDiscovery'
import { useToolPreferences } from '../utils/toolPreferences'

const toolState = useResource(getTools)
const { recent } = useToolPreferences()
const query = ref('')
const category = ref('')
const categories = computed(() => getToolCategories(toolState.data.value || []))
const filteredTools = computed(() =>
  filterTools(toolState.data.value || [], query.value, category.value),
)
const isFiltering = computed(() => Boolean(query.value.trim() || category.value))
const recentTools = computed(() => {
  const catalog = new Map((toolState.data.value || []).map((tool) => [tool.slug, tool]))
  return recent.value.map((slug) => catalog.get(slug)).filter(Boolean)
})
const resultsRoute = computed(() => ({
  name: 'tools',
  query: {
    ...(query.value.trim() ? { q: query.value.trim() } : {}),
    ...(category.value ? { category: category.value } : {}),
  },
}))
const sections = [
  {
    title: '热门 Windows',
    caption: '了解版本信息，从官方渠道开始。',
    to: '/windows',
    card: WindowsCard,
    state: useResource(getWindows),
  },
  {
    title: '最新文章',
    caption: '安装与使用，一步一步说明白。',
    to: '/articles',
    card: ArticleCard,
    state: useResource(getArticles),
  },
]
</script>
<template>
  <section class="hero">
    <div class="hero-copy">
      <p class="eyebrow">资源 · 工具 · 知识</p>
      <h1>Windows 资源<br />与在线工具</h1>
      <p class="hero-description">Windows 官方下载、系统信息、安装教程以及简单实用的在线工具。</p>
      <div class="hero-actions">
        <RouterLink class="button-link primary" to="/windows"
          >浏览 Windows <span aria-hidden="true">→</span></RouterLink
        ><RouterLink class="button-link" to="/tools">在线工具</RouterLink>
      </div>
      <div class="hero-search">
        <ToolSearch v-model:query="query" v-model:category="category" :categories="categories" />
      </div>
    </div>
    <div class="hero-aside" aria-hidden="true">
      <div class="window-motif"><i></i><i></i><i></i><i></i></div>
      <span>让每一次探索<br />都更简单。</span>
      <div class="motif-caption">YOUR EVERYDAY TOOLKIT</div>
    </div>
  </section>
  <div class="principles">
    <span><b>01</b> 官方资源入口</span><span><b>02</b> 清晰的工具介绍</span
    ><span><b>03</b> 实用技术文章</span>
  </div>
  <ResourceState
    :loading="toolState.loading.value"
    :error="toolState.error.value"
    :empty="!toolState.data.value?.length"
    @retry="toolState.reload"
  >
    <section v-if="isFiltering" class="section" aria-labelledby="home-search-title">
      <div class="section-heading">
        <div>
          <h2 id="home-search-title">搜索结果</h2>
          <p role="status">找到 {{ filteredTools.length }} 个工具</p>
        </div>
        <RouterLink :to="resultsRoute">前往工具页面 <span aria-hidden="true">→</span></RouterLink>
      </div>
      <div v-if="filteredTools.length" class="card-grid">
        <ToolCard v-for="item in filteredTools" :key="item.slug" :item="item" />
      </div>
      <p v-else class="state-panel">没有找到符合条件的工具，请调整关键词或分类。</p>
    </section>
    <PopularTools :tools="toolState.data.value" />
    <section class="section" aria-labelledby="recent-tools-title">
      <div class="section-heading">
        <div>
          <h2 id="recent-tools-title">最近使用</h2>
          <p>只记录当前浏览器访问过的工具，最多 10 个。</p>
        </div>
      </div>
      <div v-if="recentTools.length" class="card-grid">
        <ToolCard v-for="item in recentTools" :key="item.slug" :item="item" />
      </div>
      <p v-else class="state-panel">打开一个工具后，它会出现在这里。</p>
    </section>
    <section class="section" aria-labelledby="tool-categories-title">
      <div class="section-heading">
        <div>
          <h2 id="tool-categories-title">工具分类</h2>
          <p>按用途浏览当前开放的工具目录。</p>
        </div>
      </div>
      <nav class="category-nav" aria-label="工具分类">
        <RouterLink
          v-for="item in categories"
          :key="item.value"
          :to="{ name: 'tools', query: { category: item.value } }"
        >
          {{ item.label }} <span>{{ item.count }}</span>
        </RouterLink>
      </nav>
    </section>
  </ResourceState>
  <section v-for="section in sections" :key="section.to" class="section">
    <div class="section-heading">
      <div>
        <h2>{{ section.title }}</h2>
        <p>{{ section.caption }}</p>
      </div>
      <RouterLink :to="section.to"
        >查看全部 <span aria-hidden="true">→</span
        ><span class="sr-only">{{ section.title }}</span></RouterLink
      >
    </div>
    <ResourceState
      :loading="section.state.loading.value"
      :error="section.state.error.value"
      :empty="!section.state.data.value?.length"
      @retry="section.state.reload"
      ><div class="card-grid">
        <component
          :is="section.card"
          v-for="item in section.state.data.value?.slice(0, 3)"
          :key="item.id"
          :item="item"
        /></div
    ></ResourceState>
  </section>
</template>
