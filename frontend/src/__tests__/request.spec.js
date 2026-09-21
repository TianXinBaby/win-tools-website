import { afterEach, describe, expect, it, vi } from 'vitest'
import request from '../utils/request'

const originalAdapter = request.defaults.adapter
afterEach(() => {
  request.defaults.adapter = originalAdapter
})

function respond(data) {
  request.defaults.adapter = vi.fn(async (config) => ({ config, data, status: 200, headers: {} }))
}

describe('统一请求', () => {
  it('使用 /api、10 秒超时，解包统一响应', async () => {
    respond({ code: 200, message: 'success', data: [{ id: 1 }] })
    await expect(request.get('/windows')).resolves.toEqual([{ id: 1 }])
    expect(request.defaults.adapter).toHaveBeenCalledWith(
      expect.objectContaining({ baseURL: '/api', timeout: 10000 }),
    )
  })
  it.each([null, [], { id: 1 }])('保留合法的空或非空 data：%j', async (data) => {
    respond({ code: 200, data })
    await expect(request.get('/windows')).resolves.toEqual(data)
  })
  it('业务 404 保留公开错误含义', async () => {
    respond({ code: 404, message: 'Windows resource not found', data: null })
    await expect(request.get('/windows/0')).rejects.toMatchObject({
      status: 404,
      message: '未找到该 Windows 资源，可能已下架。',
    })
  })
  it.each([
    null,
    { code: 400, message: 'toString' },
    '<html>Bad gateway</html>',
    { code: 200 },
    { code: 400, message: 'java.sql.SQLException secret' },
    { code: 500, message: 'Windows resource not found' },
  ])('异常响应不会泄露原始内容：%j', async (body) => {
    respond(body)
    await expect(request.get('/windows')).rejects.toThrow('加载失败，请稍后重试。')
  })
  it.each([
    [400, 'Bad Request', '请求参数不正确，请检查页面地址。'],
    [404, 'Tool resource not found', '未找到该工具，可能尚未开放。'],
    [404, 'Article resource not found', '未找到该文章，可能已下架。'],
    [404, 'internal detail', '资源不存在或已下架。'],
    [500, 'java.sql.SQLException SELECT password', '加载失败，请稍后重试。'],
  ])('HTTP %s 转为安全消息', async (status, message, expected) => {
    request.defaults.adapter = async () => {
      throw { response: { status, data: { message } } }
    }
    await expect(request.get('/tools')).rejects.toMatchObject({ status, message: expected })
  })
  it.each([
    ['ERR_NETWORK', '无法连接服务，请检查网络后重试。'],
    ['ECONNABORTED', '请求超时，请稍后重试。'],
    ['ETIMEDOUT', '请求超时，请稍后重试。'],
  ])('%s 提供可读错误', async (code, message) => {
    request.defaults.adapter = async () => {
      throw Object.assign(new Error('private diagnostic'), { code })
    }
    await expect(request.get('/tools')).rejects.toThrow(message)
  })
})
