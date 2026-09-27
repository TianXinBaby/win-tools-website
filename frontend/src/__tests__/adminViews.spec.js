import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { ElButton } from 'element-plus'
import App from '../App.vue'
import { routes } from '../router'
import { installAdminGuard } from '../router/adminGuard'
import { getAdminCsrf, getCurrentAdmin, loginAdmin, logoutAdmin } from '../api/adminAuth'
import { getStats } from '../api/adminDashboard'
import {
  adminSession,
  clearAdminSession,
  setCurrentAdmin,
  expireAdminSession,
} from '../utils/adminSession'

vi.mock('../api/adminAuth', () => ({
  getAdminCsrf: vi.fn(),
  getCurrentAdmin: vi.fn(),
  loginAdmin: vi.fn(),
  logoutAdmin: vi.fn(),
}))
vi.mock('../api/adminDashboard', () => ({ getStats: vi.fn() }))
const admin = { id: 1, username: 'test-admin', nickname: '测试管理员' }
const csrf = { token: 'test-token', headerName: 'X-Test-CSRF' }
const unauthorized = () => Object.assign(new Error('Unauthorized'), { status: 401 })
let wrapper, disposeGuard
beforeEach(() => {
  vi.resetAllMocks()
  clearAdminSession()
  getCurrentAdmin.mockRejectedValue(unauthorized())
  getAdminCsrf.mockResolvedValue(csrf)
  getStats.mockResolvedValue({
    toolTotal: 0,
    toolEnabled: 0,
    toolDisabled: 0,
    articleTotal: 0,
    articlePublished: 0,
    categoryCount: 0,
  })
})
afterEach(() => {
  wrapper?.unmount()
  disposeGuard?.()
  vi.restoreAllMocks()
})

async function open(path) {
  const router = createRouter({ history: createMemoryHistory(), routes })
  disposeGuard = installAdminGuard(router)
  await router.push(path)
  await router.isReady()
  wrapper = mount(App, { global: { plugins: [router, ElButton] } })
  await flushPromises()
  return router
}

async function fillAndSubmit() {
  await wrapper.get('#admin-username').setValue(' test-admin ')
  await wrapper.get('#admin-password').setValue(' test-only password ')
  await wrapper.get('form').trigger('submit')
  await flushPromises()
}

