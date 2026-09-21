import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { ElButton, ElTag } from 'element-plus'
import { routes } from '../router'
import QrCodeToolView from '../views/tools/QrCodeToolView.vue'
import ImageCompressToolView from '../views/tools/ImageCompressToolView.vue'
import ImageResizeToolView from '../views/tools/ImageResizeToolView.vue'
import ImageConvertToolView from '../views/tools/ImageConvertToolView.vue'
import ToolCard from '../components/ToolCard.vue'
import { generateQrCode } from '../utils/tools/qrcode'
import { loadImage, processImage } from '../utils/tools/image'
import { MediaError } from '../utils/tools/media'

vi.mock('../utils/tools/qrcode', async (original) => ({
  ...(await original()),
  generateQrCode: vi.fn(),
}))
vi.mock('../utils/tools/image', async (original) => ({
  ...(await original()),
  loadImage: vi.fn(),
  processImage: vi.fn(),
}))
let wrapper, bitmap, nextUrl
beforeEach(async () => {
  nextUrl = 0
  bitmap = { source: {}, width: 640, height: 480, close: vi.fn() }
  generateQrCode.mockResolvedValue(new Blob(['QR'], { type: 'image/png' }))
  const { validateImageFile } = await vi.importActual('../utils/tools/image')
  loadImage.mockImplementation(async (file) => {
    validateImageFile(file)
    return bitmap
  })
  processImage.mockImplementation(async (_, { mime }) => new Blob(['output'], { type: mime }))
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = vi.fn(() => `blob:local-${++nextUrl}`)
      static revokeObjectURL = vi.fn()
    },
  )
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
  vi.useRealTimers()
})
function open(component, props = {}) {
  wrapper = mount(component, {
    props,
    global: {
      plugins: [createRouter({ history: createMemoryHistory(), routes }), ElButton, ElTag],
    },
  })
}
function button(label) {
  return wrapper.findAll('button').find((entry) => entry.text() === label)
}
async function click(label) {
  await button(label).trigger('click')
  await flushPromises()
}
async function select(file = new File(['original image'], 'photo.png', { type: 'image/png' })) {
  Object.defineProperty(wrapper.get('#image-file').element, 'files', {
    configurable: true,
    value: [file],
  })
  await wrapper.get('#image-file').trigger('change')
  await flushPromises()
}

it('二维码生成、设置变化清除旧结果、下载和清空', async () => {
  vi.useFakeTimers()
  open(QrCodeToolView)
  await wrapper.get('#qrcode-input').setValue('中文😀 https://example.com')
  await wrapper.get('#qrcode-size').setValue(512)
  await click('生成二维码')
  expect(generateQrCode).toHaveBeenCalledWith('中文😀 https://example.com', 512)
  expect(wrapper.get('img').attributes('src')).toBe('blob:local-1')
  await click('下载 PNG')
  expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce()
  await vi.advanceTimersByTimeAsync(1000)
  await wrapper.get('#qrcode-size').setValue(128)
  expect(wrapper.find('img').exists()).toBe(false)
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:local-1')
  await click('生成二维码')
  await click('清空')
  expect(wrapper.get('#qrcode-input').element.value).toBe('')
  expect(wrapper.get('#qrcode-size').element.value).toBe('256')
  expect(wrapper.find('img').exists()).toBe(false)
})
it('二维码错误与恢复', async () => {
  generateQrCode.mockRejectedValueOnce(new MediaError('请输入文本或 URL。'))
  open(QrCodeToolView)
  await click('生成二维码')
  expect(wrapper.get('[role="alert"]').text()).toBe('请输入文本或 URL。')
  expect(button('生成二维码').attributes('disabled')).toBeUndefined()
  await wrapper.get('#qrcode-input').setValue('ok')
  await click('生成二维码')
  expect(wrapper.find('[role="alert"]').exists()).toBe(false)
})
it.each(['clear', 'unmount'])('二维码未完成时 %s 不回填、不并发', async (action) => {
  let resolve
  generateQrCode.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done
      }),
  )
  open(QrCodeToolView)
  await wrapper.get('#qrcode-input').setValue('hello')
  await click('生成二维码')
  expect(wrapper.get('[aria-busy]').attributes('aria-busy')).toBe('true')
  await click('生成二维码')
  expect(generateQrCode).toHaveBeenCalledOnce()
  if (action === 'clear') await click('清空')
  else {
    wrapper.unmount()
    wrapper = undefined
  }
  resolve(new Blob(['x'], { type: 'image/png' }))
  await flushPromises()
  expect(URL.createObjectURL).not.toHaveBeenCalled()
})

