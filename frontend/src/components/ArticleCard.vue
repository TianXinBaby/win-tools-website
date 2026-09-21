<script setup>
import { safeImageUrl } from '../utils/urls'
defineProps({ item: { type: Object, required: true } })
</script>
<template>
  <article class="card resource-card">
    <img
      v-if="safeImageUrl(item.coverImage)"
      class="card-cover"
      :src="safeImageUrl(item.coverImage)"
      :alt="item.title"
      loading="lazy"
      referrerpolicy="no-referrer"
    />
    <ElTag class="category" type="info" effect="plain">{{ item.category || '技术文章' }}</ElTag>
    <h3>{{ item.title }}</h3>
    <p>{{ item.summary || '暂无摘要。' }}</p>
    <div class="article-meta">
      <span>{{ item.createdAt?.replace('T', ' ') || '日期未提供' }}</span
      ><span>{{ item.viewCount ?? 0 }} 次浏览</span>
    </div>
    <RouterLink class="card-link" :to="{ name: 'article-detail', params: { id: item.id } }"
      >阅读全文 <span aria-hidden="true">→</span
      ><span class="sr-only">：{{ item.title }}</span></RouterLink
    >
  </article>
</template>
