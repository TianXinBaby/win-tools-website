<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { isToolAvailable } from '../utils/tools/registry'
import FavoriteButton from './FavoriteButton.vue'
const props = defineProps({ item: { type: Object, required: true } })
const router = useRouter()
const available = computed(() => isToolAvailable(props.item.slug))
const destination = computed(() => {
  const { path, slug } = props.item
  // 仅跟随指向该工具真实页面的站内 path，避免异常元数据跳转到外部或其他页面。
  if (available.value && typeof path === 'string' && path.startsWith('/tools/')) {
    const route = router.resolve(path)
    if (route.name === `tool-${slug}`) return path
  }
  return available.value ? { name: `tool-${slug}` } : { name: 'tool-detail', params: { slug } }
})
</script>
<template>
  <article class="card compact-tool-card">
    <RouterLink class="card-link tool-card-link" :to="destination" :aria-label="item.name">
      <span class="resource-symbol tool-symbol" aria-hidden="true">{{ item.icon || '{ }' }}</span>
      <div class="tool-card-copy">
        <h3 :title="item.name">{{ item.name }}</h3>
        <p :title="item.description">{{ item.description || '暂无简介。' }}</p>
        <span class="sr-only tool-availability">{{
          available
            ? item.slug === 'video-converter'
              ? '本站服务器处理 · 以服务状态为准'
              : '已开放 · 浏览器本地运行'
            : '即将开放'
        }}</span>
      </div>
    </RouterLink>
    <FavoriteButton :slug="item.slug" :name="item.name" compact />
  </article>
</template>