it.each([
  [ImageCompressToolView, '压缩 / 重新编码'],
  [ImageResizeToolView, '调整尺寸'],
  [ImageConvertToolView, '转换格式'],
])('图片工具无文件操作提示', async (component, label) => {
  open(component)
  await click(label)
  expect(wrapper.get('[role="alert"]').text()).toBe('请先选择图片。')
  expect(wrapper.get('[aria-busy]').attributes('aria-busy')).toBe('false')
  expect(processImage).not.toHaveBeenCalled()
})
it.each([
  [new File(['GIF'], 'x.gif', { type: 'image/gif' }), 'GIF 动画'],
  [new File(['text'], 'x.txt', { type: 'text/plain' }), '不支持'],
  [{ name: 'large.png', type: 'image/png', size: 20 * 1024 * 1024 + 1 }, '文件过大'],
])('无效图片反馈并恢复 loading', async (file, expected) => {
  open(ImageCompressToolView)
  await select(file)
  expect(wrapper.get('[role="alert"]').text()).toContain(expected)
  expect(wrapper.find('img').exists()).toBe(false)
  expect(wrapper.get('[aria-busy]').attributes('aria-busy')).toBe('false')
})
it('PNG 压缩如实说明重新编码和没有变小，可下载及清空', async () => {
  vi.useFakeTimers()
  open(ImageCompressToolView)
  await select(new File(['x'], 'photo.png', { type: 'image/png' }))
  expect(wrapper.text()).toContain('PNG 将重新编码')
  expect(wrapper.find('#image-quality').exists()).toBe(false)
  await click('压缩 / 重新编码')
  expect(wrapper.get('[data-testid="result-info"]').text()).toContain('没有变小')
  expect(wrapper.text()).toContain('0.0%')
  expect(wrapper.text()).toContain('photo-compressed.png')
  await click('下载图片')
  await vi.advanceTimersByTimeAsync(1000)
  expect(HTMLAnchorElement.prototype.click.mock.instances[0].download).toBe('photo-compressed.png')
  await click('清空')
  expect(wrapper.find('img').exists()).toBe(false)
  expect(wrapper.find('[data-testid="result-info"]').exists()).toBe(false)
  expect(bitmap.close).toHaveBeenCalledOnce()
  expect(URL.revokeObjectURL).toHaveBeenCalledTimes(3)
})
it('JPEG 质量设置与结果失效', async () => {
  open(ImageCompressToolView)
  await select(new File(['original'], 'photo.jpg', { type: 'image/jpeg' }))
  expect(wrapper.get('#image-quality').element.value).toBe('80')
  await wrapper.get('#image-quality').setValue('40')
  await click('压缩 / 重新编码')
  expect(processImage).toHaveBeenCalledWith(bitmap, {
    width: 640,
    height: 480,
    mime: 'image/jpeg',
    quality: 40,
  })
  await wrapper.get('#image-quality').setValue('60')
  expect(wrapper.find('[data-testid="result-info"]').exists()).toBe(false)
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:local-2')
})
it('Resize 保持原始比例，双向调整和自定义宽高', async () => {
  open(ImageResizeToolView)
  await select()
  expect(wrapper.get('#image-ratio').element.checked).toBe(true)
  await wrapper.get('#image-width').setValue(320)
  expect(wrapper.get('#image-height').element.value).toBe('240')
  await wrapper.get('#image-height').setValue(120)
  expect(wrapper.get('#image-width').element.value).toBe('160')
  await wrapper.get('#image-ratio').setValue(false)
  await wrapper.get('#image-width').setValue(100)
  await click('调整尺寸')
  expect(processImage).toHaveBeenLastCalledWith(bitmap, {
    width: 100,
    height: 120,
    mime: 'image/png',
    quality: 80,
  })
  expect(wrapper.text()).toContain('photo-100x120.png')
  await wrapper.get('#image-ratio').setValue(true)
  expect(wrapper.get('#image-height').element.value).toBe('75')
  await wrapper.get('#image-width').setValue(0)
  await click('调整尺寸')
  expect(wrapper.get('[role="alert"]').text()).toContain('正整数')
})
it('极窄图片修改高度后允许像素取整，不反算宽度导致失真', async () => {
  bitmap.width = 1
  bitmap.height = 8192
  open(ImageResizeToolView)
  await select()
  await wrapper.get('#image-height').setValue(100)
  expect(wrapper.get('#image-width').element.value).toBe('1')
  await click('调整尺寸')
  expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  expect(processImage).toHaveBeenLastCalledWith(bitmap, {
    width: 1,
    height: 100,
    mime: 'image/png',
    quality: 80,
  })
})

