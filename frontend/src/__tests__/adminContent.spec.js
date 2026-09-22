import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ElMessageBox } from 'element-plus'
import AdminWindowsView from '../views/admin/AdminWindowsView.vue'
import AdminToolsView from '../views/admin/AdminToolsView.vue'
import AdminArticlesView from '../views/admin/AdminArticlesView.vue'
import * as windows from '../api/adminWindows'
import * as tools from '../api/adminTools'
import * as articles from '../api/adminArticles'

vi.mock('../api/adminWindows', () => ({
  list: vi.fn(),
  detail: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}))
vi.mock('../api/adminTools', () => ({
  list: vi.fn(),
  detail: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}))
vi.mock('../api/adminArticles', () => ({
  list: vi.fn(),
  detail: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}))
vi.mock('element-plus', async (original) => ({
  ...(await original()),
  ElMessage: { success: vi.fn() },
  ElMessageBox: { confirm: vi.fn() },
}))

const cases = [
  {
    view: AdminWindowsView,
    api: windows,
    values: {
      name: 'Windows 测试',
      version: '24H2',
      edition: 'Pro',
      architecture: 'x64',
      releaseDate: '2026-01-01',
      officialDownloadUrl: 'https://www.microsoft.com/download',
      description: '普通文本',
      sortOrder: 3,
      status: 0,
    },
  },
  {
    view: AdminToolsView,
    api: tools,
    values: {
      name: 'JSON 工具',
      slug: 'json',
      path: '/tools/json',
      category: '开发',
      icon: 'code',
      sortOrder: 4,
      status: 0,
    },
  },
  {
    view: AdminArticlesView,
    api: articles,
    values: {
      title: '测试文章',
      slug: 'test-article',
      summary: '摘要',
      content: '<script>alert(1)</script>\n正文',
      category: '教程',
      status: 0,
    },
  },
]
let wrapper
beforeEach(() => {
  vi.resetAllMocks()
})
afterEach(() => {
  wrapper?.unmount()
  document.body.innerHTML = ''
})

async function open(config) {
  const row = {
    id: 7,
    ...config.values,
    viewCount: 42,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-02',
  }
  config.api.list.mockResolvedValue([row])
  config.api.detail.mockResolvedValue(row)
  wrapper = mount(config.view, { attachTo: document.body, global: { stubs: { teleport: true } } })
  await flushPromises()
  return row
}
async function edit() {
  await wrapper.get('[data-action="edit"]').trigger('click')
  await flushPromises()
}
async function fill(values) {
  for (const [key, value] of Object.entries(values)) {
    await wrapper.get('#admin-field-' + key).setValue(value)
  }
}
async function submit() {
  await wrapper.get('form').trigger('submit')
  await flushPromises()
}

