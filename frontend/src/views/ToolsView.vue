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
      v4、时间戳、SHA-256、Base64、二维码、图片处理，以及昵称、ASCII艺术、转盘、反应速度、魔法键盘、老电视、FPS、打字速度、Mikutap、在线钢琴、随机头像和声控弹力球，均在浏览器本地运行。反应和打字测试的最佳成绩仅保存在当前浏览器。
    </p>
  </div>
  <ResourceState :loading="loading" :error="error" :empty="!data?.length" @retry="reload"
    ><div class="card-grid"><ToolCard v-for="item in data" :key="item.id" :item="item" /></div
  ></ResourceState>
</template>
