<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import ToolPageHeader from '../../../components/ToolPageHeader.vue'
import { calculateFps, calculateFrameTime } from '../../../utils/tools/fun/fps'

const running = ref(false)
const fps = ref(0)
const frameTime = ref(0)
const averageFps = ref(0)
const probe = ref(null)
let frameId = null
let firstFrameAt = null
let previousFrameAt = null
let windowStartAt = null
let displayAt = null
let windowFrames = 0
let totalFrames = 0

function tick(now) {
  frameId = null
  if (!running.value) return
  if (firstFrameAt === null) {
    firstFrameAt = now
    windowStartAt = now
    displayAt = now
  } else {
    windowFrames++
    totalFrames++
    if (now - displayAt >= 250) {
      frameTime.value = calculateFrameTime(previousFrameAt, now)
      averageFps.value = calculateFps(totalFrames, now - firstFrameAt)
      displayAt = now
    }
    if (now - windowStartAt >= 1000) {
      fps.value = calculateFps(windowFrames, now - windowStartAt)
      windowFrames = 0
      windowStartAt = now
    }
  }
  previousFrameAt = now
  if (probe.value) probe.value.style.transform = `translateX(${Math.sin(now / 350) * 42}px)`
  frameId = requestAnimationFrame(tick)
}

function start() {
  if (running.value) return
  fps.value = 0
  frameTime.value = 0
  averageFps.value = 0
  firstFrameAt = null
  previousFrameAt = null
  windowStartAt = null
  displayAt = null
  windowFrames = 0
  totalFrames = 0
  running.value = true
  frameId = requestAnimationFrame(tick)
}

function stop() {
  if (!running.value) return
  running.value = false
  if (frameId !== null) cancelAnimationFrame(frameId)
  frameId = null
  if (probe.value) probe.value.style.transform = ''
}

function onVisibilityChange() {
  if (document.hidden) stop()
}

onMounted(() => document.addEventListener('visibilitychange', onVisibilityChange))
onBeforeUnmount(() => {
  stop()
  document.removeEventListener('visibilitychange', onVisibilityChange)
})
</script>

<template>
  <ToolPageHeader
    title="FPS测试"
    description="使用浏览器动画帧回调测量实时 FPS、单帧耗时与本次平均 FPS。"
  />
  <section class="card tool-panel" aria-label="FPS测试">
    <div class="tool-actions">
      <ElButton type="primary" :disabled="running" @click="start">开始测试</ElButton>
      <ElButton :disabled="!running" @click="stop">停止测试</ElButton>
      <span role="status">{{ running ? '测试中' : '已停止' }}</span>
    </div>
    <div class="fps-stage" aria-hidden="true"><span ref="probe" class="fps-probe"></span></div>
    <div class="fps-stats" aria-live="polite">
      <div>
        <span>实时 FPS</span><strong>{{ fps }}</strong>
      </div>
      <div>
        <span>Frame Time</span><strong>{{ frameTime }} ms</strong>
      </div>
      <div>
        <span>平均 FPS</span><strong>{{ averageFps }}</strong>
      </div>
    </div>
    <p class="fps-note">
      数据约每秒更新；切换到后台标签页会自动停止。结果会受设备负载、屏幕刷新率和浏览器节流影响。
    </p>
  </section>
</template>

<style scoped>
.fps-stage {
  display: grid;
  place-items: center;
  height: 130px;
  overflow: hidden;
  border: 1px solid #c8d9f8;
  border-radius: 10px;
  background: linear-gradient(135deg, #edf3ff, #dce9ff);
}
.fps-probe {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: #245cd4;
  box-shadow: 0 0 0 12px #245cd426;
  will-change: transform;
}
.fps-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.fps-stats > div {
  display: grid;
  gap: 4px;
  padding: 14px;
  border-radius: 8px;
  background: #edf3ff;
  color: #203e78;
}
.fps-stats strong {
  font-size: clamp(1.2rem, 4vw, 1.8rem);
}
.fps-note {
  margin: 0;
  color: var(--muted);
}
@media (max-width: 640px) {
  .fps-stats {
    grid-template-columns: 1fr;
  }
}
</style>
