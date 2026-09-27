<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import ToolPageHeader from '../../../components/ToolPageHeader.vue'
import {
  appendTapParticles,
  createTapParticles,
  TAP_COLORS,
} from '../../../utils/tools/fun/mikutap'

const stage = ref(null)
const canvas = ref(null)
const currentColor = ref(TAP_COLORS[0])
const soundError = ref('')
const tapCount = ref(0)
let drawing
let audioContext
let frameId = null
let particles = []
let ripples = []
let width = 320
let height = 300

function resizeCanvas() {
  if (!stage.value || !canvas.value || !drawing) return
  width = stage.value.clientWidth || 320
  height = stage.value.clientHeight || 300
  const scale = Math.min(window.devicePixelRatio || 1, 2)
  canvas.value.width = Math.round(width * scale)
  canvas.value.height = Math.round(height * scale)
  drawing.setTransform(scale, 0, 0, scale, 0, 0)
}

function animate() {
  frameId = null
  drawing.clearRect(0, 0, width, height)
  particles = particles.filter((particle) => particle.life > 0)
  for (const particle of particles) {
    particle.x += particle.vx
    particle.y += particle.vy
    particle.vy += 0.025
    particle.life--
    drawing.globalAlpha = particle.life / particle.maxLife
    drawing.fillStyle = particle.color
    drawing.beginPath()
    drawing.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2)
    drawing.fill()
  }
  ripples = ripples.filter((ripple) => ripple.life > 0)
  for (const ripple of ripples) {
    ripple.life--
    drawing.globalAlpha = ripple.life / ripple.maxLife
    drawing.strokeStyle = ripple.color
    drawing.lineWidth = 3
    drawing.beginPath()
    drawing.arc(ripple.x, ripple.y, (1 - ripple.life / ripple.maxLife) * 100, 0, Math.PI * 2)
    drawing.stroke()
  }
  drawing.globalAlpha = 1
  if (particles.length || ripples.length) frameId = requestAnimationFrame(animate)
}

function stopEffects() {
  if (frameId !== null) cancelAnimationFrame(frameId)
  frameId = null
  particles = []
  ripples = []
  drawing?.clearRect(0, 0, width, height)
  if (audioContext) {
    void audioContext.close().catch(() => {})
    audioContext = undefined
  }
}

function playSound(index) {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) throw new Error('Web Audio unavailable')
    audioContext ??= new AudioContextClass()
    if (audioContext.state === 'suspended') {
      void audioContext.resume().catch(() => {
        soundError.value = '浏览器未能播放声音，请再次点击画面。'
      })
    }
    const oscillator = audioContext.createOscillator()
    const gain = audioContext.createGain()
    const now = audioContext.currentTime
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime([261.63, 329.63, 392, 493.88, 587.33][index], now)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.018)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38)
    oscillator.connect(gain).connect(audioContext.destination)
    oscillator.onended = () => {
      oscillator.disconnect()
      gain.disconnect()
    }
    oscillator.start(now)
    oscillator.stop(now + 0.39)
    soundError.value = ''
  } catch {
    soundError.value = '当前浏览器无法播放声音，仍可使用视觉效果。'
  }
}

function tapAt(x, y) {
  const index = Math.floor(Math.random() * TAP_COLORS.length)
  const color = TAP_COLORS[index]
  currentColor.value = color
  tapCount.value++
  if (drawing) {
    particles = appendTapParticles(particles, createTapParticles(x, y, color))
    ripples = [...ripples, { x, y, color, life: 38, maxLife: 38 }].slice(-12)
    if (frameId === null) frameId = requestAnimationFrame(animate)
  }
  playSound(index)
}

function handleTap(event) {
  const bounds = stage.value.getBoundingClientRect()
  tapAt(event.clientX - bounds.left, event.clientY - bounds.top)
}

function tapCenter() {
  tapAt(width / 2, height / 2)
}

function handleVisibility() {
  if (document.hidden) stopEffects()
}

onMounted(() => {
  drawing = canvas.value?.getContext('2d')
  resizeCanvas()
  window.addEventListener('resize', resizeCanvas)
  document.addEventListener('visibilitychange', handleVisibility)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeCanvas)
  document.removeEventListener('visibilitychange', handleVisibility)
  stopEffects()
})
</script>

<template>
  <ToolPageHeader
    title="Mikutap"
    description="点击画面，让本地合成的音符、颜色、粒子和圆形波纹一起出现。"
  />
  <section class="card tool-panel" aria-label="Mikutap">
    <div
      ref="stage"
      class="tap-stage"
      :style="{ '--tap-color': currentColor }"
      role="button"
      tabindex="0"
      aria-label="点击或按回车键创造音乐和动画"
      @click="handleTap"
      @keydown.enter.prevent="tapCenter"
      @keydown.space.prevent="tapCenter"
    >
      <canvas ref="canvas" class="tap-canvas" aria-hidden="true"></canvas>
      <span class="tap-prompt" aria-hidden="true">点击画面，开始创作</span>
    </div>
    <div class="tool-actions">
      <span role="status">已创作 {{ tapCount }} 个音符</span>
    </div>
    <p v-if="soundError" class="tool-error" role="alert">{{ soundError }}</p>
    <p class="privacy-note">
      声音由 Web Audio 在浏览器内实时生成。切换页面或隐藏标签页时会停止动画并关闭音频。
    </p>
  </section>
</template>

<style scoped>
.tap-stage {
  position: relative;
  display: grid;
  place-items: center;
  height: clamp(300px, 45vw, 440px);
  overflow: hidden;
  border: 1px solid #b4cafa;
  border-radius: 14px;
  background: radial-gradient(circle at center, #fff 0%, #eaf1ff 60%, var(--tap-color) 200%);
  cursor: pointer;
  user-select: none;
}
.tap-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.tap-prompt {
  color: #1e427f;
  font-size: clamp(1.2rem, 3vw, 1.8rem);
  font-weight: 700;
  pointer-events: none;
}
</style>
