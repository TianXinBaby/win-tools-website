<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import ToolPageHeader from '../../../components/ToolPageHeader.vue'
import {
  BEST_TYPING_KEY,
  betterTypingScore,
  calculateTypingMetrics,
  parseBestTypingScore,
} from '../../../utils/tools/fun/typing'

const target =
  'The best way to learn is to build something useful, test it carefully, and keep improving it.'
const status = ref('idle')
const input = ref('')
const elapsedMs = ref(0)
const best = ref(null)
const storageError = ref('')
const inputElement = ref(null)
const metrics = computed(() => calculateTypingMetrics(target, input.value, elapsedMs.value))
let startedAt = null
let clockId = null

function stopClock() {
  if (clockId !== null) clearInterval(clockId)
  clockId = null
}

function updateElapsed() {
  if (startedAt !== null) elapsedMs.value = Math.max(0, performance.now() - startedAt)
}

function start() {
  stopClock()
  status.value = 'active'
  input.value = ''
  elapsedMs.value = 0
  startedAt = null
  void nextTick(() => inputElement.value?.focus())
}

function finish() {
  updateElapsed()
  stopClock()
  status.value = 'complete'
  best.value = betterTypingScore(best.value, metrics.value)
  try {
    localStorage.setItem(BEST_TYPING_KEY, JSON.stringify(best.value))
  } catch {
    storageError.value = '浏览器存储不可用；本次最佳成绩仅在当前页面显示。'
  }
}

function onInput() {
  if (status.value !== 'active') return
  if (startedAt === null && input.value) {
    startedAt = performance.now()
    clockId = setInterval(updateElapsed, 100)
  }
  if (input.value.length >= target.length) finish()
}

function reset() {
  stopClock()
  status.value = 'idle'
  input.value = ''
  elapsedMs.value = 0
  startedAt = null
}

onMounted(() => {
  try {
    best.value = parseBestTypingScore(localStorage.getItem(BEST_TYPING_KEY))
  } catch {
    storageError.value = '浏览器存储不可用；本次最佳成绩仅在当前页面显示。'
  }
})
onBeforeUnmount(stopClock)
</script>

<template>
  <ToolPageHeader
    title="打字速度测试"
    description="照着英文短文输入，查看每分钟标准词数、正确率和用时。首个字符输入后开始计时。"
    privacy-note="输入只在浏览器本地处理；仅最佳 WPM 与正确率会保存在当前浏览器的 localStorage。"
  />
  <section class="card tool-panel" aria-label="打字速度测试">
    <div class="tool-actions">
      <ElButton type="primary" :disabled="status === 'active'" @click="start">
        {{ status === 'complete' ? '再次开始' : '开始' }}
      </ElButton>
      <ElButton @click="reset">重置</ElButton>
      <span role="status">{{
        status === 'complete' ? '测试完成！' : status === 'active' ? '测试中' : '准备开始'
      }}</span>
    </div>
    <p class="typing-prompt" aria-label="目标文本">
      <span
        v-for="(character, index) in target"
        :key="index"
        :class="{
          correct: index < input.length && input[index] === character,
          incorrect: index < input.length && input[index] !== character,
        }"
        >{{ character }}</span
      >
    </p>
    <label for="typing-input">在此输入上方文本</label>
    <textarea
      id="typing-input"
      ref="inputElement"
      v-model="input"
      rows="4"
      :maxlength="target.length"
      :disabled="status !== 'active'"
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
      @input="onInput"
      @paste.prevent
    ></textarea>
    <div class="typing-stats" aria-live="polite">
      <p>
        速度：<strong>{{ metrics.wpm }} WPM</strong>
      </p>
      <p>
        正确率：<strong>{{ metrics.accuracy }}%</strong>
      </p>
      <p>
        时间：<strong>{{ metrics.seconds }} 秒</strong>
      </p>
    </div>
    <p>最佳成绩：{{ best ? `${best.wpm} WPM · ${best.accuracy}%` : '暂无' }}</p>
    <p v-if="storageError" class="tool-error" role="alert">{{ storageError }}</p>
    <p class="typing-note">
      WPM 按每 5 个正确字符折算 1 个标准词；粘贴已禁用。输满目标文本即完成，错误字符会计入正确率。
    </p>
  </section>
</template>

<style scoped>
.typing-prompt {
  margin: 0;
  padding: 18px;
  border: 1px solid #c8d9f8;
  border-radius: 8px;
  background: #f6f9ff;
  color: #203e78;
  font-size: 1.1rem;
  line-height: 1.8;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.typing-prompt .correct {
  background: #d9f2e3;
  color: #16643a;
}
.typing-prompt .incorrect {
  background: #ffe0df;
  color: #9e2520;
}
.typing-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 24px;
}
.typing-stats p {
  margin: 0;
}
.typing-note {
  margin: 0;
  color: var(--muted);
}
</style>
