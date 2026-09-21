<script setup>
import { useRoute } from 'vue-router'
import { getArticleDetail } from '../api/articles'
import { useResource } from '../composables/useResource'
import { safeImageUrl } from '../utils/urls'
import ResourceState from '../components/ResourceState.vue'
const route = useRoute()
const { data, loading, error, reload } = useResource(getArticleDetail, () => route.params.id)
</script>
<template>
  <RouterLink class="back-link" to="/articles">← 返回教程文章</RouterLink>
  <ResourceState
    :loading="loading"
    :error="error"
    :empty="!data"
    empty-text="暂无该文章。"
    @retry="reload"
    ><article v-if="data" class="card detail-card article-detail">
      <ElTag type="info" effect="plain">{{ data.category || '技术文章' }}</ElTag>
      <h1>{{ data.title }}</h1>
      <div class="article-meta">
        <span>发布：{{ data.createdAt?.replace('T', ' ') || '未提供' }}</span
        ><span>更新：{{ data.updatedAt?.replace('T', ' ') || '未提供' }}</span
        ><span>{{ data.viewCount ?? 0 }} 次浏览</span>
      </div>
      <p class="article-summary">{{ data.summary || '暂无摘要。' }}</p>
      <img
        v-if="safeImageUrl(data.coverImage)"
        class="detail-cover"
        :src="safeImageUrl(data.coverImage)"
        :alt="data.title"
        referrerpolicy="no-referrer"
      />
      <div class="article-content">{{ data.content || '暂无正文。' }}</div>
    </article></ResourceState
  >
</template>
