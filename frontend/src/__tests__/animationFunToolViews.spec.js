import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { ElButton, ElTag } from 'element-plus'
import { routes } from '../router'
import MagicKeyboardView from '../views/tools/fun/MagicKeyboardView.vue'
import CrtTvView from '../views/tools/fun/CrtTvView.vue'
import FpsTestView from '../views/tools/fun/FpsTestView.vue'
import TypingTestView from '../views/tools/fun/TypingTestView.vue'
import ToolCard from '../components/ToolCard.vue'
import { BEST_TYPING_KEY } from '../utils/tools/fun/typing'

let wrapper
let nextFrameId
let frames

beforeEach(() => {
  localStorage.clear()
  nextFrameId = 0
  frames = new Map()
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((callback) => {
      const id = ++nextFrameId
      frames.set(id, callback)
      return id
    }),
  )
  vi.stubGlobal(
    'cancelAnimationFrame',
    vi.fn((id) => frames.delete(id)),
  )
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
})

function open(component, props = {}) {
  wrapper = mount(component, {
    props,
    attachTo: document.body,
    global: {
      plugins: [createRouter({ history: createMemoryHistory(), routes }), ElButton, ElTag],
    },
  })
  return wrapper
}

function fireFrame(now) {
  const [id, callback] = frames.entries().next().value
  frames.delete(id)
  callback(now)
}

it.each([
  ['magic-keyboard', MagicKeyboardView],
  ['crt-tv', CrtTvView],
  ['fps-test', FpsTestView],
  ['typing-test', TypingTestView],
])('直达 /tools/%s 并通过工具卡片进入', async (slug, component) => {
  const router = createRouter({ history: createMemoryHistory(), routes })
  const path = `/tools/${slug}`
  await router.push(path)
  expect(router.currentRoute.value.name).toBe(`tool-${slug}`)
  const route = routes.find((entry) => entry.path === path)
  expect(routes.indexOf(route)).toBeLessThan(
    routes.findIndex((entry) => entry.path === '/tools/:slug'),
  )
  expect((await route.component()).default).toBe(component)
  open(ToolCard, { item: { slug, name: slug, path, category: 'fun' } })
  expect(wrapper.get('.card-link').attributes('href')).toBe(path)
  expect(wrapper.text()).toContain('已开放')
})

it('键盘按下显示按键并绘制粒子，离开页面取消帧和监听', async () => {
  const context = {
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    globalAlpha: 1,
    fillStyle: '',
  }
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context)
  const removeListener = vi.spyOn(window, 'removeEventListener')
  open(MagicKeyboardView)
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))
  await flushPromises()
  expect(wrapper.get('.magic-key').text()).toBe('A')
  expect(wrapper.get('.magic-stage').attributes('style')).toContain('#397cf0')
  expect(frames.size).toBe(1)
  fireFrame(16)
  expect(context.arc).toHaveBeenCalledTimes(20)
  window.dispatchEvent(new KeyboardEvent('keydown', { key: '7', repeat: true }))
  expect(wrapper.get('.magic-key').text()).toBe('A')
  await wrapper.get('.magic-demo-key:last-child').trigger('click')
  expect(wrapper.get('.magic-key').text()).toBe('回车')
  wrapper.unmount()
  wrapper = undefined
  expect(cancelAnimationFrame).toHaveBeenCalledOnce()
  expect(removeListener).toHaveBeenCalledWith('keydown', expect.any(Function))
  expect(frames.size).toBe(0)
})

it('启用本地合成声音后离开页面会关闭 AudioContext', async () => {
  const context = {
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
  }
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context)
  const close = vi.fn().mockResolvedValue(undefined)
  const gain = {
    gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
  }
  class AudioContextStub {
    state = 'running'
    currentTime = 0
    destination = {}
    close = close
    createGain() {
      return gain
    }
    createOscillator() {
      return {
        frequency: { value: 0 },
        connect: () => gain,
        start: vi.fn(),
        stop: vi.fn(),
        disconnect: vi.fn(),
      }
    }
  }
  vi.stubGlobal('AudioContext', AudioContextStub)
  open(MagicKeyboardView)
  await wrapper
    .findAll('button')
    .find((button) => button.text().includes('声音：关闭'))
    .trigger('click')
  window.dispatchEvent(new KeyboardEvent('keydown', { key: '1' }))
  wrapper.unmount()
  wrapper = undefined
  expect(close).toHaveBeenCalledOnce()
})

it('CRT 效果可关闭和重新开启', async () => {
  open(CrtTvView)
  expect(wrapper.get('.crt-screen').classes()).toContain('crt-active')
  await wrapper.get('button[aria-pressed="true"]').trigger('click')
  expect(wrapper.get('.crt-screen').classes()).not.toContain('crt-active')
  expect(wrapper.text()).toContain('效果已关闭')
  await wrapper.get('button[aria-pressed="false"]').trigger('click')
  expect(wrapper.get('.crt-screen').classes()).toContain('crt-active')
})

it('FPS 测试显示测量结果，停止后取消下一帧', async () => {
  open(FpsTestView)
  await wrapper
    .findAll('button')
    .find((button) => button.text() === '开始测试')
    .trigger('click')
  fireFrame(0)
  for (let index = 1; index <= 61; index++) fireFrame(index * (1000 / 60))
  await flushPromises()
  expect(Number(wrapper.get('.fps-stats strong').text())).toBeGreaterThan(55)
  expect(wrapper.text()).toContain('16.7 ms')
  expect(wrapper.text()).toContain('测试中')
  await wrapper
    .findAll('button')
    .find((button) => button.text() === '停止测试')
    .trigger('click')
  expect(frames.size).toBe(0)
  expect(cancelAnimationFrame).toHaveBeenCalledOnce()
  expect(wrapper.text()).toContain('已停止')
})

it('打字测试完成后保存最佳成绩，重置与重新打开仍能读取', async () => {
  const now = vi.spyOn(performance, 'now').mockReturnValue(1000)
  open(TypingTestView)
  await wrapper
    .findAll('button')
    .find((button) => button.text() === '开始')
    .trigger('click')
  const target = wrapper.get('.typing-prompt').element.textContent
  await wrapper.get('#typing-input').setValue(target[0])
  now.mockReturnValue(61000)
  await wrapper.get('#typing-input').setValue(target)
  expect(wrapper.text()).toContain('测试完成！')
  expect(wrapper.text()).toContain('100%')
  expect(wrapper.text()).toContain('60 秒')
  expect(JSON.parse(localStorage.getItem(BEST_TYPING_KEY)).accuracy).toBe(100)
  await wrapper
    .findAll('button')
    .find((button) => button.text() === '重置')
    .trigger('click')
  expect(wrapper.text()).toContain('准备开始')
  expect(wrapper.text()).toContain('最佳成绩：')
  wrapper.unmount()
  wrapper = undefined
  open(TypingTestView)
  await flushPromises()
  expect(wrapper.text()).toContain('100%')
})
