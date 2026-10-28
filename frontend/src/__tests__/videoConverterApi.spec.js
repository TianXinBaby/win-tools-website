import { afterEach, describe, expect, it, vi } from 'vitest'
import request from '../utils/request'
import { cancelVideoJob, createVideoJob, getVideoJob } from '../api/videoConverter'

const originalAdapter = request.defaults.adapter
afterEach(() => {
  request.defaults.adapter = originalAdapter
})

function adapter() {
  const handle = vi.fn(async (config) => ({
    config,
    status: 200,
    headers: {},
    data: {
      code: 200,
      data:
        config.url === '/admin/auth/csrf'
          ? { headerName: 'X-CSRF-TOKEN', token: 'session-token' }
          : {},
    },
  }))
  request.defaults.adapter = handle
  return handle
}

describe('视频 API 安全契约', () => {
  it('上传先获取当前会话 CSRF，并只提交文件及目标格式', async () => {
    const handle = adapter()
    const file = new File(['asf'], '中文 空格.asf')
    const progress = vi.fn()
    await createVideoJob(file, 'mp4', progress)
    expect(handle).toHaveBeenCalledTimes(2)
    expect(handle.mock.calls[0][0].url).toBe('/admin/auth/csrf')
    const config = handle.mock.calls[1][0]
    expect(config).toMatchObject({
      url: '/tools/video-converter/jobs',
      method: 'post',
      baseURL: '/api',
      timeout: 300000,
      onUploadProgress: progress,
    })
    expect(config.headers.get('X-CSRF-TOKEN')).toBe('session-token')
    expect([...config.data.keys()]).toEqual(['file', 'targetFormat'])
    expect(config.data.get('file').name).toBe(file.name)
    expect(config.data.get('targetFormat')).toBe('mp4')
  })

  it('查询及取消编码任务 ID，取消携带当前会话 CSRF', async () => {
    const handle = adapter()
    const id = 'id/with?query#fragment'
    await getVideoJob(id)
    await cancelVideoJob(id)
    const url = `/tools/video-converter/jobs/${encodeURIComponent(id)}`
    expect(handle.mock.calls[0][0]).toMatchObject({ url, method: 'get' })
    expect(handle.mock.calls[2][0]).toMatchObject({ url, method: 'delete' })
    expect(handle.mock.calls[2][0].headers.get('X-CSRF-TOKEN')).toBe('session-token')
  })

  it('安全校验失败不会自动重放上传请求或泄露服务器诊断', async () => {
    const handle = adapter()
    handle.mockImplementationOnce(async (config) => ({
      config,
      status: 200,
      headers: {},
      data: { code: 403, message: 'private session /srv/path java.lang.Exception' },
    }))
    await expect(createVideoJob(new File(['asf'], 'source.asf'), 'mp4')).rejects.toMatchObject({
      status: 403,
      message: '加载失败，请稍后重试。',
    })
    expect(handle).toHaveBeenCalledTimes(1)
  })
})
