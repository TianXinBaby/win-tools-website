<script setup>
import { getTools } from '../api/tools'
import { useResource } from '../composables/useResource'
import ResourceState from '../components/ResourceState.vue'
import ToolCard from '../components/ToolCard.vue'
const { data, loading, error, reload } = useResource(getTools)
</script>
<template>
  <div class="page-heading">
    <p class="eyebrow">TOOLKIT</p>
    <h1>在线工具</h1>
    <p>探索简单实用的日常工具。当前开放工具介绍，实际功能将在下一阶段上线。</p>
  </div>
  <ResourceState :loading="loading" :error="error" :empty="!data?.length" @retry="reload"
    ><div class="card-grid"><ToolCard v-for="item in data" :key="item.id" :item="item" /></div
  ></ResourceState>
</template>
