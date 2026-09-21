<script setup>
import { ref } from 'vue'
import ToolPageHeader from '../../components/ToolPageHeader.vue'
import CopyButton from '../../components/CopyButton.vue'
import { encodeBase64, decodeBase64 } from '../../utils/tools/base64'

const input = ref('')
const output = ref('')
const error = ref('')
const hasResult = ref(false)
function resetResult() {
  output.value = ''
  error.value = ''
  hasResult.value = false
}
function clear() {
  input.value = ''
  resetResult()
}
function convert(decode = false) {
  resetResult()
  try {
    output.value = decode ? decodeBase64(input.value) : encodeBase64(input.value)
    hasResult.value = true
  } catch (cause) {
    error.value =
      cause.message === '当前浏览器不支持此功能。'
        ? cause.message
        : '内容无法转换，请检查 Base64 格式、= 填充及 UTF-8 文本编码。'
  }
}
</script>

<template>
  <ToolPageHeader
    title="Base64 编解码"
    description="支持中文与 emoji 的 UTF-8 文本。Base64 是编码，不是加密，不能用于保护敏感信息。"
  />
  <section class="card tool-panel" aria-label="Base64 工具">
    <label for="base64-input">文本或 Base64 输入</label>
    <textarea
      id="base64-input"
      v-model="input"
      rows="8"
      spellcheck="false"
      placeholder="输入 UTF-8 文本，或含必要 = 填充的标准 Base64；解码时忽略空格及换行"
      @input="resetResult"
    />
    <div class="tool-actions">
      <ElButton type="primary" @click="convert()">编码为 Base64</ElButton>
      <ElButton @click="convert(true)">解码为文本</ElButton>
      <ElButton @click="clear">清空</ElButton>
    </div>
    <p v-if="error" class="tool-error" role="alert">{{ error }}</p>
    <label for="base64-output">处理结果</label>
    <textarea id="base64-output" :value="output" rows="8" readonly placeholder="编码或解码结果" />
    <p v-if="hasResult && !output" role="status">转换成功：结果为空字符串。</p>
    <CopyButton :text="output" :disabled="!hasResult" />
  </section>
</template>
