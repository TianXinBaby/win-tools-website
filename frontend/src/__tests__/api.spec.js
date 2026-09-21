import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from '../utils/request'
import { getWindows, getWindowsDetail } from '../api/windows'
import { getTools, getToolDetail } from '../api/tools'
import { getArticles, getArticleDetail } from '../api/articles'
vi.mock('../utils/request', () => ({ default: { get: vi.fn() } }))
beforeEach(() => vi.clearAllMocks())

describe('API 模块', () => {
  it.each([
    [getWindows, undefined, '/windows'],
    [getWindowsDetail, '12', '/windows/12'],
    [getTools, undefined, '/tools'],
    [getToolDetail, 'json', '/tools/json'],
    [getArticles, undefined, '/articles'],
    [getArticleDetail, '9', '/articles/9'],
    [getToolDetail, 'a/b?x=#', '/tools/a%2Fb%3Fx%3D%23'],
  ])('请求正确路径 %s %s', async (method, parameter, url) => {
    const data = { id: 9 }
    request.get.mockResolvedValue(data)
    await expect(method(parameter)).resolves.toBe(data)
    expect(request.get).toHaveBeenCalledExactlyOnceWith(url)
  })
  it('继续传递请求错误', async () => {
    request.get.mockRejectedValue(new Error('网络不可用'))
    await expect(getWindows()).rejects.toThrow('网络不可用')
  })
})