describe('后台页面及守卫', () => {
  it.each(['/admin/windows', '/admin/tools', '/admin/articles'])(
    '未认证访问 %s 由既有守卫跳登录',
    async (path) => {
      const router = await open(path)
      expect(router.currentRoute.value.name).toBe('admin-login')
      expect(getCurrentAdmin).toHaveBeenCalledTimes(2)
      expect(wrapper.find('table').exists()).toBe(false)
    },
  )
  it('渲染空的用户名和密码输入、登录按钮，不提供记住密码', async () => {
    await open('/admin/login')
    expect(wrapper.get('h1').text()).toBe('管理员登录')
    expect(wrapper.get('#admin-username').element.value).toBe('')
    expect(wrapper.get('#admin-password').attributes('type')).toBe('password')
    expect(wrapper.get('#admin-password').element.value).toBe('')
    expect(wrapper.find('[type="checkbox"]').exists()).toBe(false)
    expect(wrapper.get('button').text()).toBe('登录')
    expect(wrapper.find('.main-nav').exists()).toBe(false)
  })
  it('未登录 /admin 跳登录且守卫请求次数有界', async () => {
    const router = await open('/admin')
    expect(router.currentRoute.value.name).toBe('admin-login')
    expect(getCurrentAdmin).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('登录状态已失效，请重新登录。')
  })
  it('刷新后台依赖 /me 恢复管理员和 Dashboard', async () => {
    getCurrentAdmin.mockResolvedValue(admin)
    const router = await open('/admin')
    expect(router.currentRoute.value.name).toBe('admin-dashboard')
    expect(getCurrentAdmin).toHaveBeenCalledOnce()
    expect(adminSession.admin).toEqual(admin)
    expect(wrapper.text()).toContain('欢迎，测试管理员')
    expect(wrapper.text()).toContain('内容管理')
  })
  it('已登录访问登录页经 /me 确认后跳 Dashboard', async () => {
    getCurrentAdmin.mockResolvedValue(admin)
    const router = await open('/admin/login')
    expect(router.currentRoute.value.name).toBe('admin-dashboard')
    expect(getCurrentAdmin).toHaveBeenCalledTimes(2)
  })
  it('过时内存状态不能绕过 /me', async () => {
    setCurrentAdmin(admin)
    const router = await open('/admin')
    expect(router.currentRoute.value.name).toBe('admin-login')
    expect(adminSession.admin).toBeNull()
  })
  it('网络故障不允许进入后台，提供重试说明', async () => {
    getCurrentAdmin.mockRejectedValue(new Error('private network detail'))
    const router = await open('/admin')
    expect(router.currentRoute.value.name).toBe('admin-login')
    expect(wrapper.text()).toContain('暂时无法确认登录状态')
    expect(wrapper.text()).not.toContain('private network detail')
  })
  it('等待 csrf 时显示 loading 并阻止重复提交', async () => {
    let resolveCsrf
    getAdminCsrf.mockReturnValue(
      new Promise((resolve) => {
        resolveCsrf = resolve
      }),
    )
    await open('/admin/login')
    await fillAndSubmit()
    expect(wrapper.get('form').attributes('aria-busy')).toBe('true')
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
    expect(wrapper.get('#admin-username').element.value).toBe(' test-admin ')
    expect(wrapper.get('#admin-password').element.value).toBe(' test-only password ')
    expect(loginAdmin).not.toHaveBeenCalled()
    await wrapper.get('form').trigger('submit')
    expect(getAdminCsrf).toHaveBeenCalledOnce()
    loginAdmin.mockRejectedValue(unauthorized())
    resolveCsrf(csrf)
    await flushPromises()
    expect(wrapper.get('form').attributes('aria-busy')).toBe('false')
  })
  it('登录先取 csrf，密码不 trim，成功后进入 Dashboard且不写浏览器存储', async () => {
    const storage = vi.spyOn(Storage.prototype, 'setItem')
    const router = await open('/admin/login')
    loginAdmin.mockImplementation(async () => {
      getCurrentAdmin.mockResolvedValue(admin)
      return admin
    })
    await fillAndSubmit()
    expect(getAdminCsrf.mock.invocationCallOrder[0]).toBeLessThan(
      loginAdmin.mock.invocationCallOrder[0],
    )
    expect(loginAdmin).toHaveBeenCalledExactlyOnceWith(
      { username: 'test-admin', password: ' test-only password ' },
      csrf,
    )
    expect(router.currentRoute.value.name).toBe('admin-dashboard')
    expect(wrapper.text()).toContain('当前管理员：测试管理员')
    expect(storage).not.toHaveBeenCalled()
  })
  it.each([401, 403, 500])('登录错误 %s 显示安全提示并清除密码', async (status) => {
    const router = await open('/admin/login')
    loginAdmin.mockRejectedValue(
      Object.assign(new Error('private error with password'), { status }),
    )
    await fillAndSubmit()
    expect(router.currentRoute.value.name).toBe('admin-login')
    expect(wrapper.get('[role="alert"]').text()).toBe(
      status === 401
        ? '用户名或密码错误'
        : status === 403
          ? '安全校验未通过，请重新点击登录。'
          : '登录失败，请检查网络后重试。',
    )
    expect(wrapper.get('#admin-password').element.value).toBe('')
    expect(wrapper.get('button').attributes('disabled')).toBeUndefined()
  })
  it('空凭据不提交登录', async () => {
    await open('/admin/login')
    await wrapper.get('form').trigger('submit')
    expect(loginAdmin).not.toHaveBeenCalled()
    expect(wrapper.get('[role="alert"]').text()).toBe('请输入用户名和密码。')
  })
  it('csrf 失败不发登录请求', async () => {
    await open('/admin/login')
    getAdminCsrf.mockRejectedValue(new Error('network'))
    await fillAndSubmit()
    expect(loginAdmin).not.toHaveBeenCalled()
    expect(wrapper.get('[role="alert"]').text()).toContain('登录失败')
  })
  it('退出获取新 csrf 并通知后端，成功后清状态和跳登录', async () => {
    getCurrentAdmin.mockResolvedValue(admin)
    const router = await open('/admin')
    logoutAdmin.mockImplementation(async () => {
      getCurrentAdmin.mockRejectedValue(unauthorized())
    })
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(getAdminCsrf).toHaveBeenCalledOnce()
    expect(logoutAdmin).toHaveBeenCalledExactlyOnceWith(csrf)
    expect(router.currentRoute.value.name).toBe('admin-login')
    expect(adminSession.admin).toBeNull()
    expect(wrapper.text()).not.toContain('登录状态已失效')
  })
  it('退出失败保留认证状态并显示错误', async () => {
    getCurrentAdmin.mockResolvedValue(admin)
    const router = await open('/admin')
    logoutAdmin.mockRejectedValue(new Error('network'))
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('admin-dashboard')
    expect(adminSession.admin).toEqual(admin)
    expect(wrapper.get('[role="alert"]').text()).toContain('退出失败')
  })
  it('后台 API 触发 Session 失效后跳登录，无循环', async () => {
    getCurrentAdmin.mockResolvedValue(admin)
    const router = await open('/admin')
    getCurrentAdmin.mockRejectedValue(unauthorized())
    expireAdminSession()
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('admin-login')
    expect(wrapper.text()).toContain('登录状态已失效')
    expect(getCurrentAdmin).toHaveBeenCalledTimes(2)
  })
  it('nickname 缺失时显示 username', async () => {
    getCurrentAdmin.mockResolvedValue({ ...admin, nickname: null })
    await open('/admin')
    expect(wrapper.text()).toContain('欢迎，test-admin')
  })
})
