<script setup>
import { onBeforeUnmount, ref, shallowRef } from 'vue'
import ToolPageHeader from '../../components/ToolPageHeader.vue'
import { useLocalUrl } from '../../composables/useLocalUrl'
import { generateQrCode, QR_MAX_BYTES, QR_SIZES } from '../../utils/tools/qrcode'
import { downloadBlob, mediaErrorMessage } from '../../utils/tools/media'

const input = ref('')
const size = ref(256)
const busy = ref(false)
const error = ref('')
const result = shallowRef(null)
const { url, set, clear: clearUrl } = useLocalUrl()
let revision = 0
function resetResult() {
  revision++
  result.value = null
  error.value = ''
  clearUrl()
}
function clear() {
  input.value = ''
  size.value = 256
  resetResult()
}
onBeforeUnmount(resetResult)
async function generate() {
  if (busy.value) return
  resetResult()
  const current = revision
  busy.value = true
  try {
    const blob = await generateQrCode(input.value, size.value)
    if (current !== revision) return
    set(blob)
    result.value = blob
  } catch (cause) {
    if (current === revision) error.value = mediaErrorMessage(cause)
  } finally {
    busy.value = false
  }
}
function download() {
  try {
    downloadBlob(result.value, 'qrcode.png')
  } catch (cause) {
    error.value = mediaErrorMessage(cause)
  }
}
</script>

<template>
  <ToolPageHeader
    title="二维码生成"
    description="将文本或 URL 编码为二维码。二维码不是加密；不会自动访问或验证输入的 URL。"
  />
  <section class="card tool-panel" aria-label="二维码工具" :aria-busy="busy">
    <p class="privacy-note">图片和输入内容仅在当前浏览器中处理，不会上传服务器。</p>
    <label for="qrcode-input">文本或 URL（最多 {{ QR_MAX_BYTES }} 个 UTF-8 字节）</label>
    <textarea
      id="qrcode-input"
      v-model="input"
      rows="6"
      :maxlength="QR_MAX_BYTES"
      :disabled="busy"
      spellcheck="false"
      @input="resetResult"
    />
    <label for="qrcode-size">二维码尺寸（px）</label>
    <select id="qrcode-size" v-model.number="size" :disabled="busy" @change="resetResult">
      <option v-for="value in QR_SIZES" :key="value" :value="value">
        {{ value }} × {{ value }}
      </option>
    </select>
    <div class="tool-actions">
      <ElButton type="primary" :loading="busy" :disabled="busy" @click="generate"
        >生成二维码</ElButton
      >
      <ElButton @click="clear">清空</ElButton>
      <ElButton :disabled="!result || busy" @click="download">下载 PNG</ElButton>
    </div>
    <p v-if="busy" role="status">正在生成二维码…</p>
    <p v-if="error" class="tool-error" role="alert">{{ error }}</p>
    <figure v-if="url" class="media-preview">
      <img :src="url" alt="根据输入内容生成的二维码" />
      <figcaption>{{ size }} × {{ size }} px · PNG</figcaption>
    </figure>
  </section>
</template>
