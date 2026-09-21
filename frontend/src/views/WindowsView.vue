<script setup>
import { getWindows } from '../api/windows'
import { useResource } from '../composables/useResource'
import ResourceState from '../components/ResourceState.vue'
import WindowsCard from '../components/WindowsCard.vue'
const { data, loading, error, reload } = useResource(getWindows)
</script>
<template>
  <div class="page-heading">
    <p class="eyebrow">WINDOWS</p>
    <h1>Windows 下载</h1>
    <p>查看系统版本与安装信息，前往 Microsoft 官方渠道下载。</p>
  </div>
  <ResourceState :loading="loading" :error="error" :empty="!data?.length" @retry="reload"
    ><div class="card-grid"><WindowsCard v-for="item in data" :key="item.id" :item="item" /></div
  ></ResourceState>
</template>
