import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { ElButton, ElTag } from 'element-plus'
import { routes } from '../router'
import NicknameGeneratorView from '../views/tools/fun/NicknameGeneratorView.vue'
import AsciiArtView from '../views/tools/fun/AsciiArtView.vue'
import LuckyWheelView from '../views/tools/fun/LuckyWheelView.vue'
import ReactionTestView from '../views/tools/fun/ReactionTestView.vue'
import ToolCard from '../components/ToolCard.vue'
import { BEST_REACTION_KEY } from '../utils/tools/fun/reaction'

let wrapper

beforeEach(() => localStorage.clear())
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
})

function open(component, props = {}) {
  wrapper = mount(component, {
    props,
    global: {
      plugins: [createRouter({ history: createMemoryHistory(), routes }), ElButton, ElTag],
    },
  })
  return wrapper
}

async function click(label) {
  const button = wrapper.findAll('button').find((entry) => entry.text() === label)
  expect(button, `按钮 ${label}`).toBeDefined()
  await button.trigger('click')
  await flushPromises()
}

it.each([
  ['nickname-generator', NicknameGeneratorView],
  ['ascii-art', AsciiArtView],
  ['lucky-wheel', LuckyWheelView],
  ['reaction-test', ReactionTestView],
])('直达 /tools/%s 加载真实页面，目录卡片可进入', async (slug, component) => {
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

it('昵称分类生成并复制，不上传或保存用户结果', async () => {
  vi.spyOn(Math, 'random').mockReturnValue(0)
  const writeText = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('navigator', { clipboard: { writeText } })
  open(NicknameGeneratorView)
  await click('生成昵称')
  expect(wrapper.get('.fun-result').text()).toBe('暗影游侠')
  await click('复制昵称')
  expect(writeText).toHaveBeenCalledWith('暗影游侠')
  await wrapper.get('#nickname-category').setValue('cute')
  expect(wrapper.text()).not.toContain('暗影游侠')
  await click('生成昵称')
  expect(wrapper.text()).toContain('软糖同学')
  expect(localStorage.length).toBe(0)
})

it('ASCII 生成、报错恢复、清空和复制', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('navigator', { clipboard: { writeText } })
  open(AsciiArtView)
  await wrapper.get('#ascii-input').setValue('A1')
  await click('生成艺术字')
  const art = wrapper.get('#ascii-output').element.textContent
  expect(art).toContain(' ###')
  await click('复制艺术字')
  expect(writeText).toHaveBeenCalledWith(art)
  await wrapper.get('#ascii-input').setValue('中文')
  await click('生成艺术字')
  expect(wrapper.get('[role="alert"]').text()).toContain('仅支持英文字母')
  expect(wrapper.get('#ascii-output').text()).toBe('')
  await click('清空')
  expect(wrapper.get('#ascii-input').element.value).toBe('')
  expect(wrapper.find('[role="alert"]').exists()).toBe(false)
})

it('转盘旋转后显示随机结果，重新开始并检查输入', async () => {
  vi.useFakeTimers()
  vi.spyOn(Math, 'random').mockReturnValue(0.5)
  open(LuckyWheelView)
  await click('开始旋转')
  expect(wrapper.get('#wheel-options').attributes('disabled')).toBeDefined()
  expect(wrapper.get('.wheel-disc').attributes('style')).toContain('rotate(')
  expect(wrapper.find('.fun-result').exists()).toBe(false)
  await vi.advanceTimersByTimeAsync(4000)
  await flushPromises()
  expect(wrapper.get('.fun-result').text()).toBe('选中：读书')
  await click('重新开始')
  expect(wrapper.find('.fun-result').exists()).toBe(false)
  await wrapper.get('#wheel-options').setValue('一个选项')
  await click('开始旋转')
  expect(wrapper.get('[role="alert"]').text()).toContain('2 到 12')
})

it('反应测试提前点击会取消，成绩和最佳成绩在浏览器内保存', async () => {
  vi.useFakeTimers()
  vi.spyOn(Math, 'random').mockReturnValue(0)
  vi.spyOn(performance, 'now').mockReturnValueOnce(1000).mockReturnValueOnce(1243.6)
  open(ReactionTestView)
  await click('开始测试')
  await click('等待变绿……请勿点击')
  expect(wrapper.get('[role="alert"]').text()).toContain('点早了')
  await vi.advanceTimersByTimeAsync(1500)
  expect(wrapper.find('.reaction-target.ready').exists()).toBe(false)
  await click('重新开始')
  await vi.advanceTimersByTimeAsync(1500)
  await flushPromises()
  await click('现在点击！')
  expect(wrapper.text()).toContain('本次反应时间：244 ms')
  expect(localStorage.getItem(BEST_REACTION_KEY)).toBe('244')
  wrapper.unmount()
  wrapper = undefined
  open(ReactionTestView)
  await flushPromises()
  expect(wrapper.text()).toContain('最佳成绩：244 ms')
  expect(wrapper.text()).toContain('localStorage')
})
