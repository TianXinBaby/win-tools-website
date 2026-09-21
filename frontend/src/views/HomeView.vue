<script setup>
import { getWindows } from '../api/windows'
import { getTools } from '../api/tools'
import { getArticles } from '../api/articles'
import { useResource } from '../composables/useResource'
import ResourceState from '../components/ResourceState.vue'
import WindowsCard from '../components/WindowsCard.vue'
import ToolCard from '../components/ToolCard.vue'
import ArticleCard from '../components/ArticleCard.vue'
const sections = [
  {
    title: '热门 Windows',
    caption: '了解版本信息，从官方渠道开始。',
    to: '/windows',
    card: WindowsCard,
    state: useResource(getWindows),
  },
  {
    title: '常用工具',
    caption: '实用工具目录，找到适合你的那一个。',
    to: '/tools',
    card: ToolCard,
    state: useResource(getTools),
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
