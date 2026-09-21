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
    <p>
      已开放 JSON、UUID
      v4、时间戳、SHA-256、Base64、二维码与图片压缩、尺寸调整、格式转换，均在浏览器本地运行，图片和输入不会上传或保存。
    </p>
  </div>
  <ResourceState :loading="loading" :error="error" :empty="!data?.length" @retry="reload"
    ><div class="card-grid"><ToolCard v-for="item in data" :key="item.id" :item="item" /></div
  ></ResourceState>
</template>
