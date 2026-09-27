import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { ElAlert, ElButton, ElEmpty, ElSkeleton, ElTag } from 'element-plus'
import App from '../App.vue'
import { routes } from '../router'
import { getWindows, getWindowsDetail } from '../api/windows'
import { getTools, getToolDetail } from '../api/tools'
import { getArticles, getArticleDetail } from '../api/articles'

vi.mock('../api/windows', () => ({ getWindows: vi.fn(), getWindowsDetail: vi.fn() }))
vi.mock('../api/tools', () => ({ getTools: vi.fn(), getToolDetail: vi.fn() }))
vi.mock('../api/articles', () => ({ getArticles: vi.fn(), getArticleDetail: vi.fn() }))

const windows = {
  id: 1,
  name: 'Windows 示例',
  version: '示例版本',
  edition: '专业版',
  architecture: 'x64',
  releaseDate: '2025-01-01',
  description: '系统简介',
  sha256: 'a'.repeat(64),
  officialDownloadUrl: 'https://www.microsoft.com/software-download/windows11',
  imageUrl: '/windows.png',
}
const tool = {
  id: 2,
  slug: 'json',
  name: 'JSON 格式化',
  icon: '{}',
  category: 'developer',
  description: '工具介绍',
  path: '/unimplemented',
}
const article = {
  id: 3,
  title: '安全安装指南',
  summary: '文章摘要',
  content: '<img src=x onerror=alert(1)>\n第二行正文',
  category: 'guide',
  coverImage: '/cover.png',
  viewCount: 0,
  createdAt: '2025-01-01T12:00:00',
  updatedAt: '2025-01-02T12:00:00',
}
let wrapper

beforeEach(() => {
  vi.resetAllMocks()
  getWindows.mockResolvedValue([windows])
  getWindowsDetail.mockResolvedValue(windows)
  getTools.mockResolvedValue([tool])
  getToolDetail.mockResolvedValue(tool)
  getArticles.mockResolvedValue([article])
  getArticleDetail.mockResolvedValue(article)
})
afterEach(() => {
  wrapper?.unmount()
})

async function open(path) {
  const router = createRouter({ history: createMemoryHistory(), routes })
  await router.push(path)
  await router.isReady()
  wrapper = mount(App, {
    global: { plugins: [router, ElAlert, ElButton, ElEmpty, ElSkeleton, ElTag] },
  })
  return router
}

