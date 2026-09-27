<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import ToolPageHeader from '../../../components/ToolPageHeader.vue'
import { PIANO_NOTES, pianoNoteFromEvent } from '../../../utils/tools/fun/onlinePiano'

const activeKey = ref('')
const soundError = ref('')
let audioContext
const timers = new Set()

function playNote(note) {
  activeKey.value = note.key
  const timer = setTimeout(() => {
    if (activeKey.value === note.key) activeKey.value = ''
    timers.delete(timer)
  }, 240)
  timers.add(timer)
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) throw new Error('Web Audio unavailable')
    audioContext ??= new AudioContextClass()
    if (audioContext.state === 'suspended') {
      void audioContext.resume().catch(() => {
        soundError.value = '浏览器未能播放声音，请再次按下琴键。'
      })
    }
    const oscillator = audioContext.createOscillator()
    const gain = audioContext.createGain()
    const now = audioContext.currentTime
    oscillator.type = 'triangle'
    oscillator.frequency.setValueAtTime(note.frequency, now)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65)
    oscillator.connect(gain).connect(audioContext.destination)
    oscillator.onended = () => {
      oscillator.disconnect()
      gain.disconnect()
    }
    oscillator.start(now)
    oscillator.stop(now + 0.66)
    soundError.value = ''
  } catch {
    soundError.value = '当前浏览器无法播放声音，请使用支持 Web Audio 的浏览器。'
  }
}

function handleKeyDown(event) {
  const note = pianoNoteFromEvent(event)
  if (note) playNote(note)
}

function releaseAudio() {
  for (const timer of timers) clearTimeout(timer)
  timers.clear()
  activeKey.value = ''
  if (audioContext) {
    void audioContext.close().catch(() => {})
    audioContext = undefined
  }
}

function handleVisibility() {
  if (document.hidden) releaseAudio()
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
  document.addEventListener('visibilitychange', handleVisibility)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeyDown)
  document.removeEventListener('visibilitychange', handleVisibility)
  releaseAudio()
})
</script>

<template>
  <ToolPageHeader
    title="在线钢琴"
    description="使用 A S D F G H J，或点击琴键，弹奏 C 大调音阶。"
  />
  <section class="card tool-panel" aria-label="在线钢琴">
    <div class="piano-keys" aria-label="C 大调钢琴键盘">
      <button
        v-for="note in PIANO_NOTES"
        :key="note.key"
        type="button"
        class="piano-key"
        :class="{ 'is-active': activeKey === note.key }"
        :aria-label="`${note.label} 音符，键盘 ${note.key.toUpperCase()}`"
        @click="playNote(note)"
      >
        <strong>{{ note.label }}</strong
        ><span>{{ note.key.toUpperCase() }}</span>
      </button>
    </div>
    <p v-if="soundError" class="tool-error" role="alert">{{ soundError }}</p>
    <p class="privacy-note">
      音符由 Web Audio 在本地合成，不加载音频文件。离开页面或隐藏标签页会关闭音频。
    </p>
  </section>
</template>

<style scoped>
.piano-keys {
  display: flex;
  gap: 3px;
  width: 100%;
  max-width: 720px;
  margin: 22px auto;
}
.piano-key {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  min-width: 0;
  height: clamp(160px, 28vw, 260px);
  padding: 16px 2px;
  border: 1px solid #9bb3de;
  border-radius: 0 0 9px 9px;
  background: linear-gradient(#fff, #e9f1ff);
  box-shadow: 0 6px 0 #b2c6eb;
  color: #204c9b;
  cursor: pointer;
  font: inherit;
}
.piano-key.is-active,
.piano-key:active {
  transform: translateY(5px);
  background: #c7dbff;
  box-shadow: 0 1px 0 #8da8da;
}
.piano-key span {
  color: #647797;
  font-size: 0.85rem;
}
</style>
