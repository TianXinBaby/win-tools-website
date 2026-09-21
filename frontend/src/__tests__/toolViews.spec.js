import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { webcrypto } from 'node:crypto'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { ElButton, ElTag } from 'element-plus'
import { routes } from '../router'
import JsonToolView from '../views/tools/JsonToolView.vue'
import UuidToolView from '../views/tools/UuidToolView.vue'
import TimestampToolView from '../views/tools/TimestampToolView.vue'
import Sha256ToolView from '../views/tools/Sha256ToolView.vue'
import Base64ToolView from '../views/tools/Base64ToolView.vue'
import ToolDetailView from '../views/ToolDetailView.vue'
import CopyButton from '../components/CopyButton.vue'
import ToolCard from '../components/ToolCard.vue'
import { formatLocalDateTime } from '../utils/tools/timestamp'

let wrapper
beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto)
})
afterEach(() => {
  wrapper?.unmount()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
function open(component, props = {}) {
  const router = createRouter({ history: createMemoryHistory(), routes })
  wrapper = mount(component, { props, global: { plugins: [router, ElButton, ElTag] } })
  return wrapper
}
async function click(label) {
  const button = wrapper.findAll('button').find((item) => item.text() === label)
  expect(button, `按钮 ${label}`).toBeDefined()
  await button.trigger('click')
  await flushPromises()
}

it('JSON 格式化、压缩、错误恢复和清空', async () => {
  open(JsonToolView)
  await wrapper.get('#json-input').setValue('{"a": [1,true]}')
  await click('格式化')
  expect(wrapper.get('#json-output').element.value).toBe('{\n  "a": [\n    1,\n    true\n  ]\n}')
  await click('压缩')
  expect(wrapper.get('#json-output').element.value).toBe('{"a":[1,true]}')
  await wrapper.get('#json-input').setValue('{bad')
  await click('格式化')
  expect(wrapper.get('[role="alert"]').text()).toBe('JSON 格式不正确，请检查输入内容。')
  expect(wrapper.get('#json-output').element.value).toBe('')
  await wrapper.get('#json-input').setValue('null')
  expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  await click('格式化')
  expect(wrapper.get('#json-output').element.value).toBe('null')
  await click('清空')
  expect(wrapper.get('#json-input').element.value).toBe('')
  expect(wrapper.get('#json-output').element.value).toBe('')
})

it('UUID 单个、批量、重新生成、数量约束、清空', async () => {
  open(UuidToolView)
  await click('生成 UUID')
  expect(wrapper.get('#uuid-output').element.value.split('\n')).toHaveLength(1)
  await click('20 个')
  await click('重新生成')
  expect(wrapper.get('#uuid-output').element.value.split('\n')).toHaveLength(20)
  await wrapper.get('#uuid-count').setValue('101')
  await click('重新生成')
  expect(wrapper.get('[role="alert"]').text()).toContain('1 到 100')
  expect(wrapper.get('#uuid-output').element.value).toBe('')
  await click('清空')
  expect(wrapper.get('#uuid-count').element.value).toBe('1')
  expect(wrapper.find('[role="alert"]').exists()).toBe(false)
})

it('UUID 缺少随机 API 提示不支持', async () => {
  vi.stubGlobal('crypto', {})
  open(UuidToolView)
  await click('生成 UUID')
  expect(wrapper.get('[role="alert"]').text()).toBe('当前浏览器不支持此功能。')
})

it('时间戳显式单位、双向转换、错误处理和清空', async () => {
  open(TimestampToolView)
  await wrapper.get('#timestamp-input').setValue('-1')
  await click('转换为日期时间')
  expect(wrapper.get('#date-output').element.value).toBe(formatLocalDateTime(new Date(-1000)))
  await wrapper.get('#timestamp-unit').setValue('milliseconds')
  expect(wrapper.get('#date-output').element.value).toBe('')
  await click('转换为日期时间')
  expect(wrapper.get('#date-output').element.value).toBe(formatLocalDateTime(new Date(-1)))
  await wrapper.get('#date-input').setValue('2024-02-29T12:34:56.123')
  await click('转换为时间戳')
  const expected = new Date(2024, 1, 29, 12, 34, 56, 123).getTime()
  expect(wrapper.get('#timestamp-output').element.value).toBe(
    `Unix 秒：${Math.floor(expected / 1000)}\nUnix 毫秒：${expected}`,
  )
  await wrapper.get('#timestamp-input').setValue('nonsense')
  await click('转换为日期时间')
  expect(wrapper.get('[role="alert"]').text()).toContain('有效的整数')
  expect(wrapper.text()).not.toContain('Invalid Date')
  await click('清空')
  for (const id of ['timestamp-input', 'date-input', 'date-output', 'timestamp-output'])
    expect(wrapper.get(`#${id}`).element.value).toBe('')
  expect(wrapper.find('[role="alert"]').exists()).toBe(false)
})

it('当前时间使用固定时钟刷新，卸载清理定时器', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2024-01-01T00:00:00.123Z'))
  open(TimestampToolView)
  expect(wrapper.text()).toContain('1704067200123')
  expect(wrapper.text()).toContain('1704067200')
  await vi.advanceTimersByTimeAsync(1000)
  expect(wrapper.text()).toContain('1704067201123')
  const clear = vi.spyOn(globalThis, 'clearInterval')
  wrapper.unmount()
  expect(clear).toHaveBeenCalledOnce()
  wrapper = undefined
})

it('SHA-256 显示真实结果并可清空', async () => {
  open(Sha256ToolView)
  await wrapper.get('#sha256-input').setValue('abc')
  await click('计算 SHA-256')
  await vi.waitFor(() =>
    expect(wrapper.get('#sha256-output').element.value).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    ),
  )
  await click('清空')
  expect(wrapper.get('#sha256-input').element.value).toBe('')
  expect(wrapper.get('#sha256-output').element.value).toBe('')
})

