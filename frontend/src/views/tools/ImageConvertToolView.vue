<script setup>
import ToolPageHeader from '../../components/ToolPageHeader.vue'
import ImageToolPanel from '../../components/ImageToolPanel.vue'
</script>

<template>
  <ToolPageHeader
    title="图片格式转换"
    description="在浏览器中转换静态 JPEG、PNG 和 WebP 图片，并下载处理结果。"
  />
  <ImageToolPanel mode="convert" />
</template>
