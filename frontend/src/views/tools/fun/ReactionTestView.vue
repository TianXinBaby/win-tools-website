<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import ToolPageHeader from '../../../components/ToolPageHeader.vue'
import {
  BEST_REACTION_KEY,
  randomWaitDuration,
  calculateReactionTime,
  parseBestReaction,
  bestReactionTime,
} from '../../../utils/tools/fun/reaction'

const status = ref('idle')
const reaction = ref(null)
const best = ref(null)
const storageError = ref('')
let timer
let appearedAt = 0

onMounted(() => {
  try {
    best.value = parseBestReaction(localStorage.getItem(BEST_REACTION_KEY))
  } catch {
    storageError.value = '浏览器存储不可用；本次最佳成绩仅在当前页面显示。'
  }
})

onBeforeUnmount(() => clearTimeout(timer))

function start() {
  clearTimeout(timer)
  reaction.value = null
  status.value = 'waiting'
  timer = setTimeout(() => {
    appearedAt = performance.now()
    status.value = 'ready'
    timer = undefined
  }, randomWaitDuration())
}

function hit() {
  if (status.value === 'waiting') {
    clearTimeout(timer)
    timer = undefined
    status.value = 'early'
    return
  }
  if (status.value !== 'ready') return
  reaction.value = calculateReactionTime(appearedAt, performance.now())
  best.value = bestReactionTime(best.value, reaction.value)
  status.value = 'result'
  try {
    localStorage.setItem(BEST_REACTION_KEY, String(best.value))
  } catch {
    storageError.value = '浏览器存储不可用；本次最佳成绩仅在当前页面显示。'
  }
}
</script>

<template>
  <ToolPageHeader
    title="反应速度测试"
    description="点击开始，等待区域变绿后尽快点击，查看以毫秒计的反应时间。"
    privacy-note="测试完全在浏览器本地运行；仅最佳成绩会保存在当前浏览器的 localStorage 中。"
  />
  <section class="card tool-panel" aria-label="反应速度测试">
    <div class="tool-actions">
      <ElButton
        type="primary"
        :disabled="status === 'waiting' || status === 'ready'"
        @click="start"
      >
        {{ status === 'idle' ? '开始测试' : '重新开始' }}
      </ElButton>
    </div>
    <button
      v-if="status === 'waiting' || status === 'ready'"
      type="button"
      class="reaction-target"
      :class="status"
      @click="hit"
    >
      {{ status === 'ready' ? '现在点击！' : '等待变绿……请勿点击' }}
    </button>
    <p v-if="status === 'early'" class="tool-error" role="alert">点早了，请重新开始。</p>
    <p v-if="status === 'result'" class="fun-result" role="status" aria-live="polite">
      本次反应时间：{{ reaction }} ms
    </p>
    <p class="reaction-best">最佳成绩：{{ best === null ? '暂无' : `${best} ms` }}</p>
    <p v-if="storageError" class="tool-error" role="alert">{{ storageError }}</p>
  </section>
</template>

<style scoped>
.reaction-target {
  width: 100%;
  min-height: 200px;
  border: 0;
  border-radius: 10px;
  color: #fff;
  font-family: inherit;
  font-size: 1.4rem;
  font-weight: 700;
  line-height: 1.4;
  cursor: pointer;
}
.reaction-target.waiting {
  background: #245cd4;
}
.reaction-target.ready {
  background: #16834a;
}
.reaction-target:focus-visible {
  outline: 3px solid #729ced;
  outline-offset: 4px;
}
.reaction-best {
  margin: 0;
  font-weight: 600;
}
</style>
