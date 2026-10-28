<script setup>
import { computed } from 'vue'
import ToolCard from './ToolCard.vue'
import { selectPopularTools } from '../utils/toolDiscovery'

const props = defineProps({ tools: { type: Array, required: true } })
const popular = computed(() => selectPopularTools(props.tools))
</script>

<template>
  <section class="section" aria-labelledby="popular-tools-title">
    <div class="section-heading">
      <div>
        <h2 id="popular-tools-title">热门工具</h2>
        <p>精选常用工具，按前端固定顺序展示。</p>
      </div>
      <RouterLink to="/tools">查看全部 <span aria-hidden="true">→</span></RouterLink>
    </div>
    <div class="tool-grid">
      <ToolCard v-for="item in popular" :key="item.slug" :item="item" />
    </div>
  </section>
</template>
