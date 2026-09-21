<script setup>
import { ref, onBeforeUnmount } from 'vue'
import ToolPageHeader from '../../components/ToolPageHeader.vue'
import CopyButton from '../../components/CopyButton.vue'
import { sha256 } from '../../utils/tools/sha256'

const input = ref('')
const output = ref('')
const error = ref('')
const busy = ref(false)
let revision = 0
function resetResult() {
  revision++
  output.value = ''
  error.value = ''
  busy.value = false
}
function clear() {
  input.value = ''
  resetResult()
}
onBeforeUnmount(resetResult)
async function calculate() {
  resetResult()
  const current = revision
  busy.value = true
  try {
    const result = await sha256(input.value)
    if (current === revision) output.value = result
  } catch (cause) {
    if (current === revision)
      error.value =
        cause.message === '当前浏览器不支持此功能。' ? cause.message : '计算失败，请稍后重试。'
  } finally {
    if (current === revision) busy.value = false
  }
}
</script>

<template>
  <ToolPageHeader
    title="SHA-256"
    description="SHA-256 是 Hash（哈希），不是加密，不能“解密”。按 UTF-8 编码计算文本摘要，空文本也可计算。"
  />
  <section class="card tool-panel" aria-label="SHA-256 工具">
    <label for="sha256-input">原始文本</label>
    <textarea
      id="sha256-input"
      v-model="input"
      rows="8"
      spellcheck="false"
      placeholder="输入需要计算 Hash 的文本，例如 abc"
      @input="resetResult"
    />
    <div class="tool-actions">
      <ElButton type="primary" :loading="busy" @click="calculate">计算 SHA-256</ElButton>
      <ElButton @click="clear">清空</ElButton>
    </div>
    <p v-if="error" class="tool-error" role="alert">{{ error }}</p>
    <label for="sha256-output">SHA-256 结果（64 个十六进制字符）</label>
    <textarea id="sha256-output" :value="output" rows="3" readonly placeholder="计算结果" />
    <CopyButton :text="output" :disabled="!output" />
  </section>
</template>
