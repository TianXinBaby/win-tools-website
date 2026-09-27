<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import ToolPageHeader from '../../../components/ToolPageHeader.vue'
import { createMagicParticles, magicKeyFromEvent } from '../../../utils/tools/fun/magicKeyboard'

const stage = ref(null)
const canvas = ref(null)
const lastKey = ref('按下任意按键')
const keyColor = ref('#397cf0')
const soundEnabled = ref(false)
const soundError = ref('')
const demoKeys = [
  { key: 'A', label: 'A' },
  { key: 'S', label: 'S' },
  { key: 'D', label: 'D' },
  { key: '1', label: '1' },
  { key: '2', label: '2' },
  { key: ' ', label: '空格' },
  { key: 'Enter', label: '回车' },
]

let context
let audioContext
let frameId = null
let particles = []
let width = 320
let height = 240

function resizeCanvas() {
  if (!stage.value || !canvas.value || !context) return
  width = stage.value.clientWidth || 320
  height = stage.value.clientHeight || 240
  const scale = Math.min(window.devicePixelRatio || 1, 2)
  canvas.value.width = Math.round(width * scale)
  canvas.value.height = Math.round(height * scale)
  context.setTransform(scale, 0, 0, scale, 0, 0)
}

function animate() {
  frameId = null
  context.clearRect(0, 0, width, height)
  particles = particles.filter((particle) => particle.life > 0)
  for (const particle of particles) {
    particle.x += particle.vx
    particle.y += particle.vy
    particle.vy += 0.04
    particle.life--
    context.globalAlpha = particle.life / particle.maxLife
    context.fillStyle = particle.color
    context.beginPath()
    context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2)
    context.fill()
  }
  context.globalAlpha = 1
  if (particles.length) frameId = requestAnimationFrame(animate)
}

function releaseAudio() {
  if (audioContext) {
    void audioContext.close().catch(() => {})
    audioContext = undefined
  }
}

function playTone(label) {
  if (!soundEnabled.value) return
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    audioContext ??= new AudioContextClass()
    if (audioContext.state === 'suspended') {
      void audioContext.resume().catch(() => {
        soundEnabled.value = false
        soundError.value = '当前浏览器无法播放声音，视觉效果仍可使用。'
        releaseAudio()
      })
    }
    const oscillator = audioContext.createOscillator()
    const gain = audioContext.createGain()
    const now = audioContext.currentTime
    oscillator.type = 'sine'
    oscillator.frequency.value = 300 + (label.codePointAt(0) % 18) * 35
    gain.gain.setValueAtTime(0.08, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18)
    oscillator.connect(gain).connect(audioContext.destination)
    oscillator.onended = () => {
      oscillator.disconnect()
      gain.disconnect()
    }
    oscillator.start(now)
    oscillator.stop(now + 0.18)
  } catch {
    soundEnabled.value = false
    soundError.value = '当前浏览器无法播放声音，视觉效果仍可使用。'
    releaseAudio()
  }
}

function fireKey(key) {
  lastKey.value = key.label
  keyColor.value = key.color
  if (context) {
    particles.push(...createMagicParticles(width, height, key.color))
    particles = particles.slice(-160)
    if (frameId === null) frameId = requestAnimationFrame(animate)
  }
  playTone(key.label)
}

function onKeyDown(event) {
  const key = magicKeyFromEvent(event)
  if (key) fireKey(key)
}

function triggerDemo(key) {
  const result = magicKeyFromEvent({ key })
  if (result) fireKey(result)
}

function toggleSound() {
  if (!soundEnabled.value && !window.AudioContext && !window.webkitAudioContext) {
    soundError.value = '当前浏览器不支持 Web Audio，视觉效果仍可使用。'
    return
  }
  soundEnabled.value = !soundEnabled.value
  soundError.value = ''
  if (!soundEnabled.value) releaseAudio()
}

onMounted(() => {
  context = canvas.value?.getContext('2d')
  resizeCanvas()
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('resize', resizeCanvas)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('resize', resizeCanvas)
  if (frameId !== null) cancelAnimationFrame(frameId)
  particles = []
  releaseAudio()
})
</script>

<template>
  <ToolPageHeader
    title="魔法键盘"
    description="按下字母、数字或特殊按键，看颜色和粒子跟着变化。触屏设备可点击下方示例按键。"
  />
  <section class="card tool-panel" aria-label="魔法键盘">
    <div class="tool-actions">
      <ElButton :aria-pressed="soundEnabled" @click="toggleSound">
        声音：{{ soundEnabled ? '开启' : '关闭' }}
      </ElButton>
      <span class="magic-hint">声音由浏览器本地合成，初始为关闭。</span>
    </div>
    <p v-if="soundError" class="tool-error" role="alert">{{ soundError }}</p>
    <div ref="stage" class="magic-stage" :style="{ '--magic-color': keyColor }">
      <canvas ref="canvas" class="magic-canvas" aria-hidden="true"></canvas>
      <strong class="magic-key" role="status" aria-live="polite">{{ lastKey }}</strong>
    </div>
    <div class="magic-demo" aria-label="触屏示例按键">
      <button
        v-for="item in demoKeys"
        :key="item.label"
        type="button"
        class="magic-demo-key"
        @click="triggerDemo(item.key)"
      >
        {{ item.label }}
      </button>
    </div>
    <p class="magic-hint">粒子只在按键后绘制；离开页面会停止动画并释放键盘监听和音频资源。</p>
  </section>
</template>

<style scoped>
.magic-stage {
  position: relative;
  display: grid;
  place-items: center;
  height: 260px;
  overflow: hidden;
  border: 1px solid #b4cafa;
  border-radius: 12px;
  background: radial-gradient(circle, #e6efff, #f6f9ff 65%);
}
.magic-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.magic-key {
  z-index: 1;
  max-width: 90%;
  color: var(--magic-color);
  font-size: clamp(1.7rem, 7vw, 3.5rem);
  text-align: center;
  overflow-wrap: anywhere;
}
.magic-demo {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.magic-demo-key {
  min-width: 42px;
  min-height: 42px;
  padding: 8px 12px;
  border: 1px solid #a7bee9;
  border-radius: 8px;
  background: #edf3ff;
  color: #214c9e;
  font: inherit;
  cursor: pointer;
}
.magic-demo-key:focus-visible {
  outline: 2px solid #245cd4;
  outline-offset: 2px;
}
.magic-hint {
  margin: 0;
  color: var(--muted);
  font-size: 0.9rem;
}
</style>
