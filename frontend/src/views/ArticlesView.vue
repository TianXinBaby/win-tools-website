<script setup>
import { getArticles } from '../api/articles'
import { useResource } from '../composables/useResource'
import ResourceState from '../components/ResourceState.vue'
import ArticleCard from '../components/ArticleCard.vue'
const { data, loading, error, reload } = useResource(getArticles)
</script>
<template>
  <div class="page-heading">
    <p class="eyebrow">GUIDES & NOTES</p>
    <h1>教程文章</h1>
    <p>从系统安装到日常使用，发现值得参考的技术笔记。</p>
  </div>
  <ResourceState :loading="loading" :error="error" :empty="!data?.length" @retry="reload"
    ><div class="card-grid"><ArticleCard v-for="item in data" :key="item.id" :item="item" /></div
  ></ResourceState>
</template>
