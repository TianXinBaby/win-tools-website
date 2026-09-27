import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ElMessageBox } from 'element-plus'
import AdminToolsView from '../views/admin/AdminToolsView.vue'
import AdminArticlesView from '../views/admin/AdminArticlesView.vue'
import AdminDashboardView from '../views/admin/AdminDashboardView.vue'
import * as tools from '../api/adminTools'
import * as articles from '../api/adminArticles'
import { getStats } from '../api/adminDashboard'

vi.mock('../api/adminTools', () => ({
  list: vi.fn(),
  detail: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  updateStatus: vi.fn(),
  updateSort: vi.fn(),
  remove: vi.fn(),
}))
vi.mock('../api/adminArticles', () => ({
  list: vi.fn(),
  detail: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}))
vi.mock('../api/adminDashboard', () => ({ getStats: vi.fn() }))
vi.mock('element-plus', async (original) => ({
  ...(await original()),
  ElMessage: { success: vi.fn() },
  ElMessageBox: { confirm: vi.fn() },
}))

const toolRows = [
  {
    id: 1,
    name: 'JSON 工具',
    slug: 'json',
    category: 'development',
    status: 1,
    sortOrder: 10,
    createdAt: '2026-01-01',
  },
  {
    id: 2,
    name: '图片压缩',
    slug: 'image-compress',
    category: 'media',
    status: 0,
    sortOrder: 20,
    createdAt: '2026-01-02',
  },
  {
    id: 3,
    name: 'UUID',
    slug: 'uuid',
    category: 'development',
    status: 1,
    sortOrder: 30,
    createdAt: '2026-01-03',
  },
]
let wrapper
beforeEach(() => {
  vi.resetAllMocks()
  tools.list.mockResolvedValue(toolRows)
  articles.list.mockResolvedValue([
    { id: 4, title: '草稿文章', status: 0, createdAt: '2026-01-01' },
    { id: 5, title: '已发布文章', status: 1, createdAt: '2026-01-02' },
  ])
  getStats.mockResolvedValue({
    toolTotal: 3,
    toolEnabled: 2,
    toolDisabled: 1,
    articleTotal: 2,
    articlePublished: 1,
    categoryCount: 2,
  })
})
afterEach(() => {
  wrapper?.unmount()
  document.body.innerHTML = ''
})
async function open(view) {
  wrapper = mount(view, {
    attachTo: document.body,
    global: { stubs: { teleport: true, RouterLink: true } },
  })
  await flushPromises()
}

describe('Phase 11.13 后台增强', () => {
  it('工具列表显示字段、分类统计，并支持名称、slug、分类和状态筛选', async () => {
    await open(AdminToolsView)
    expect(wrapper.get('table').text()).toContain('创建时间')
    expect(wrapper.findAll('tbody tr')).toHaveLength(3)
    expect(wrapper.get('.category-summary').text()).toContain('development2 个工具')
    expect(wrapper.get('.category-summary').text()).toContain('media1 个工具')
    await wrapper.get('#admin-tool-search').setValue('image-compress')
    expect(wrapper.findAll('tbody tr')).toHaveLength(1)
    expect(wrapper.get('tbody').text()).toContain('图片压缩')
    await wrapper.get('#admin-tool-search').setValue('')
    await wrapper.get('#admin-category-filter').setValue('development')
    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
    await wrapper.get('#admin-status-filter').setValue('0')
    expect(wrapper.get('tbody').text()).toContain('没有符合条件的数据')
    await wrapper.get('#admin-category-filter').setValue('')
    expect(wrapper.get('tbody').text()).toContain('图片压缩')
  })

  it('状态切换必须确认，成功后重新加载；取消不写入', async () => {
    await open(AdminToolsView)
    ElMessageBox.confirm.mockRejectedValueOnce('cancel').mockResolvedValueOnce('confirm')
    await wrapper.get('[data-action="status"]').trigger('click')
    await flushPromises()
    expect(tools.updateStatus).not.toHaveBeenCalled()
    await wrapper.get('[data-action="status"]').trigger('click')
    await flushPromises()
    expect(tools.updateStatus).toHaveBeenCalledExactlyOnceWith(1, 0)
    expect(tools.list).toHaveBeenCalledTimes(2)
  })

  it('排序输入校验并提交独立接口，失败时保留原列表', async () => {
    await open(AdminToolsView)
    const input = wrapper.get('input[aria-label="排序值：JSON 工具"]')
    await input.setValue('-1')
    await wrapper.get('[data-action="sort"]').trigger('click')
    expect(tools.updateSort).not.toHaveBeenCalled()
    expect(wrapper.get('[role="alert"]').text()).toContain('0 到 1000000')
    await input.setValue('5')
    tools.updateSort.mockRejectedValueOnce(new Error('无法连接服务，请检查网络后重试。'))
    await wrapper.get('[data-action="sort"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('无法连接服务')
    expect(wrapper.get('tbody').text()).toContain('JSON 工具')
    await wrapper.get('[data-action="sort"]').trigger('click')
    await flushPromises()
    expect(tools.updateSort).toHaveBeenLastCalledWith(1, 5)
    expect(tools.list).toHaveBeenCalledTimes(2)
  })

  it('文章列表按草稿和已发布筛选，发布时间不伪造', async () => {
    await open(AdminArticlesView)
    expect(wrapper.get('table').text()).toContain('发布时间')
    expect(wrapper.get('tbody').text()).toContain('未发布')
    expect(wrapper.get('tbody').text()).toContain('未记录')
    await wrapper.get('#admin-status-filter').setValue('1')
    expect(wrapper.findAll('tbody tr')).toHaveLength(1)
    expect(wrapper.get('tbody').text()).toContain('已发布文章')
    expect(wrapper.get('tbody').text()).not.toContain('草稿文章')
  })

  it('Dashboard 显示六项统计并可刷新', async () => {
    await open(AdminDashboardView)
    expect(wrapper.get('.stats-grid').text()).toContain('工具总数3')
    expect(wrapper.get('.stats-grid').text()).toContain('启用工具2')
    expect(wrapper.get('.stats-grid').text()).toContain('禁用工具1')
    expect(wrapper.get('.stats-grid').text()).toContain('文章总数2')
    expect(wrapper.get('.stats-grid').text()).toContain('已发布文章1')
    expect(wrapper.get('.stats-grid').text()).toContain('工具分类2')
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(getStats).toHaveBeenCalledTimes(2)
  })
})
