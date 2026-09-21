<script setup>
import ToolPageHeader from '../../components/ToolPageHeader.vue'
import ImageToolPanel from '../../components/ImageToolPanel.vue'
</script>

<template>
  <ToolPageHeader
    title="图片压缩"
    description="在浏览器中调整 JPEG / WebP 质量，或重新编码 PNG；处理后体积不一定更小。"
  />
  <ImageToolPanel mode="compress" />
</template>
