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
  <article class="card resource-card">
    <div class="tool-card-top">
      <span class="resource-symbol tool-symbol">{{ item.icon || '{ }' }}</span>
      <FavoriteButton :slug="item.slug" :name="item.name" />
    </div>
    <h3>{{ item.name }}</h3>
    <ElTag class="category" type="info" effect="plain">{{ item.category || '通用工具' }}</ElTag>
    <p class="tool-availability">{{ available ? '已开放 · 浏览器本地运行' : '即将开放' }}</p>
    <p>{{ item.description || '暂无简介。' }}</p>
    <RouterLink class="card-link" :to="destination"
      >{{ available ? '使用工具' : '了解工具' }} <span aria-hidden="true">→</span
      ><span class="sr-only">：{{ item.name }}</span></RouterLink
    >
  </article>
</template>
