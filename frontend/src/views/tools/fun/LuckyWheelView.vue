<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import ToolPageHeader from '../../../components/ToolPageHeader.vue'
import {
  parseWheelOptions,
  pickWheelIndex,
  nextWheelRotation,
} from '../../../utils/tools/fun/luckyWheel'

const colors = ['#245cd4', '#1e509e', '#3362b7', '#284889', '#2d6ba5', '#374d9f']
const input = ref('看电影\n散步\n读书\n打游戏')
const options = ref(parseWheelOptions(input.value))
const rotation = ref(0)
const spinning = ref(false)
const result = ref('')
const error = ref('')
let timer

const wheelBackground = computed(() => {
  const segment = 100 / options.value.length
  return `conic-gradient(${options.value.map((_, index) => `${colors[index % colors.length]} ${index * segment}% ${(index + 1) * segment}%`).join(', ')})`
})

watch(input, () => {
  result.value = ''
  error.value = ''
  try {
    options.value = parseWheelOptions(input.value)
  } catch {
    options.value = []
  }
})

function spin() {
  result.value = ''
  error.value = ''
  let entries
  try {
    entries = parseWheelOptions(input.value)
  } catch (cause) {
    error.value = cause.message
    return
  }
  options.value = entries
  const selected = pickWheelIndex(entries)
  spinning.value = true
  rotation.value = nextWheelRotation(rotation.value, selected, entries.length)
  timer = setTimeout(() => {
    result.value = entries[selected]
    spinning.value = false
    timer = undefined
  }, 4000)
}

function restart() {
  result.value = ''
  error.value = ''
}

onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <ToolPageHeader
    title="幸运转盘"
    description="输入 2 到 12 个选项，每行一个；转盘在浏览器内随机选择。"
  />
  <section class="card tool-panel" aria-label="幸运转盘">
    <label for="wheel-options">转盘选项（每行一个，也可用逗号分隔）</label>
    <textarea
      id="wheel-options"
      v-model="input"
      rows="6"
      :disabled="spinning"
      placeholder="每行输入一个选项"
    />
    <div class="tool-actions">
      <ElButton type="primary" :disabled="spinning" @click="spin">{{
        spinning ? '转动中…' : '开始旋转'
      }}</ElButton>
      <ElButton :disabled="spinning" @click="restart">重新开始</ElButton>
    </div>
    <p v-if="error" class="tool-error" role="alert">{{ error }}</p>
    <div v-if="options.length" class="wheel-stage">
      <div class="wheel-pointer" aria-hidden="true"></div>
      <div
        class="wheel-disc"
        :style="{ background: wheelBackground, transform: `rotate(${rotation}deg)` }"
        role="img"
        :aria-label="`幸运转盘，${options.length} 个等大区域`"
      >
        <span
          v-for="(option, index) in options"
          :key="index"
          class="wheel-label"
          :style="{
            transform: `translate(-50%, -50%) rotate(${((index + 0.5) * 360) / options.length}deg) translateY(calc(-1 * var(--wheel-radius))) rotate(-${((index + 0.5) * 360) / options.length}deg)`,
          }"
          :title="option"
          aria-hidden="true"
          >{{ option }}</span
        >
      </div>
    </div>
    <p v-else class="wheel-empty">输入 2 到 12 个选项后显示转盘。</p>
    <p v-if="result" class="fun-result" role="status" aria-live="polite">选中：{{ result }}</p>
    <ol v-if="options.length" class="wheel-options-list" aria-label="转盘选项">
      <li v-for="(option, index) in options" :key="index">{{ option }}</li>
    </ol>
  </section>
</template>

<style scoped>
.wheel-stage {
  position: relative;
  align-self: center;
  width: min(320px, 100%);
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  --wheel-radius: clamp(84px, 30vw, 120px);
}
.wheel-disc {
  position: relative;
  width: 100%;
  height: 100%;
  border: 6px solid #d6e2fa;
  border-radius: 50%;
  box-shadow: 0 8px 22px #17346526;
  transition: transform 4s cubic-bezier(0.12, 0.75, 0.12, 1);
}
.wheel-pointer {
  position: absolute;
  top: -12px;
  z-index: 1;
  width: 0;
  height: 0;
  border-left: 14px solid transparent;
  border-right: 14px solid transparent;
  border-top: 25px solid #d33143;
  filter: drop-shadow(0 2px 2px #1f2c4066);
}
.wheel-label {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 76px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #fff;
  font-size: 0.75rem;
  font-weight: 700;
  text-align: center;
}
.wheel-options-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 6px 28px;
  margin: 0;
  padding-left: 24px;
  color: var(--muted);
}
.wheel-empty {
  text-align: center;
}
</style>
