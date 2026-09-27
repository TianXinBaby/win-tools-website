<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import ToolPageHeader from '../../../components/ToolPageHeader.vue'
import { calculateVolume, nextVoiceStatus } from '../../../utils/tools/fun/voiceBall'

const status = ref('idle')
const error = ref('')
const volume = ref(0)
const statusText = computed(
  () => ({ idle: '未启动', requesting: '等待授权', running: '运行中' })[status.value],
)
const ballStyle = computed(() => {
  const strength = Math.min(volume.value * 8, 1)
  return {
    transform: `translate(${Math.sin(performance.now() / 180) * strength * 75}px, ${-strength * 115}px) scale(${1 + strength * 0.35})`,
  }
})

let stream
let audioContext
let source
let analyser
let samples
let frameId = null
let requestId = 0

function animate() {
  frameId = null
  if (status.value !== 'running') return
  analyser.getByteTimeDomainData(samples)
  volume.value = calculateVolume(samples)
  frameId = requestAnimationFrame(animate)
}

function stop() {
  requestId++
  status.value = nextVoiceStatus(status.value, 'stop')
  if (frameId !== null) cancelAnimationFrame(frameId)
  frameId = null
  volume.value = 0
  if (stream) {
    for (const track of stream.getTracks()) {
      track.removeEventListener('ended', stop)
      track.stop()
    }
    stream = undefined
  }
  source?.disconnect()
  analyser?.disconnect()
  source = undefined
  analyser = undefined
  samples = undefined
  if (audioContext) {
    void audioContext.close().catch(() => {})
    audioContext = undefined
  }
}

async function start() {
  if (status.value !== 'idle') return
  error.value = ''
  if (!navigator.mediaDevices?.getUserMedia) {
    error.value = '当前浏览器不支持麦克风，或页面未使用安全连接。'
    return
  }
  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  if (!AudioContextClass) {
    error.value = '当前浏览器不支持 Web Audio，无法分析声音。'
    return
  }
  status.value = nextVoiceStatus(status.value, 'start')
  const id = ++requestId
  try {
    const requestedStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    if (id !== requestId) {
      requestedStream.getTracks().forEach((track) => track.stop())
      return
    }
    stream = requestedStream
    audioContext = new AudioContextClass()
    source = audioContext.createMediaStreamSource(stream)
    analyser = audioContext.createAnalyser()
    analyser.fftSize = 1024
    source.connect(analyser)
    samples = new Uint8Array(analyser.fftSize)
    if (audioContext.state === 'suspended') await audioContext.resume()
    if (id !== requestId) return
    stream.getTracks().forEach((track) => track.addEventListener('ended', stop))
    status.value = nextVoiceStatus(status.value, 'granted')
    frameId = requestAnimationFrame(animate)
  } catch (cause) {
    if (id !== requestId) return
    stop()
    error.value =
      cause?.name === 'NotAllowedError' || cause?.name === 'PermissionDeniedError'
        ? '麦克风权限未获授权。请在浏览器中允许后重试。'
        : '无法启动麦克风。请检查设备连接和浏览器权限后重试。'
  }
}

function handleVisibility() {
  if (document.hidden) stop()
}

onMounted(() => document.addEventListener('visibilitychange', handleVisibility))
onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', handleVisibility)
  stop()
})
</script>

<template>
  <ToolPageHeader
    title="声控弹力球"
    description="点击启动并允许麦克风，让球体随着周围的声音弹跳。"
    privacy-note="仅在点击启动后请求麦克风。声音只在浏览器内分析，不上传、不录制、不保存。"
  />
  <section class="card tool-panel" aria-label="声控弹力球">
    <div class="voice-stage" aria-hidden="true">
      <div class="voice-ball" :style="ballStyle"></div>
    </div>
    <div class="tool-actions">
      <ElButton type="primary" :disabled="status !== 'idle'" @click="start">启动麦克风</ElButton>
      <ElButton :disabled="status === 'idle'" @click="stop">停止</ElButton>
      <span role="status" aria-live="polite">状态：{{ statusText }}</span>
      <span v-if="status === 'running'">音量：{{ Math.round(volume * 100) }}%</span>
    </div>
    <p v-if="error" class="tool-error" role="alert">{{ error }}</p>
    <p class="privacy-note">
      停止、离开页面或隐藏标签页时，会立即关闭麦克风和音频分析，并取消动画帧。
    </p>
  </section>
</template>

<style scoped>
.voice-stage {
  display: grid;
  place-items: center;
  height: 320px;
  overflow: hidden;
  border: 1px solid #b9cef2;
  border-radius: 12px;
  background: radial-gradient(circle at center, #fff 0%, #eaf2ff 75%);
}
.voice-ball {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #a7d4ff, #3275df 65%, #194995);
  box-shadow: 0 18px 28px #214e9d48;
  transition: transform 70ms linear;
}
</style>
