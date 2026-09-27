import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { ElButton, ElTag } from 'element-plus'
import { routes } from '../router'
import MikutapView from '../views/tools/fun/MikutapView.vue'
import OnlinePianoView from '../views/tools/fun/OnlinePianoView.vue'
import RandomAvatarView from '../views/tools/fun/RandomAvatarView.vue'
import VoiceBallView from '../views/tools/fun/VoiceBallView.vue'
import ToolCard from '../components/ToolCard.vue'

let wrapper
let frames
let nextFrameId

beforeEach(() => {
  frames = new Map()
  nextFrameId = 0
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

function mockAudio() {
  const close = vi.fn().mockResolvedValue(undefined)
  const gain = {
    gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    connect: vi.fn(),
    disconnect: vi.fn(),
  }
  const oscillator = {
    frequency: { setValueAtTime: vi.fn() },
    connect: vi.fn(() => gain),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  }
  class AudioContextStub {
    state = 'running'
    currentTime = 0
    destination = {}
    close = close
    createGain = () => gain
    createOscillator = () => oscillator
  }
  vi.stubGlobal('AudioContext', AudioContextStub)
  return { close, oscillator }
}

it.each([
  ['mikutap', MikutapView],
  ['online-piano', OnlinePianoView],
  ['random-avatar', RandomAvatarView],
  ['voice-ball', VoiceBallView],
])('直达 /tools/%s 并通过目录卡片进入', async (slug, component) => {
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

it('Mikutap 点击产生粒子、波纹和本地声音，离开时释放资源', async () => {
  const context = {
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
  }
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context)
  const { close, oscillator } = mockAudio()
  open(MikutapView)
  await wrapper.get('.tap-stage').trigger('click', { clientX: 42, clientY: 54 })
  expect(wrapper.text()).toContain('已创作 1 个音符')
  expect(frames.size).toBe(1)
  const [frameId, frame] = frames.entries().next().value
  frames.delete(frameId)
  frame()
  expect(context.fill).toHaveBeenCalledTimes(20)
  expect(context.stroke).toHaveBeenCalledOnce()
  expect(oscillator.start).toHaveBeenCalledOnce()
  wrapper.unmount()
  wrapper = undefined
  expect(cancelAnimationFrame).toHaveBeenCalledOnce()
  expect(close).toHaveBeenCalledOnce()
  expect(frames.size).toBe(0)
})

it('在线钢琴支持键盘和点击，重复键忽略，离开时关闭音频', async () => {
  const { close, oscillator } = mockAudio()
  open(OnlinePianoView)
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))
  await flushPromises()
  expect(wrapper.get('.piano-key.is-active').attributes('aria-label')).toContain('C4')
  expect(oscillator.frequency.setValueAtTime).toHaveBeenCalledWith(261.63, 0)
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', repeat: true }))
  expect(oscillator.start).toHaveBeenCalledOnce()
  await wrapper.get('.piano-key:last-child').trigger('click')
  expect(oscillator.frequency.setValueAtTime).toHaveBeenCalledWith(493.88, 0)
  wrapper.unmount()
  wrapper = undefined
  expect(close).toHaveBeenCalledOnce()
})

it('随机头像可重新生成并下载本地 SVG', async () => {
  const random = vi.spyOn(Math, 'random').mockReturnValue(0)
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  open(RandomAvatarView)
  const first = wrapper.get('.avatar-preview img').attributes('src')
  expect(decodeURIComponent(first)).toContain('<svg')
  random.mockReturnValue(0.99)
  await wrapper
    .findAll('button')
    .find((button) => button.text() === '重新生成')
    .trigger('click')
  const second = wrapper.get('.avatar-preview img').attributes('src')
  expect(second).not.toBe(first)
  await wrapper
    .findAll('button')
    .find((button) => button.text() === '下载 SVG')
    .trigger('click')
  expect(click).toHaveBeenCalledOnce()
  expect(click.mock.instances[0].download).toBe('win-tools-avatar.svg')
  expect(decodeURIComponent(click.mock.instances[0].href)).toContain('<svg')
  expect(document.querySelector('a[download="win-tools-avatar.svg"]')).toBeNull()
})

it('声控弹力球只在点击后请求权限，运行和停止时释放设备及动画', async () => {
  let grant
  const getUserMedia = vi.fn(() => new Promise((resolve) => (grant = resolve)))
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } })
  const track = { stop: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn() }
  const stream = { getTracks: () => [track] }
  const source = { connect: vi.fn(), disconnect: vi.fn() }
  const analyser = {
    fftSize: 0,
    connect: vi.fn(),
    disconnect: vi.fn(),
    getByteTimeDomainData: vi.fn((array) => array.fill(255)),
  }
  const close = vi.fn().mockResolvedValue(undefined)
  class AudioContextStub {
    state = 'running'
    close = close
    createMediaStreamSource = () => source
    createAnalyser = () => analyser
  }
  vi.stubGlobal('AudioContext', AudioContextStub)
  open(VoiceBallView)
  expect(getUserMedia).not.toHaveBeenCalled()
  expect(wrapper.text()).toContain('状态：未启动')
  await wrapper
    .findAll('button')
    .find((button) => button.text() === '启动麦克风')
    .trigger('click')
  expect(getUserMedia).toHaveBeenCalledWith({ audio: true })
  expect(wrapper.text()).toContain('状态：等待授权')
  grant(stream)
  await flushPromises()
  expect(wrapper.text()).toContain('状态：运行中')
  const [id, frame] = frames.entries().next().value
  frames.delete(id)
  frame()
  await flushPromises()
  expect(wrapper.text()).toContain('音量：99%')
  expect(frames.size).toBe(1)
  await wrapper
    .findAll('button')
    .find((button) => button.text() === '停止')
    .trigger('click')
  expect(wrapper.text()).toContain('状态：未启动')
  expect(track.stop).toHaveBeenCalledOnce()
  expect(source.disconnect).toHaveBeenCalledOnce()
  expect(analyser.disconnect).toHaveBeenCalledOnce()
  expect(close).toHaveBeenCalledOnce()
  expect(frames.size).toBe(0)
})

it('权限拒绝给出提示，停止等待后迟到的授权也会关闭麦克风', async () => {
  const denial = Object.assign(new Error('Denied'), { name: 'NotAllowedError' })
  const getUserMedia = vi.fn().mockRejectedValueOnce(denial)
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } })
  vi.stubGlobal('AudioContext', class {})
  open(VoiceBallView)
  await wrapper
    .findAll('button')
    .find((button) => button.text() === '启动麦克风')
    .trigger('click')
  await flushPromises()
  expect(wrapper.text()).toContain('麦克风权限未获授权')
  expect(wrapper.text()).toContain('状态：未启动')

  let grant
  getUserMedia.mockImplementationOnce(() => new Promise((resolve) => (grant = resolve)))
  await wrapper
    .findAll('button')
    .find((button) => button.text() === '启动麦克风')
    .trigger('click')
  await wrapper
    .findAll('button')
    .find((button) => button.text() === '停止')
    .trigger('click')
  const track = { stop: vi.fn() }
  grant({ getTracks: () => [track] })
  await flushPromises()
  expect(track.stop).toHaveBeenCalledOnce()
  expect(wrapper.text()).toContain('状态：未启动')
})
