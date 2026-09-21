<script setup>
import ToolPageHeader from '../../components/ToolPageHeader.vue'
import ImageToolPanel from '../../components/ImageToolPanel.vue'
</script>

<template>
  <ToolPageHeader
    title="图片尺寸调整"
    description="按原图宽高比调整尺寸，或自定义宽高；默认保持原始图片格式。"
  />
  <ImageToolPanel mode="resize" />
</template>
