import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import VideoConverterView from '../views/tools/VideoConverterView.vue'
import * as api from '../api/videoConverter'
vi.mock('../api/videoConverter', async (original) => ({
  ...(await original()),
  getVideoCapabilities: vi.fn(),
  createVideoJob: vi.fn(),
  getVideoJob: vi.fn(),
  cancelVideoJob: vi.fn(),
}))
const cap = {
  available: true,
  inputFormats: ['asf'],
  outputFormats: ['mp4', 'mkv', 'mov', 'avi', 'webm'],
  maxUploadBytes: 500 * 1024 * 1024,
  maxDurationSeconds: 1800,
  jobTtlMinutes: 30,
}
let wrapper
const job = (status, extra = {}) => ({
  jobId: 'test-id',
  targetFormat: 'mp4',
  status,
  progress: null,
  ...extra,
})
async function open() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: VideoConverterView }],
  })
  await router.push('/tools/video-converter')
  wrapper = mount(VideoConverterView, { global: { plugins: [router] } })
  await flushPromises()
}
async function select(name = '中文 空格.asf', content = 'valid', bytes) {
  const input = wrapper.get('input[type=file]')
  const file = new File([content], name)
  if (bytes !== undefined) Object.defineProperty(file, 'size', { value: bytes })
  Object.defineProperty(input.element, 'files', {
    configurable: true,
    value: [file],
  })
  await input.trigger('change')
}
function button(text) {
  return wrapper.findAll('button').find((item) => item.text() === text)
}
beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  api.getVideoCapabilities.mockResolvedValue(cap)
  api.createVideoJob.mockResolvedValue(job('QUEUED'))
  api.getVideoJob.mockResolvedValue(job('QUEUED'))
  api.cancelVideoJob.mockResolvedValue(job('CANCELLED'))
})
afterEach(() => {
  wrapper?.unmount()
  vi.useRealTimers()
})
describe('视频转换页面', () => {
  it('使用服务器500MiB上限，等于上限可选，超出1字节拒绝', async () => {
    await open()
    expect(wrapper.text()).toContain('500.0 MB')
    await select('limit.asf', 'valid', 500 * 1024 * 1024)
    expect(button('开始转换').attributes('disabled')).toBeUndefined()
    await select('over.asf', 'valid', 500 * 1024 * 1024 + 1)
    expect(button('开始转换').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[role=alert]').text()).toContain('超过')
  })
  it('取消失败后可重试查询并继续显示真实任务状态', async () => {
    await open()
    await select()
    await button('开始转换').trigger('click')
    await flushPromises()
    api.cancelVideoJob.mockRejectedValueOnce(new Error('连接失败'))
    await button('取消任务').trigger('click')
    await flushPromises()
    expect(button('重试查询')).toBeDefined()
    api.getVideoJob.mockResolvedValueOnce(job('COMPLETED', { progress: 100 }))
    await button('重试查询').trigger('click')
    await flushPromises()
    expect(wrapper.find('[download]').exists()).toBe(true)
  })
  it('取消返回任务不存在时释放页面并允许重新上传', async () => {
    await open()
    await select()
    await button('开始转换').trigger('click')
    await flushPromises()
    api.cancelVideoJob.mockRejectedValueOnce(
      Object.assign(new Error('任务已过期，请重新上传'), { status: 404 }),
    )
    await button('取消任务').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('已过期')
    expect(button('开始转换').attributes('disabled')).toBeUndefined()
  })
  it('取消后迟到的状态响应不会恢复下载或任务', async () => {
    let finishPoll
    api.getVideoJob.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishPoll = resolve
        }),
    )
    await open()
    await select()
    await button('开始转换').trigger('click')
    await flushPromises()
    await button('取消任务').trigger('click')
    await flushPromises()
    finishPoll(job('COMPLETED', { progress: 100 }))
    await flushPromises()
    expect(wrapper.text()).toContain('已取消')
    expect(wrapper.find('[download]').exists()).toBe(false)
  })
  it('文件必选、格式白名单、大小限制及默认 MP4', async () => {
    await open()
    expect(button('开始转换').attributes('disabled')).toBeDefined()
    expect(wrapper.get('select').element.value).toBe('mp4')
    expect(wrapper.text()).toContain('上传至本站服务器')
    await select('bad.exe')
    expect(wrapper.get('[role=alert]').text()).toContain('请选择 ASF')
    await select('empty.asf', '')
    expect(button('开始转换').attributes('disabled')).toBeDefined()
    await select()
    expect(button('开始转换').attributes('disabled')).toBeUndefined()
    expect(wrapper.text()).toContain('中文 空格.asf')
  })
  it('实际上传进度、排队、验证、转换和成功后下载', async () => {
    let finish
    api.createVideoJob.mockImplementation((file, format, onProgress) => {
      onProgress({ loaded: 25, total: 100 })
      return new Promise((resolve) => {
        finish = resolve
      })
    })
    await open()
    await select()
    await button('开始转换').trigger('click')
    expect(wrapper.text()).toContain('正在上传 25%')
    expect(wrapper.find('[download]').exists()).toBe(false)
    finish(job('QUEUED'))
    await flushPromises()
    expect(wrapper.text()).toContain('排队中')
    api.getVideoJob.mockResolvedValueOnce(job('VALIDATING'))
    await vi.advanceTimersByTimeAsync(1000)
    expect(wrapper.text()).toContain('正在验证视频')
    api.getVideoJob.mockResolvedValueOnce(job('CONVERTING', { progress: 37 }))
    await vi.advanceTimersByTimeAsync(1000)
    expect(wrapper.text()).toContain('正在转换 37%')
    api.getVideoJob.mockResolvedValueOnce(job('COMPLETED', { progress: 100 }))
    await vi.advanceTimersByTimeAsync(1000)
    expect(wrapper.get('[download]').attributes('href')).toBe(
      '/api/tools/video-converter/jobs/test-id/download',
    )
  })
  it('失败原因和重试按钮', async () => {
    api.getVideoJob.mockResolvedValue(job('FAILED', { errorCode: 'VIDEO_NO_VIDEO_STREAM' }))
    await open()
    await select()
    await button('开始转换').trigger('click')
    await flushPromises()
    expect(wrapper.get('[role=alert]').text()).toContain('没有视频流')
    expect(wrapper.find('[download]').exists()).toBe(false)
    expect(button('开始转换').attributes('disabled')).toBeUndefined()
  })
  it('取消排队中的任务', async () => {
    await open()
    await select()
    await button('开始转换').trigger('click')
    await flushPromises()
    await button('取消任务').trigger('click')
    await flushPromises()
    expect(api.cancelVideoJob).toHaveBeenCalledWith('test-id')
    expect(wrapper.text()).toContain('已取消')
    expect(wrapper.find('[download]').exists()).toBe(false)
  })
  it('上传期间取消在 ID 返回后执行清理', async () => {
    let finish
    api.createVideoJob.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    await open()
    await select()
    await button('开始转换').trigger('click')
    await button('取消任务').trigger('click')
    expect(api.cancelVideoJob).not.toHaveBeenCalled()
    finish(job('QUEUED'))
    await flushPromises()
    expect(api.cancelVideoJob).toHaveBeenCalledWith('test-id')
  })
  it('网络错误可重试查询，任务过期要求重新上传', async () => {
    api.getVideoJob.mockRejectedValueOnce(new Error('连接失败'))
    await open()
    await select()
    await button('开始转换').trigger('click')
    await flushPromises()
    expect(button('重试查询')).toBeDefined()
    api.getVideoJob.mockRejectedValueOnce(
      Object.assign(new Error('任务已过期，请重新上传'), { status: 404 }),
    )
    await button('重试查询').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('重新上传')
    expect(button('开始转换').attributes('disabled')).toBeUndefined()
  })
  it('不可用服务说明及重新检查', async () => {
    api.getVideoCapabilities.mockResolvedValueOnce({
      ...cap,
      available: false,
      reason: 'VIDEO_DISABLED',
    })
    await open()
    expect(wrapper.text()).toContain('暂未启用')
    expect(wrapper.find('input[type=file]').exists()).toBe(false)
    await button('重新检查').trigger('click')
    await flushPromises()
    expect(wrapper.find('input[type=file]').exists()).toBe(true)
  })
  it('拖放上传和未知转换进度不伪造百分比', async () => {
    api.getVideoJob.mockResolvedValue(job('CONVERTING'))
    await open()
    await wrapper
      .get('.video-dropzone')
      .trigger('drop', { dataTransfer: { files: [new File(['data'], 'video.asf')] } })
    await button('开始转换').trigger('click')
    await flushPromises()
    expect(wrapper.get('progress').attributes('value')).toBeUndefined()
  })
})
