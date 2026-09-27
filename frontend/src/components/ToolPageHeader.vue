<script setup>
defineProps({
  title: { type: String, required: true },
  description: { type: String, required: true },
  privacyNote: {
    type: String,
    default:
      '完全在浏览器本地运行，输入不会上传服务器，也不会保存到本地存储；刷新或离开页面后清除。',
  },
})
</script>

<template>
  <RouterLink class="back-link" to="/tools">← 返回工具列表</RouterLink>
  <div class="page-heading">
    <p class="eyebrow">LOCAL TOOLS</p>
    <h1>{{ title }}</h1>
    <p>{{ description }}</p>
    <p class="privacy-note">{{ privacyNote }}</p>
  </div>
</template>
