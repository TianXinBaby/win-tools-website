import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import request from '../utils/request'
import { getAdminCsrf, getCurrentAdmin, loginAdmin, logoutAdmin } from '../api/adminAuth'
import { adminSession, clearAdminSession, setCurrentAdmin } from '../utils/adminSession'

const originalAdapter = request.defaults.adapter
const csrf = { token: 'test-csrf-token', headerName: 'X-Test-CSRF' }
beforeEach(() => clearAdminSession())
afterEach(() => {
  request.defaults.adapter = originalAdapter
})

describe('管理员认证 API 和 Session 错误处理', () => {
  it('csrf 和 me 通过同源 /api 请求', async () => {
    request.defaults.adapter = vi.fn(async (config) => ({
      config,
      data: { code: 200, data: csrf },
    }))
    await getAdminCsrf()
    await getCurrentAdmin()
    expect(
      request.defaults.adapter.mock.calls.map(([config]) => [config.baseURL, config.url]),
    ).toEqual([
      ['/api', '/admin/auth/csrf'],
      ['/api', '/admin/auth/me'],
    ])
  })
  it('login 和 logout 使用后端返回的 CSRF header，密码保持原样', async () => {
    request.defaults.adapter = vi.fn(async (config) => ({
      config,
      data: { code: 200, data: null },
    }))
    await loginAdmin({ username: 'test-admin', password: ' test-only password ' }, csrf)
    await logoutAdmin(csrf)
    const [login, logout] = request.defaults.adapter.mock.calls.map(([config]) => config)
    expect(login.method).toBe('post')
    expect(login.url).toBe('/admin/auth/login')
    expect(JSON.parse(login.data).password).toBe(' test-only password ')
    expect(login.headers.get(csrf.headerName)).toBe(csrf.token)
    expect(logout.method).toBe('post')
    expect(logout.url).toBe('/admin/auth/logout')
    expect(logout.headers.get(csrf.headerName)).toBe(csrf.token)
  })
  it.each(['/admin/auth/me', '/admin/future-api'])(
    '受保护请求 %s 的 401 清理管理员',
    async (url) => {
      setCurrentAdmin({ username: 'test-admin' })
      request.defaults.adapter = async (config) => {
        throw { config, response: { status: 401, data: { message: 'Unauthorized' } } }
      }
      await expect(request.get(url)).rejects.toMatchObject({ status: 401 })
      expect(adminSession.admin).toBeNull()
      expect(adminSession.expired).toBe(true)
    },
  )
  it('业务响应中的 401 同样处理', async () => {
    setCurrentAdmin({ username: 'test-admin' })
    request.defaults.adapter = async (config) => ({
      config,
      data: { code: 401, message: 'Unauthorized' },
    })
    await expect(getCurrentAdmin()).rejects.toMatchObject({ status: 401 })
    expect(adminSession.admin).toBeNull()
  })
  it('错误登录不会触发 Session 失效跳转', async () => {
    request.defaults.adapter = async (config) => {
      throw { config, response: { status: 401, data: { message: '用户名或密码错误' } } }
    }
    await expect(loginAdmin({ username: 'test-admin', password: 'wrong' }, csrf)).rejects.toThrow(
      '用户名或密码错误',
    )
    expect(adminSession.expired).toBe(false)
  })
  it('403 返回安全提示且保留当前状态', async () => {
    setCurrentAdmin({ username: 'test-admin' })
    request.defaults.adapter = async (config) => {
      throw { config, response: { status: 403, data: { message: 'Forbidden' } } }
    }
    await expect(logoutAdmin(csrf)).rejects.toThrow('安全校验未通过，请重试。')
    expect(adminSession.admin.username).toBe('test-admin')
  })
})