it.each(['clear', 'edit'])('SHA-256 未完成时 %s 防止旧结果重新出现', async (action) => {
  let resolve
  vi.stubGlobal('crypto', {
    subtle: {
      digest: () =>
        new Promise((done) => {
          resolve = done
        }),
    },
  })
  open(Sha256ToolView)
  await wrapper.get('#sha256-input').setValue('abc')
  await click('计算 SHA-256')
  if (action === 'clear') await click('清空')
  else await wrapper.get('#sha256-input').setValue('new input')
  resolve(new Uint8Array(32).buffer)
  await flushPromises()
  expect(wrapper.get('#sha256-output').element.value).toBe('')
})

it.each([{}, { subtle: { digest: () => Promise.reject(new Error('private internal stack')) } }])(
  'SHA-256 API 缺失或失败提供安全错误',
  async (api) => {
    vi.stubGlobal('crypto', api)
    open(Sha256ToolView)
    await click('计算 SHA-256')
    expect(wrapper.get('[role="alert"]').text()).toMatch(/当前浏览器不支持此功能|计算失败/)
    expect(wrapper.text()).not.toContain('private internal stack')
  },
)

it('Base64 中文 emoji 往返、非法输入恢复、空字符串和清空', async () => {
  open(Base64ToolView)
  await wrapper.get('#base64-input').setValue('中文😀')
  await click('编码为 Base64')
  expect(wrapper.get('#base64-output').element.value).toBe('5Lit5paH8J+YgA==')
  await wrapper.get('#base64-input').setValue(wrapper.get('#base64-output').element.value)
  await click('解码为文本')
  expect(wrapper.get('#base64-output').element.value).toBe('中文😀')
  await wrapper.get('#base64-input').setValue('%%%')
  await click('解码为文本')
  expect(wrapper.get('[role="alert"]').text()).toContain('内容无法转换')
  expect(wrapper.text()).not.toContain('DOMException')
  await wrapper.get('#base64-input').setValue('')
  expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  await click('编码为 Base64')
  expect(wrapper.text()).toContain('结果为空字符串')
  await click('清空')
  expect(wrapper.get('#base64-input').element.value).toBe('')
  expect(wrapper.get('#base64-output').element.value).toBe('')
})

it('复制成功反馈并写入准确文本，结果变化清除旧提示', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('navigator', { clipboard: { writeText } })
  open(CopyButton, { text: '中文😀\nUUID' })
  await click('复制结果')
  expect(writeText).toHaveBeenCalledWith('中文😀\nUUID')
  expect(wrapper.get('[role="status"]').text()).toBe('复制成功。')
  await wrapper.setProps({ text: '' })
  expect(wrapper.get('[role="status"]').text()).toBe('')
})

it.each([undefined, { writeText: vi.fn().mockRejectedValue(new Error('Denied')) }])(
  '复制 API 缺失或失败反馈',
  async (clipboard) => {
    vi.stubGlobal('navigator', { clipboard })
    open(CopyButton, { text: 'abc' })
    await click('复制结果')
    expect(wrapper.get('[role="status"]').text()).toMatch(/不支持复制|复制失败/)
    expect(wrapper.text()).not.toContain('Denied')
  },
)

it('复制按钮禁用时不写入剪贴板', async () => {
  const writeText = vi.fn()
  vi.stubGlobal('navigator', { clipboard: { writeText } })
  open(CopyButton, { text: '', disabled: true })
  await click('复制结果')
  expect(writeText).not.toHaveBeenCalled()
})

it.each([
  ['json', JsonToolView],
  ['uuid', UuidToolView],
  ['timestamp', TimestampToolView],
  ['sha256', Sha256ToolView],
  ['base64', Base64ToolView],
])('具体路由 %s 位于动态路由之前并加载真实页面', async (slug, component) => {
  const router = createRouter({ history: createMemoryHistory(), routes })
  const path = `/tools/${slug}`
  await router.push(path)
  expect(router.currentRoute.value.name).toBe(`tool-${slug}`)
  const route = routes.find((entry) => entry.path === path)
  expect(routes.indexOf(route)).toBeLessThan(
    routes.findIndex((entry) => entry.path === '/tools/:slug'),
  )
  expect((await route.component()).default).toBe(component)
})

it('未知 slug 保留通用详情', async () => {
  const router = createRouter({ history: createMemoryHistory(), routes })
  await router.push('/tools/future-tool')
  expect(router.currentRoute.value.name).toBe('tool-detail')
  expect((await routes.find((entry) => entry.name === 'tool-detail').component()).default).toBe(
    ToolDetailView,
  )
})

it.each([
  ['/tools/json?from=catalog', '/tools/json?from=catalog'],
  ['/tools/uuid', '/tools/json'],
  ['https://example.com', '/tools/json'],
  ['javascript:alert(1)', '/tools/json'],
  ['/unimplemented', '/tools/json'],
])('工具卡片优先有效 path，异常 path 安全回退：%s', (path, expected) => {
  open(ToolCard, { item: { slug: 'json', name: 'JSON', path } })
  expect(wrapper.get('.card-link').attributes('href')).toBe(expected)
  expect(wrapper.text()).toContain('已开放')
})

it('未开放工具保留介绍链接', () => {
  open(ToolCard, { item: { slug: 'future-tool', name: '未来工具', path: '/tools/json' } })
  expect(wrapper.get('.card-link').attributes('href')).toBe('/tools/future-tool')
  expect(wrapper.text()).toContain('即将开放')
})
