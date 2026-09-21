<script setup>
defineProps({ item: { type: Object, required: true } })
</script>
<template>
  <article class="card resource-card">
    <span class="resource-symbol tool-symbol">{{ item.icon || '{ }' }}</span>
    <h3>{{ item.name }}</h3>
    <ElTag class="category" type="info" effect="plain">{{ item.category || '通用工具' }}</ElTag>
    <p>{{ item.description || '暂无简介。' }}</p>
    <RouterLink class="card-link" :to="{ name: 'tool-detail', params: { slug: item.slug } }"
      >了解工具 <span aria-hidden="true">→</span
      ><span class="sr-only">：{{ item.name }}</span></RouterLink
    >
  </article>
</template>