describe('页面及路由', () => {
  it('工具目录列出阶段 7 元数据并链接真实媒体工具', async () => {
    const slugs = ['qrcode', 'image-compress', 'image-resize', 'image-convert']
    getTools.mockResolvedValue(
      slugs.map((slug, i) => ({ ...tool, id: i + 10, slug, name: slug, path: `/tools/${slug}` })),
    )
    await open('/tools')
    await flushPromises()
    expect(wrapper.text()).toContain(
      '以及昵称、ASCII艺术、转盘、反应速度、魔法键盘、老电视、FPS、打字速度、Mikutap、在线钢琴、随机头像和声控弹力球',
    )
    for (const slug of slugs) {
      expect(wrapper.find(`a.card-link[href="/tools/${slug}"]`).exists()).toBe(true)
    }
    expect(wrapper.findAll('.tool-availability').map((entry) => entry.text())).toEqual(
      Array(4).fill('已开放 · 浏览器本地运行'),
    )
  })
  it.each([
    ['/', 'Windows 资源', 'home'],
    ['/windows', 'Windows 下载', 'windows'],
    ['/windows/1', windows.name, 'windows-detail'],
    ['/tools', '在线工具', 'tools'],
    ['/tools/future-tool', tool.name, 'tool-detail'],
    ['/articles', '教程文章', 'articles'],
    ['/articles/3', article.title, 'article-detail'],
    ['/missing/nested', '页面不存在', 'not-found'],
  ])('%s 正常渲染并保持统一布局', async (path, title, name) => {
    const router = await open(path)
    await flushPromises()
    expect(router.currentRoute.value.name).toBe(name)
    expect(wrapper.get('h1').text()).toContain(title)
    expect(wrapper.findAll('nav a')).toHaveLength(4)
    expect(wrapper.find('footer').exists()).toBe(true)
  })

  it.each([
    ['/windows', getWindows, [windows]],
    ['/tools', getTools, [tool]],
    ['/articles', getArticles, [article]],
    ['/windows/1', getWindowsDetail, windows],
    ['/tools/future-tool', getToolDetail, tool],
    ['/articles/3', getArticleDetail, article],
  ])('%s 显示加载、失败并可重试恢复', async (path, api, result) => {
    let rejectRequest
    api.mockReturnValueOnce(
      new Promise((resolve, reject) => {
        rejectRequest = reject
      }),
    )
    await open(path)
    expect(wrapper.get('[role="status"]').text()).toContain('正在加载')
    rejectRequest(new Error('加载失败，请稍后重试。'))
    await flushPromises()
    expect(wrapper.text()).toContain('加载失败，请稍后重试。')
    api.mockResolvedValueOnce(result)
    await wrapper.get('button.retry-button').trigger('click')
    await flushPromises()
    expect(api).toHaveBeenCalledTimes(2)
    expect(wrapper.find('.retry-button').exists()).toBe(false)
    expect(wrapper.find('article').exists()).toBe(true)
  })

  it.each([
    ['/windows', getWindows, []],
    ['/tools', getTools, []],
    ['/articles', getArticles, []],
    ['/windows/1', getWindowsDetail, null],
    ['/tools/future-tool', getToolDetail, null],
    ['/articles/3', getArticleDetail, null],
  ])('%s 处理空数据', async (path, api, result) => {
    api.mockResolvedValueOnce(result)
    await open(path)
    await flushPromises()
    expect(wrapper.find('.el-empty').exists()).toBe(true)
    expect(wrapper.find('article').exists()).toBe(false)
  })

  it('首页取每组前三条，局部失败不阻塞其余区块', async () => {
    getWindows.mockResolvedValue(Array.from({ length: 5 }, (_, i) => ({ ...windows, id: i })))
    getTools.mockRejectedValue(new Error('无法连接服务，请检查网络后重试。'))
    getArticles.mockResolvedValue([])
    await open('/')
    await flushPromises()
    expect(wrapper.findAll('.resource-card')).toHaveLength(3)
    expect(wrapper.find('.retry-button').exists()).toBe(true)
    expect(wrapper.find('.el-empty').exists()).toBe(true)
    expect(getWindows).toHaveBeenCalledOnce()
    expect(getTools).toHaveBeenCalledOnce()
    expect(getArticles).toHaveBeenCalledOnce()
  })

  it('列表展示约定字段和详情链接，文章列表不泄露正文', async () => {
    const router = await open('/windows')
    await flushPromises()
    for (const value of [
      windows.name,
      windows.version,
      windows.edition,
      windows.architecture,
      windows.releaseDate,
      windows.description,
    ])
      expect(wrapper.text()).toContain(value)
    expect(wrapper.get('.card-link').attributes('href')).toBe('/windows/1')
    await router.push('/tools')
    await flushPromises()
    for (const value of [tool.name, tool.icon, tool.description, tool.category])
      expect(wrapper.text()).toContain(value)
    expect(wrapper.get('.card-link').attributes('href')).toBe('/tools/json')
    await router.push('/articles')
    await flushPromises()
    expect(wrapper.text()).toContain(article.summary)
    expect(wrapper.text()).toContain('0 次浏览')
    expect(wrapper.get('.card-cover').attributes('src')).toContain('/cover.png')
    expect(wrapper.get('.card-link').attributes('href')).toBe('/articles/3')
    expect(wrapper.text()).not.toContain(article.content)
  })

  it('文章正文安全展示文本及换行，元信息完整', async () => {
    await open('/articles/3')
    await flushPromises()
    expect(wrapper.get('.article-content').text()).toBe(article.content)
    expect(wrapper.find('.article-content img').exists()).toBe(false)
    expect(wrapper.text()).toContain('2025-01-02 12:00:00')
    expect(wrapper.text()).toContain('2025-01-01 12:00:00')
    expect(wrapper.text()).toContain(article.category)
  })

  it('Windows 详情包含校验值和安全官方链接', async () => {
    await open('/windows/1')
    await flushPromises()
    expect(wrapper.text()).toContain(windows.sha256)
    const link = wrapper.get('a[target="_blank"]')
    expect(link.attributes('href')).toBe(windows.officialDownloadUrl)
    expect(link.attributes('rel')).toBe('noopener noreferrer')
    expect(wrapper.get('nav a.is-active').attributes('href')).toBe('/windows')
  })

  it('无下载链接或非官方地址时不生成下载按钮', async () => {
    getWindowsDetail.mockResolvedValue({ ...windows, officialDownloadUrl: 'javascript:alert(1)' })
    await open('/windows/1')
    await flushPromises()
    expect(wrapper.find('a[target="_blank"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('暂未提供有效的 Microsoft 官方下载链接')
  })

  it('工具详情明确未开放，不跟随未来 path', async () => {
    await open('/tools/future-tool')
    await flushPromises()
    expect(wrapper.text()).toContain('该工具将在下一阶段开放')
    expect(wrapper.find('a[href="/unimplemented"]').exists()).toBe(false)
    expect(wrapper.find('input,textarea').exists()).toBe(false)
  })

  it.each([
    ['/windows/1', '/windows/2', getWindowsDetail, '2'],
    ['/tools/future-tool', '/tools/another-tool', getToolDetail, 'another-tool'],
    ['/articles/3', '/articles/4', getArticleDetail, '4'],
  ])('同类详情路由变化重新请求 %s', async (first, second, api, parameter) => {
    const router = await open(first)
    await flushPromises()
    await router.push(second)
    await flushPromises()
    expect(api).toHaveBeenLastCalledWith(parameter)
    expect(api).toHaveBeenCalledTimes(2)
  })

  it('迟到的旧请求不会覆盖新详情', async () => {
    let resolveFirst
    getWindowsDetail.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFirst = resolve
      }),
    )
    const router = await open('/windows/1')
    getWindowsDetail.mockResolvedValueOnce({ ...windows, id: 2, name: '新详情' })
    await router.push('/windows/2')
    await flushPromises()
    resolveFirst(windows)
    await flushPromises()
    expect(wrapper.get('h1').text()).toBe('新详情')
  })

  it('资源 404 显示友好消息，路由 404 可返回首页', async () => {
    getArticleDetail.mockRejectedValue(new Error('未找到该文章，可能已下架。'))
    const router = await open('/articles/404')
    await flushPromises()
    expect(wrapper.text()).toContain('未找到该文章，可能已下架。')
    await router.push('/missing')
    await flushPromises()
    await wrapper.get('.not-found a').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/')
  })
})
