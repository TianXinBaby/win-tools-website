<script setup>
import { computed, ref } from 'vue'
import ToolPageHeader from '../../../components/ToolPageHeader.vue'
import { createAvatar, renderAvatarSvg } from '../../../utils/tools/fun/randomAvatar'

const avatar = ref(createAvatar())
const svg = computed(() => renderAvatarSvg(avatar.value))
const imageUrl = computed(() => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.value)}`)

function regenerate() {
  avatar.value = createAvatar()
}

function download() {
  const anchor = document.createElement('a')
  anchor.href = imageUrl.value
  anchor.download = 'win-tools-avatar.svg'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
}
</script>

<template>
  <ToolPageHeader
    title="随机头像生成器"
    description="组合背景、脸型、眼睛、嘴巴和装饰，生成独一无二的卡通 SVG 头像。"
  />
  <section class="card tool-panel" aria-label="随机头像生成器">
    <div class="avatar-preview">
      <img :src="imageUrl" alt="当前随机生成的卡通头像" width="256" height="256" />
    </div>
    <div class="tool-actions">
      <ElButton type="primary" @click="regenerate">重新生成</ElButton>
      <ElButton @click="download">下载 SVG</ElButton>
    </div>
    <p class="privacy-note">头像由浏览器本地生成，不调用头像服务，也不保存生成记录。</p>
  </section>
</template>

<style scoped>
.avatar-preview {
  display: grid;
  place-items: center;
  min-height: 320px;
  border: 1px solid #d8e3f4;
  border-radius: 12px;
  background: #f4f8ff;
}
.avatar-preview img {
  width: min(256px, calc(100% - 32px));
  height: auto;
  border-radius: 36px;
  box-shadow: 0 12px 32px #1b3b7024;
}
</style>
