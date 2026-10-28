import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { ElAlert, ElButton, ElEmpty, ElSkeleton, ElTag } from 'element-plus'
import App from '../App.vue'
import { routes, installToolHistory } from '../router'
import { getTools, getToolDetail } from '../api/tools'
import { getWindows } from '../api/windows'
import { getArticles } from '../api/articles'
import { RECENT_KEY, refreshToolPreferences } from '../utils/toolPreferences'

vi.mock('../api/windows', () => ({ getWindows: vi.fn() }))
vi.mock('../api/tools', () => ({ getTools: vi.fn(), getToolDetail: vi.fn() }))
vi.mock('../api/articles', () => ({ getArticles: vi.fn() }))

const tools = [
  { id: 1, slug: 'qrcode', name: '二维码生成', description: '本地生成图片', category: 'media' },
  { id: 2, slug: 'nickname-generator', name: '随机昵称', description: '娱乐工具', category: 'fun' },
  { id: 3, slug: 'json', name: 'JSON 格式化', description: '处理数据', category: 'developer' },
  {
    id: 4,
    slug: 'image-compress',
    name: '图片压缩',
    description: '本地调整图片',
    category: 'media',
  },
  { id: 5, slug: 'future-tool', name: '未来工具', description: '功能介绍', category: 'custom' },
]
let wrapper
let disposeHistory

beforeEach(() => {
  localStorage.clear()
  refreshToolPreferences()
  vi.resetAllMocks()
  getTools.mockResolvedValue(tools)
  getToolDetail.mockResolvedValue(tools[4])
  getWindows.mockResolvedValue([])
  getArticles.mockResolvedValue([])
})

afterEach(() => {
  wrapper?.unmount()
  disposeHistory?.()
  wrapper = undefined
  disposeHistory = undefined
})

async function open(path) {
  const router = createRouter({ history: createMemoryHistory(), routes })
  disposeHistory = installToolHistory(router)
  await router.push(path)
  await router.isReady()
  wrapper = mount(App, {
    global: { plugins: [router, ElAlert, ElButton, ElEmpty, ElSkeleton, ElTag] },
  })
  await flushPromises()
  return router
}

describe('Phase 11.12 页面体验', () => {
  it('首页搜索即时更新结果，热门组件按真实目录展示，分类可跳过滤列表', async () => {
    const router = await open('/')
    const popular = wrapper.get('[aria-labelledby="popular-tools-title"]')
    expect(popular.findAll('.compact-tool-card h3').map((item) => item.text())).toEqual([
      'JSON 格式化',
      '图片压缩',
      '二维码生成',
      '随机昵称',
    ])
    expect(wrapper.get('[aria-labelledby="recent-tools-title"]').text()).toContain('打开一个工具后')
    expect(wrapper.get('.category-nav a[href="/tools?category=media"]').text()).toContain(
      '媒体工具',
    )

    await wrapper.get('.hero-search input').setValue('二维码')
    const results = wrapper.get('[aria-labelledby="home-search-title"]')
    expect(results.findAll('.compact-tool-card h3').map((item) => item.text())).toEqual([
      '二维码生成',
    ])
    expect(results.get('a[href="/tools?q=%E4%BA%8C%E7%BB%B4%E7%A0%81"]').exists()).toBe(true)
    await wrapper.get('.category-nav a[href="/tools?category=media"]').trigger('click')
    await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('tools'))
    await flushPromises()
    expect(wrapper.get('select').element.value).toBe('media')
    expect(wrapper.findAll('.compact-tool-card')).toHaveLength(2)
  })

  it('工具目录搜索名称和描述，可组合分类且提示无结果', async () => {
    await open('/tools')
    await wrapper.get('input[type="search"]').setValue('数据')
    expect(wrapper.findAll('.compact-tool-card h3').map((item) => item.text())).toEqual([
      'JSON 格式化',
    ])
    await wrapper.get('select').setValue('media')
    expect(wrapper.text()).toContain('没有找到符合条件的工具')
    await wrapper.get('input[type="search"]').setValue('图片')
    expect(wrapper.findAll('.compact-tool-card h3').map((item) => item.text())).toEqual([
      '二维码生成',
      '图片压缩',
    ])
  })

  it('工具卡片收藏后可在收藏页查看，并可取消收藏', async () => {
    const router = await open('/tools')
    const jsonCard = wrapper
      .findAll('.compact-tool-card')
      .find((item) => item.text().includes('JSON'))
    await jsonCard.get('.favorite-button').trigger('click')
    expect(jsonCard.get('.favorite-button').attributes('aria-pressed')).toBe('true')
    await router.push('/favorites')
    await flushPromises()
    expect(wrapper.get('h1').text()).toBe('我的收藏')
    expect(wrapper.findAll('.compact-tool-card h3').map((item) => item.text())).toEqual([
      'JSON 格式化',
    ])
    await wrapper.get('.favorite-button').trigger('click')
    expect(wrapper.findAll('.compact-tool-card')).toHaveLength(0)
    expect(wrapper.text()).toContain('还没有收藏的工具')
  })

  it('进入具体工具和有效通用详情后记录最近使用，失败详情不记录', async () => {
    const router = await open('/tools/json')
    expect(JSON.parse(localStorage.getItem(RECENT_KEY))).toEqual(['json'])
    await router.push('/')
    await flushPromises()
    expect(wrapper.get('[aria-labelledby="recent-tools-title"] h3').text()).toBe('JSON 格式化')
    await router.push('/tools/future-tool')
    await flushPromises()
    expect(JSON.parse(localStorage.getItem(RECENT_KEY))).toEqual(['future-tool', 'json'])
    getToolDetail.mockRejectedValueOnce(new Error('未找到该工具'))
    await router.push('/tools/missing')
    await flushPromises()
    expect(JSON.parse(localStorage.getItem(RECENT_KEY))).toEqual(['future-tool', 'json'])
  })
})
