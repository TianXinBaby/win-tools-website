import axios from 'axios'

const request = axios.create({ baseURL: '/api', timeout: 10000 })

// Only known public API messages reach the UI; never forward raw server errors.
const publicMessages = {
  'Windows resource not found': '未找到该 Windows 资源，可能已下架。',
  'Tool resource not found': '未找到该工具，可能尚未开放。',
  'Article resource not found': '未找到该文章，可能已下架。',
  'Bad Request': '请求参数不正确，请检查页面地址。',
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
    return Promise.reject(responseError(body?.code, body?.message))
  },
  (error) => {
    if (error.response) {
      return Promise.reject(responseError(error.response.status, error.response.data?.message))
    }
    const message = ['ECONNABORTED', 'ETIMEDOUT'].includes(error.code)
      ? '请求超时，请稍后重试。'
      : '无法连接服务，请检查网络后重试。'
    return Promise.reject(new Error(message))
  },
)

export default request
