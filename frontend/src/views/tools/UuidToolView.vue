<script setup>
import { ref } from 'vue'
import ToolPageHeader from '../../components/ToolPageHeader.vue'
import CopyButton from '../../components/CopyButton.vue'
import { generateUuids } from '../../utils/tools/uuid'

const count = ref(1)
const output = ref('')
const error = ref('')
function clear() {
  output.value = ''
  error.value = ''
  count.value = 1
}
function generate() {
  output.value = ''
  error.value = ''
  try {
    output.value = generateUuids(Number(count.value)).join('\n')
  } catch (cause) {
    error.value = ['生成数量必须为 1 到 100 的整数。', '当前浏览器不支持此功能。'].includes(
      cause.message,
    )
      ? cause.message
      : '生成失败，请检查浏览器是否支持安全随机数。'
  }
}
</script>

<template>
  <ToolPageHeader
    title="UUID v4 生成"
    description="UUID 适合作为唯一标识，不是密码、密钥或安全 Token。"
  />
  <section class="card tool-panel" aria-label="UUID 工具">
    <label for="uuid-count">生成数量（1–100）</label>
    <input
      id="uuid-count"
      v-model="count"
      type="number"
      min="1"
      max="100"
      step="1"
      placeholder="输入 1 到 100 的整数"
      @input="error = ''"
    />
    <div class="tool-actions" aria-label="快捷数量">
      <ElButton
        v-for="amount in [1, 5, 10, 20, 50]"
        :key="amount"
        :aria-pressed="Number(count) === amount"
        @click="count = amount"
        >{{ amount }} 个</ElButton
      >
    </div>
    <div class="tool-actions">
      <ElButton type="primary" @click="generate">{{ output ? '重新生成' : '生成 UUID' }}</ElButton>
      <ElButton @click="clear">清空</ElButton>
    </div>
    <p v-if="error" class="tool-error" role="alert">{{ error }}</p>
    <label for="uuid-output">UUID 结果（每行一个）</label>
    <textarea id="uuid-output" :value="output" rows="10" readonly placeholder="生成的 UUID v4" />
    <CopyButton :text="output" :disabled="!output" label="复制全部" />
  </section>
</template>
