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
    <p>已开放 JSON、UUID v4、时间戳、SHA-256 与 Base64，均在浏览器本地运行，输入不会上传或保存。</p>
  </div>
  <ResourceState :loading="loading" :error="error" :empty="!data?.length" @retry="reload"
    ><div class="card-grid"><ToolCard v-for="item in data" :key="item.id" :item="item" /></div
  ></ResourceState>
</template>
