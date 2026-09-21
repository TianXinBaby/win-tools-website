<script setup>
defineProps({
  loading: Boolean,
  error: { type: String, default: '' },
  empty: Boolean,
  emptyText: { type: String, default: '暂无公开内容，稍后再来看看。' },
})
defineEmits(['retry'])
</script>
<template>
  <div v-if="loading" class="state-panel" role="status" aria-live="polite" aria-busy="true">
    <span class="state-label">正在加载…</span><ElSkeleton :rows="3" animated />
  </div>
  <div v-else-if="error" class="state-panel" role="alert">
    <ElAlert :title="error" type="error" :closable="false" show-icon /><ElButton
      class="retry-button"
      @click="$emit('retry')"
      >重新加载</ElButton
    >
  </div>
  <ElEmpty v-else-if="empty" :description="emptyText" :image-size="80" />
  <slot v-else />
</template>