describe.each(cases)('后台内容管理 $view.__name', (config) => {
  it('列表显示所有状态、字段和只读信息', async () => {
    await open(config)
    expect(config.api.list).toHaveBeenCalledOnce()
    expect(wrapper.get('table').text()).toContain(config.values.name || config.values.title)
    expect(wrapper.get('table').text()).toContain(config.api === articles ? '草稿' : '禁用')
    expect(wrapper.findAll('td').some((cell) => cell.text() === '42')).toBe(config.api === articles)
  })
  it('新增填写表单并提交白名单 payload，成功刷新', async () => {
    await open(config)
    await wrapper.get('[data-action="create"]').trigger('click')
    await flushPromises()
    await fill(config.values)
    await submit()
    expect(config.api.create).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining(config.values),
    )
    const payload = config.api.create.mock.calls[0][0]
    expect(payload).not.toHaveProperty('id')
    expect(payload).not.toHaveProperty('viewCount')
    expect(payload).not.toHaveProperty('createdAt')
    expect(config.api.list).toHaveBeenCalledTimes(2)
  })
  it('编辑读取最新详情、修改值并提交；文章正文仅文本', async () => {
    await open(config)
    await edit()
    expect(config.api.detail).toHaveBeenCalledExactlyOnceWith(7)
    const key = config.api === articles ? 'content' : 'name'
    await wrapper.get('#admin-field-' + key).setValue('更新后的文字')
    await wrapper.get('#admin-field-status').setValue(1)
    expect(wrapper.find('#admin-field-viewCount').exists()).toBe(false)
    expect(wrapper.find('script').exists()).toBe(false)
    await submit()
    expect(config.api.update).toHaveBeenCalledExactlyOnceWith(
      7,
      expect.objectContaining({ [key]: '更新后的文字', status: 1 }),
    )
    expect(config.api.update.mock.calls[0][1]).not.toHaveProperty('viewCount')
    expect(config.api.list).toHaveBeenCalledTimes(2)
  })
  it('删除必须确认，取消不请求后端', async () => {
    await open(config)
    ElMessageBox.confirm.mockRejectedValue('cancel')
    await wrapper.get('[data-action="delete"]').trigger('click')
    await flushPromises()
    expect(ElMessageBox.confirm).toHaveBeenCalledOnce()
    expect(config.api.remove).not.toHaveBeenCalled()
    expect(wrapper.get('tbody').text()).toContain(config.values.name || config.values.title)
  })
  it('确认删除后才调用 API 和刷新', async () => {
    await open(config)
    ElMessageBox.confirm.mockResolvedValue('confirm')
    config.api.list.mockResolvedValue([])
    await wrapper.get('[data-action="delete"]').trigger('click')
    await flushPromises()
    expect(config.api.remove).toHaveBeenCalledExactlyOnceWith(7)
    expect(config.api.list).toHaveBeenCalledTimes(2)
    expect(wrapper.get('tbody').text()).toContain('暂无数据')
  })
  it('删除失败保留列表并显示错误', async () => {
    await open(config)
    ElMessageBox.confirm.mockResolvedValue('confirm')
    config.api.remove.mockRejectedValue(new Error('无法连接服务，请检查网络后重试。'))
    await wrapper.get('[data-action="delete"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('无法连接服务')
    expect(wrapper.get('tbody').text()).toContain(config.values.name || config.values.title)
    expect(config.api.list).toHaveBeenCalledOnce()
  })
  it('提交失败保留表单输入，显示冲突或安全错误', async () => {
    await open(config)
    await edit()
    config.api.update.mockRejectedValue(Object.assign(new Error('slug 已存在'), { status: 409 }))
    await submit()
    expect(wrapper.get('[role="alert"]').text()).toContain('slug 已存在')
    expect(wrapper.get('#admin-field-status').element.value).toBe('0')
    expect(config.api.list).toHaveBeenCalledOnce()
  })
  it('loading 和 submitting 阻止重复请求及关闭表单', async () => {
    await open(config)
    await edit()
    let complete
    config.api.update.mockReturnValue(
      new Promise((resolve) => {
        complete = resolve
      }),
    )
    await submit()
    expect(wrapper.get('form').attributes('aria-busy')).toBe('true')
    expect(wrapper.get('fieldset').attributes('disabled')).toBeDefined()
    await submit()
    expect(config.api.update).toHaveBeenCalledOnce()
    complete({})
    await flushPromises()
    expect(config.api.list).toHaveBeenCalledTimes(2)
  })
  it('读取详情失败不打开编辑器，列表失败可重试', async () => {
    await open(config)
    config.api.detail.mockRejectedValue(new Error('资源不存在或已下架。'))
    await edit()
    expect(wrapper.find('form').exists()).toBe(false)
    expect(wrapper.get('[role="alert"]').text()).toContain('资源不存在')
    config.api.list.mockRejectedValue(new Error('无法连接服务'))
    const refresh = wrapper.findAll('button').find((button) => button.text() === '刷新')
    await refresh.trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain('无法连接服务')
    config.api.list.mockResolvedValue([])
    await refresh.trigger('click')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.get('tbody').text()).toContain('暂无数据')
  })
})