it('转换格式动态质量、白背景说明、文件名和 MIME', async () => {
  open(ImageConvertToolView)
  await select()
  await wrapper.get('#image-format').setValue('image/jpeg')
  expect(wrapper.text()).toContain('透明区域将填充为白色')
  await wrapper.get('#image-quality').setValue('90')
  await click('转换格式')
  expect(wrapper.text()).toContain('photo.jpg')
  expect(processImage).toHaveBeenLastCalledWith(bitmap, {
    width: 640,
    height: 480,
    mime: 'image/jpeg',
    quality: 90,
  })
  await wrapper.get('#image-format').setValue('image/png')
  expect(wrapper.find('#image-quality').exists()).toBe(false)
  expect(wrapper.find('[data-testid="result-info"]').exists()).toBe(false)
  await click('转换格式')
  expect(wrapper.text()).toContain('photo.png')
})
it('处理失败不泄露内部错误，可再次成功', async () => {
  processImage.mockRejectedValueOnce(new Error('private DOMException stack'))
  open(ImageCompressToolView)
  await select()
  await click('压缩 / 重新编码')
  expect(wrapper.get('[role="alert"]').text()).toContain('处理失败')
  expect(wrapper.text()).not.toContain('private')
  expect(wrapper.get('[aria-busy]').attributes('aria-busy')).toBe('false')
  await click('压缩 / 重新编码')
  expect(wrapper.find('[data-testid="result-info"]').exists()).toBe(true)
})
it('替换图片与卸载释放原图和结果 URL、Bitmap', async () => {
  open(ImageCompressToolView)
  await select()
  await click('压缩 / 重新编码')
  const first = bitmap
  bitmap = { ...bitmap, close: vi.fn() }
  await select()
  expect(first.close).toHaveBeenCalledOnce()
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:local-1')
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:local-2')
  wrapper.unmount()
  wrapper = undefined
  expect(bitmap.close).toHaveBeenCalledOnce()
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:local-3')
})
it.each(['load', 'process'])('异步 %s 时禁止重复、清空阻止过期结果', async (phase) => {
  let resolve
  open(ImageCompressToolView)
  if (phase === 'load')
    loadImage.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
  else
    processImage.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
  await select()
  if (phase === 'process') await click('压缩 / 重新编码')
  expect(wrapper.get('#image-file').attributes('disabled')).toBeDefined()
  expect(button('压缩 / 重新编码').attributes('disabled')).toBeDefined()
  await click('清空')
  await click('压缩 / 重新编码')
  resolve(phase === 'load' ? bitmap : new Blob(['late'], { type: 'image/png' }))
  await flushPromises()
  expect(wrapper.find('img').exists()).toBe(false)
  expect(wrapper.get('[aria-busy]').attributes('aria-busy')).toBe('false')
  expect(bitmap.close).toHaveBeenCalledOnce()
})
it.each([
  ['qrcode', QrCodeToolView],
  ['image-compress', ImageCompressToolView],
  ['image-resize', ImageResizeToolView],
  ['image-convert', ImageConvertToolView],
])('路由 %s 优先具体页面，registry 开放卡片', async (slug, component) => {
  const router = createRouter({ history: createMemoryHistory(), routes })
  await router.push(`/tools/${slug}`)
  expect(router.currentRoute.value.name).toBe(`tool-${slug}`)
  const route = routes.find((entry) => entry.path === `/tools/${slug}`)
  expect(routes.indexOf(route)).toBeLessThan(
    routes.findIndex((entry) => entry.path === '/tools/:slug'),
  )
  expect((await route.component()).default).toBe(component)
  open(ToolCard, { item: { slug, name: slug, path: `/tools/${slug}` } })
  expect(wrapper.text()).toContain('已开放')
  expect(wrapper.get('.card-link').attributes('href')).toBe(`/tools/${slug}`)
})
