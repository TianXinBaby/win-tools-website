<script setup>
import { ref, watch } from 'vue'
const props = defineProps({
  text: { type: String, required: true },
  disabled: Boolean,
  label: { type: String, default: '复制结果' },
})
const message = ref('')
const copying = ref(false)
let revision = 0
watch(
  () => props.text,
  () => {
    revision++
    message.value = ''
    copying.value = false
  },
)

async function copy() {
  const current = ++revision
  message.value = ''
  if (typeof navigator.clipboard?.writeText !== 'function') {
    message.value = '当前浏览器不支持复制，请手动选择结果复制。'
    return
  }
  copying.value = true
  try {
    await navigator.clipboard.writeText(props.text)
    if (current === revision) message.value = '复制成功。'
  } catch {
    if (current === revision) message.value = '复制失败，请检查浏览器权限或手动复制。'
  } finally {
    if (current === revision) copying.value = false
  }
}
</script>

<template>
  <span class="copy-control">
    <ElButton :disabled="disabled || copying" @click="copy">{{ label }}</ElButton>
    <span role="status" aria-live="polite">{{ message }}</span>
  </span>
</template>
