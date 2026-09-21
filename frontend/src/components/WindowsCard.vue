<script setup>
defineProps({ item: { type: Object, required: true } })
</script>
<template>
  <article class="card resource-card">
    <span class="resource-symbol" aria-hidden="true">⊞</span>
    <h3>{{ item.name }}</h3>
    <div class="tags">
      <ElTag effect="plain">{{ item.version }}</ElTag
      ><ElTag type="info" effect="plain">{{ item.architecture || '架构待补充' }}</ElTag>
    </div>
    <p>{{ item.description || '暂无简介。' }}</p>
    <dl class="card-facts">
      <div>
        <dt>版本名称</dt>
        <dd>{{ item.edition || '未提供' }}</dd>
      </div>
      <div>
        <dt>发布日期</dt>
        <dd>{{ item.releaseDate || '未提供' }}</dd>
      </div>
    </dl>
    <RouterLink class="card-link" :to="{ name: 'windows-detail', params: { id: item.id } }"
      >查看详情 <span aria-hidden="true">→</span
      ><span class="sr-only">：{{ item.name }}</span></RouterLink
    >
  </article>
</template>
