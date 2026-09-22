import { afterEach, describe, expect, it, vi } from 'vitest'
import request from '../utils/request'
import * as windows from '../api/adminWindows'
import * as tools from '../api/adminTools'
import * as articles from '../api/adminArticles'
import { adminSession, clearAdminSession, setCurrentAdmin } from '../utils/adminSession'

const originalAdapter = request.defaults.adapter
afterEach(() => {
  request.defaults.adapter = originalAdapter
  clearAdminSession()
})
const cases = [
  ['windows', windows],
  ['tools', tools],
  ['articles', articles],
]
function adapter(handler) {
  request.defaults.adapter = vi.fn(async (config) => ({
    config,
    status: 200,
    headers: {},
    data: handler(config),
  }))
}
describe.each(cases)('后台 %s API', (resource, api) => {
  it('列表和详情使用管理路径', async () => {
    adapter(() => ({ code: 200, data: [] }))
    await api.list()
    await api.detail(8)
    expect(request.defaults.adapter.mock.calls.map(([c]) => c.url)).toEqual([
      '/admin/' + resource,
      '/admin/' + resource + '/8',
    ])
  })
  it.each(['create', 'update', 'remove'])('%s 获取新 CSRF 后发写请求', async (action) => {
    adapter((config) => ({
      code: 200,
      data: config.url.endsWith('/csrf')
        ? { headerName: 'X-Test-CSRF', token: 'fixture-token' }
        : { id: 8 },
    }))
    const payload = { status: 1 }
    if (action === 'create') await api.create(payload)
    else if (action === 'update') await api.update(8, payload)
    else await api.remove(8)
    const calls = request.defaults.adapter.mock.calls.map(([c]) => c)
    expect(calls).toHaveLength(2)
    expect(calls[0].url).toBe('/admin/auth/csrf')
    expect(calls[1].method).toBe({ create: 'post', update: 'put', remove: 'delete' }[action])
    expect(calls[1].headers.get('X-Test-CSRF')).toBe('fixture-token')
    expect(calls[1].url).toBe('/admin/' + resource + (action === 'create' ? '' : '/8'))
    expect(calls[1].data ? JSON.parse(calls[1].data) : undefined).toEqual(
      action === 'remove' ? undefined : payload,
    )
  })
  it('CSRF 获取失败不发写请求，403 不循环重试', async () => {
    adapter(() => ({ code: 403, message: 'Forbidden' }))
    await expect(api.create({})).rejects.toMatchObject({ status: 403 })
    expect(request.defaults.adapter).toHaveBeenCalledOnce()
    adapter((config) =>
      config.url.endsWith('/csrf')
        ? { code: 200, data: { headerName: 'X-CSRF', token: 'test' } }
        : { code: 403, message: 'Forbidden' },
    )
    await expect(api.remove(8)).rejects.toMatchObject({ status: 403 })
    expect(request.defaults.adapter).toHaveBeenCalledTimes(2)
  })
  it('401 清空管理员状态', async () => {
    setCurrentAdmin({ id: 1 })
    adapter(() => ({ code: 401, message: 'Unauthorized' }))
    await expect(api.list()).rejects.toMatchObject({ status: 401 })
    expect(adminSession.admin).toBeNull()
    expect(adminSession.expired).toBe(true)
  })
})
it.each([
  ['Tool slug already exists', '工具 slug 已存在'],
  ['Article slug already exists', '文章 slug 已存在'],
  ['Resource already exists', '资源已存在'],
])('409 使用安全文案 %s', async (message, expected) => {
  adapter(() => ({ code: 409, message }))
  await expect(tools.list()).rejects.toThrow(expected)
})
