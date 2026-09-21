<script setup>
import { ref } from 'vue'
import ToolPageHeader from '../../components/ToolPageHeader.vue'
import CopyButton from '../../components/CopyButton.vue'
import { formatJson, compactJson } from '../../utils/tools/json'

const input = ref('')
const output = ref('')
const error = ref('')
function resetResult() {
  output.value = ''
  error.value = ''
}
function clear() {
  input.value = ''
  resetResult()
}
function convert(compact = false) {
  resetResult()
  try {
    output.value = compact ? compactJson(input.value) : formatJson(input.value)
  } catch {
    error.value = 'JSON 格式不正确，请检查输入内容。'
  }
}
</script>

<template>
  <ToolPageHeader title="JSON 格式化" description="将 JSON 格式化为两空格缩进，或压缩为一行。" />
  <section class="card tool-panel" aria-label="JSON 工具">
    <label for="json-input">JSON 输入</label>
    <textarea
      id="json-input"
      v-model="input"
      rows="10"
      spellcheck="false"
      placeholder='例如：{"name":"Win Tools","enabled":true}'
      @input="resetResult"
    />
    <div class="tool-actions">
      <ElButton type="primary" @click="convert()">格式化</ElButton>
      <ElButton @click="convert(true)">压缩</ElButton>
      <ElButton @click="clear">清空</ElButton>
    </div>
    <p v-if="error" class="tool-error" role="alert">{{ error }}</p>
    <label for="json-output">处理结果</label>
    <textarea
      id="json-output"
      :value="output"
      rows="10"
      readonly
      placeholder="格式化或压缩后的 JSON"
    />
    <CopyButton :text="output" :disabled="!output" />
  </section>
</template>
