import axios from 'axios'
import { adminSession, expireAdminSession } from './adminSession'

const request = axios.create({ baseURL: '/api', timeout: 10000 })

// Only known public API messages reach the UI; never forward raw server errors.
const publicMessages = {
  'Windows resource not found': '未找到该 Windows 资源，可能已下架。',
  'Tool resource not found': '未找到该工具，可能尚未开放。',
  'Article resource not found': '未找到该文章，可能已下架。',
  'Bad Request': '请求参数不正确，请检查页面地址。',
  用户名或密码错误: '用户名或密码错误',
  Unauthorized: '登录状态已失效，请重新登录。',
  Forbidden: '安全校验未通过，请重试。',
}

function checkAdminSession(code, config) {
  const path = config?.url?.split('?')[0]
  // Anonymous login-page checks and a successful logout are not session expiry.
  if (path === '/admin/auth/me' && !adminSession.admin) return
  if (
    code === 401 &&
    path?.startsWith('/admin/') &&
    !['/admin/auth/login', '/admin/auth/csrf'].includes(path)
  ) {
    expireAdminSession()
  }
}

function responseError(code, message) {
  const fallback = code === 404 ? '资源不存在或已下架。' : '加载失败，请稍后重试。'
  const error = new Error(
    code >= 500 || !Object.hasOwn(publicMessages, message) ? fallback : publicMessages[message],
  )
  error.status = code
  return error
}

request.interceptors.response.use(
  (response) => {
    const body = response.data
    if (body?.code === 200 && Object.hasOwn(body, 'data')) return body.data
    checkAdminSession(body?.code, response.config)
    return Promise.reject(responseError(body?.code, body?.message))
  },
  (error) => {
    if (error.response) {
      checkAdminSession(error.response.status, error.config)
      return Promise.reject(responseError(error.response.status, error.response.data?.message))
    }
    const message = ['ECONNABORTED', 'ETIMEDOUT'].includes(error.code)
      ? '请求超时，请稍后重试。'
      : '无法连接服务，请检查网络后重试。'
    return Promise.reject(new Error(message))
  },
)

export default request
