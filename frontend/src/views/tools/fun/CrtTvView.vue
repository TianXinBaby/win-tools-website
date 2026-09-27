<script setup>
import { ref } from 'vue'
import ToolPageHeader from '../../../components/ToolPageHeader.vue'

const effectEnabled = ref(true)

function toggleEffect() {
  effectEnabled.value = !effectEnabled.value
}
</script>

<template>
  <ToolPageHeader
    title="老电视模拟器"
    description="在本地画面上体验黑白、扫描线、噪点与轻微闪烁的 CRT 效果。"
  />
  <section class="card tool-panel" aria-label="老电视模拟器">
    <div class="tool-actions">
      <ElButton type="primary" :aria-pressed="effectEnabled" @click="toggleEffect">
        {{ effectEnabled ? '关闭效果' : '开启效果' }}
      </ElButton>
      <span role="status">效果{{ effectEnabled ? '已开启' : '已关闭' }}</span>
    </div>
    <div class="crt-frame">
      <div
        class="crt-screen"
        :class="{ 'crt-active': effectEnabled }"
        role="img"
        aria-label="复古电视测试画面"
      >
        <div class="crt-picture">
          <p class="crt-label">WIN TOOLS · CHANNEL 03</p>
          <h2>昨日的信号</h2>
          <p>把时间调回老电视的年代</p>
          <div class="crt-bars" aria-hidden="true">
            <span v-for="index in 6" :key="index"></span>
          </div>
          <p class="crt-footer">■ PLAY 00:11:03</p>
        </div>
      </div>
      <div class="crt-controls" aria-hidden="true">● ○ ○</div>
    </div>
    <p class="crt-note">效果仅由浏览器 CSS 绘制；关闭后停止闪烁和噪点动画。</p>
  </section>
</template>

<style scoped>
.crt-frame {
  padding: clamp(12px, 4vw, 26px);
  border: 8px solid #273856;
  border-radius: 26px;
  background: #15243e;
  box-shadow: 0 16px 30px #17294324;
}
.crt-screen {
  position: relative;
  min-height: 290px;
  overflow: hidden;
  border: 5px solid #0c172a;
  border-radius: 24px / 36px;
  background: #163b74;
  color: #fff;
}
.crt-picture {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 290px;
  padding: 22px;
  text-align: center;
  background: radial-gradient(circle at 50% 45%, #4086d3, #163b74 72%);
}
.crt-picture h2 {
  margin: 10px 0;
  font-size: clamp(1.6rem, 5vw, 2.6rem);
}
.crt-picture p {
  margin: 4px 0;
}
.crt-label,
.crt-footer {
  font-family: ui-monospace, Consolas, monospace;
  letter-spacing: 0.08em;
}
.crt-bars {
  display: flex;
  width: min(340px, 90%);
  height: 38px;
  margin: 18px 0;
}
.crt-bars span {
  flex: 1;
}
.crt-bars span:nth-child(1) {
  background: #e34954;
}
.crt-bars span:nth-child(2) {
  background: #e5ac35;
}
.crt-bars span:nth-child(3) {
  background: #55aa61;
}
.crt-bars span:nth-child(4) {
  background: #3eb9c1;
}
.crt-bars span:nth-child(5) {
  background: #5279d8;
}
.crt-bars span:nth-child(6) {
  background: #a86ac8;
}
.crt-active .crt-picture {
  filter: grayscale(1) contrast(1.3) brightness(0.9);
  animation: crt-flicker 3s infinite;
}
.crt-active::before,
.crt-active::after {
  position: absolute;
  z-index: 1;
  inset: 0;
  pointer-events: none;
  content: '';
}
.crt-active::before {
  background: repeating-linear-gradient(transparent 0 2px, #07122462 2px 4px);
}
.crt-active::after {
  opacity: 0.3;
  background-image:
    radial-gradient(#fff 0.7px, transparent 1px), radial-gradient(#000 0.7px, transparent 1px);
  background-size:
    7px 11px,
    11px 13px;
  animation: crt-noise 0.18s steps(2) infinite;
}
.crt-controls {
  margin-top: 12px;
  color: #b8c7e3;
  text-align: right;
}
.crt-note {
  margin: 0;
  color: var(--muted);
}
@keyframes crt-noise {
  50% {
    transform: translate(3px, -4px);
  }
}
@keyframes crt-flicker {
  47% {
    opacity: 1;
  }
  48% {
    opacity: 0.91;
  }
  49% {
    opacity: 1;
  }
}
</style>
