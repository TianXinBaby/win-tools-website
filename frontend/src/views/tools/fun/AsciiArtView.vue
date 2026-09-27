<script setup>
import { ref } from 'vue'
import ToolPageHeader from '../../../components/ToolPageHeader.vue'
import CopyButton from '../../../components/CopyButton.vue'
import { toAsciiArt } from '../../../utils/tools/fun/asciiArt'

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

function generate() {
  resetResult()
  try {
    output.value = toAsciiArt(input.value)
  } catch (cause) {
    error.value = cause.message
  }
}
</script>

<template>
  <ToolPageHeader
    title="ASCII艺术生成器"
    description="用内置 5×7 字符图案生成文字艺术；支持英文字母、数字、空格及 . , ! ? - :，最多 32 个字符。"
  />
  <section class="card tool-panel" aria-label="ASCII艺术生成器">
    <label for="ascii-input">输入文字</label>
    <input
      id="ascii-input"
      v-model="input"
      type="text"
      maxlength="32"
      placeholder="例如：WIN TOOLS"
      @input="resetResult"
    />
    <div class="tool-actions">
      <ElButton type="primary" @click="generate">生成艺术字</ElButton>
      <ElButton @click="clear">清空</ElButton>
      <CopyButton :text="output" :disabled="!output" label="复制艺术字" />
    </div>
    <p v-if="error" class="tool-error" role="alert">{{ error }}</p>
    <label for="ascii-output">ASCII 结果</label>
    <pre id="ascii-output" class="ascii-output" tabindex="0">{{ output }}</pre>
  </section>
</template>

<style scoped>
.ascii-output {
  min-height: 10rem;
  max-width: 100%;
  margin: 0;
  padding: 16px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #f6f8fb;
  color: #1f2c40;
  font:
    0.85rem/1.2 ui-monospace,
    SFMono-Regular,
    Consolas,
    monospace;
  white-space: pre;
  overflow: auto;
}
</style>
