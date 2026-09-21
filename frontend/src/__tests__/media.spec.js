import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import QRCode from 'qrcode'
import {
  IMAGE_LIMITS,
  calculateResizeDimensions,
  formatFileSize,
  imageFilename,
  loadImage,
  processImage,
  qualityParameter,
  readImageDimensions,
  sizeSavings,
  validateDimensions,
  validateImageFile,
} from '../utils/tools/image'
import { canvasToBlob, downloadBlob, mediaErrorMessage, safeFilename } from '../utils/tools/media'
import { generateQrCode, validateQrInput } from '../utils/tools/qrcode'

vi.mock('qrcode', () => ({
  default: { create: vi.fn(() => ({ modules: { size: 21 } })), toCanvas: vi.fn(async () => {}) },
}))
const pngHeader = (width = 640, height = 480) => {
  const buffer = new ArrayBuffer(24)
  const data = new DataView(buffer)
  data.setUint32(0, 0x89504e47)
  data.setUint32(4, 0x0d0a1a0a)
  data.setUint32(12, 0x49484452)
  data.setUint32(16, width)
  data.setUint32(20, height)
  return buffer
}
const file = (extra = {}) => ({
  name: 'photo.png',
  type: 'image/png',
  size: 100,
  arrayBuffer: async () => pngHeader(),
  ...extra,
})
let context
beforeEach(() => {
  context = { fillRect: vi.fn(), drawImage: vi.fn() }
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context)
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (callback, mime) {
    callback(new Blob(['result'], { type: mime }))
  })
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = vi.fn(() => 'blob:test')
      static revokeObjectURL = vi.fn()
    },
  )
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('二维码输入与导出边界', () => {
  it.each(['', ' ', '\n'])('拒绝空输入 %j', (text) =>
    expect(() => validateQrInput(text, 256)).toThrow('请输入'),
  )
  it.each(['hello', '中文', '😀', 'https://example.com/?a=中文', '  exact text  '])(
    '原样编码 %s',
    async (text) => {
      const blob = await generateQrCode(text, 256)
      expect(blob.type).toBe('image/png')
      expect(QRCode.toCanvas).toHaveBeenCalledWith(expect.any(HTMLCanvasElement), text, {
        width: 256,
        margin: 4,
        errorCorrectionLevel: 'M',
      })
    },
  )
  it.each([128, 256, 512, 1024])('允许尺寸 %i', (size) =>
    expect(validateQrInput('ok', size).width).toBe(size),
  )
  it.each([0, -1, 127, 129, 1025, Infinity, NaN, '256'])('拒绝尺寸 %s', (size) =>
    expect(() => validateQrInput('ok', size)).toThrow('请选择'),
  )
  it('按 UTF-8 字节数限制内容', () => {
    expect(() => validateQrInput('中'.repeat(400), 512)).not.toThrow()
    expect(() => validateQrInput('中'.repeat(401), 512)).toThrow('内容过长')
    expect(() => validateQrInput('😀'.repeat(301), 512)).toThrow('内容过长')
  })
  it('较密矩阵要求更大尺寸', async () => {
    QRCode.create.mockReturnValueOnce({ modules: { size: 121 } })
    await expect(generateQrCode('text', 128)).rejects.toThrow('更大尺寸')
  })
  it('库内部错误提供中文提示', async () => {
    QRCode.toCanvas.mockRejectedValueOnce(new Error('internal'))
    await expect(generateQrCode('text', 256)).rejects.toThrow('二维码生成失败')
  })
})

describe('图片校验和尺寸算法', () => {
  it.each(['image/jpeg', 'image/png', 'image/webp'])('接受 %s', (type) =>
    expect(() => validateImageFile(file({ type }))).not.toThrow(),
  )
  it.each(['image/gif', 'image/heic', 'image/avif', 'text/plain', ''])('拒绝 %s', (type) =>
    expect(() => validateImageFile(file({ type }))).toThrow(),
  )
  it('无文件、空文件、GIF 后缀、大小边界', () => {
    expect(() => validateImageFile()).toThrow('请先选择')
    expect(() => validateImageFile(file({ size: 0 }))).toThrow('为空')
    expect(() => validateImageFile(file({ name: 'hidden.GIF' }))).toThrow('GIF 动画')
    expect(() => validateImageFile(file({ size: IMAGE_LIMITS.maxBytes }))).not.toThrow()
    expect(() => validateImageFile(file({ size: IMAGE_LIMITS.maxBytes + 1 }))).toThrow('文件过大')
  })
  it.each([0, -1, 1.5, Infinity, NaN, '100'])('拒绝非正整数 %s', (value) =>
    expect(() => validateDimensions(value, 100)).toThrow('正整数'),
  )
  it('总像素及单边保护', () => {
    expect(validateDimensions(4000, 4000)).toEqual({ width: 4000, height: 4000 })
    expect(() => validateDimensions(4001, 4000)).toThrow('尺寸过大')
    expect(() => validateDimensions(8193, 1)).toThrow('尺寸过大')
    expect(validateDimensions(8192, 1).width).toBe(8192)
  })
  it('按原始比例计算两个方向并取整', () => {
    expect(calculateResizeDimensions(1920, 1080, 800, 'width')).toEqual({ width: 800, height: 450 })
    expect(calculateResizeDimensions(1920, 1080, 600, 'height')).toEqual({
      width: 1067,
      height: 600,
    })
    expect(calculateResizeDimensions(8192, 1, 1, 'width')).toEqual({ width: 1, height: 1 })
    expect(() => calculateResizeDimensions(100, 100, 0, 'width')).toThrow()
    expect(() => calculateResizeDimensions(1, 8192, 8192, 'width')).toThrow('尺寸过大')
  })
  it.each([10, 80, 100])('质量 %i 映射', (quality) =>
    expect(qualityParameter(quality, 'image/jpeg')).toBe(quality / 100),
  )
  it.each([0, 9, 101, NaN, Infinity, 80.5])('拒绝质量 %s', (quality) =>
    expect(() => qualityParameter(quality, 'image/webp')).toThrow('质量'),
  )
  it('PNG 无质量、非法 MIME 拒绝', () => {
    expect(qualityParameter(50, 'image/png')).toBeUndefined()
    expect(() => qualityParameter(80, 'image/gif')).toThrow('输出格式')
  })
  it('文件大小和无负数节省比例', () => {
    expect(formatFileSize(20)).toBe('20 B')
    expect(formatFileSize(1024)).toBe('1.0 KiB')
    expect(formatFileSize(1048576)).toBe('1.00 MiB')
    expect(sizeSavings(100, 80)).toEqual({ saved: 20, percent: 20, smaller: true })
    expect(sizeSavings(100, 120)).toEqual({ saved: 0, percent: 0, smaller: false })
    expect(sizeSavings(100, 100).smaller).toBe(false)
  })
  it('输出文件名格式匹配且清理路径和非法字符', () => {
    expect(imageFilename('photo.png', 'image/jpeg', '-compressed')).toBe('photo-compressed.jpg')
    expect(imageFilename('photo.jpg', 'image/png', '-800x600')).toBe('photo-800x600.png')
    expect(imageFilename('photo.jpg', 'image/webp')).toBe('photo.webp')
    expect(safeFilename('../../a\\b:?.png')).not.toMatch(/[/:\\?]|\.{2}/)
    expect(safeFilename('CON')).toBe('image-CON')
  })
})

describe('解码前图片头保护', () => {
  it('PNG 识别及超限拒绝', () => {
    expect(readImageDimensions(pngHeader(), 'image/png')).toEqual({ width: 640, height: 480 })
    expect(() => readImageDimensions(pngHeader(60000, 60000), 'image/png')).toThrow('尺寸过大')
  })
  it('JPEG SOF 尺寸读取', () => {
    const bytes = Uint8Array.from([
      255, 216, 255, 224, 0, 4, 0, 0, 255, 192, 0, 8, 8, 1, 224, 2, 128, 0,
    ])
    expect(readImageDimensions(bytes.buffer, 'image/jpeg')).toEqual({ width: 640, height: 480 })
  })
  it.each(['VP8X', 'VP8L', 'VP8 '])('WebP %s 头读取', (chunk) => {
    const bytes = new Uint8Array(30)
    const data = new DataView(bytes.buffer)
    bytes.set(new TextEncoder().encode('RIFF'), 0)
    bytes.set(new TextEncoder().encode('WEBP'), 8)
    bytes.set(new TextEncoder().encode(chunk), 12)
    if (chunk === 'VP8X') {
      bytes[24] = 99
      bytes[27] = 49
    }
    if (chunk === 'VP8L') {
      bytes[20] = 0x2f
      data.setUint32(21, 99 | (49 << 14), true)
    }
    if (chunk === 'VP8 ') {
      bytes.set([0x9d, 1, 0x2a], 23)
      data.setUint16(26, 100, true)
      data.setUint16(28, 50, true)
    }
    expect(readImageDimensions(bytes.buffer, 'image/webp')).toEqual({ width: 100, height: 50 })
  })
  it('拒绝动画 WebP', () => {
    const bytes = new Uint8Array(30)
    bytes.set(new TextEncoder().encode('RIFF'), 0)
    bytes.set(new TextEncoder().encode('WEBPVP8X'), 8)
    bytes[20] = 2
    expect(() => readImageDimensions(bytes.buffer, 'image/webp')).toThrow('动画 WebP')
  })
  it.each([new ArrayBuffer(0), new ArrayBuffer(5), pngHeader()])('拒绝截断或伪造类型', (buffer) =>
    expect(() => readImageDimensions(buffer, 'image/jpeg')).toThrow('图片头无效'),
  )
})

describe('浏览器边界和资源释放', () => {
  it('超大尺寸在解码前拒绝', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn())
    await expect(
      loadImage(file({ arrayBuffer: async () => pngHeader(50000, 50000) })),
    ).rejects.toThrow('尺寸过大')
    expect(createImageBitmap).not.toHaveBeenCalled()
  })
  it('Bitmap 使用方向参数，支持关闭', async () => {
    const bitmap = { width: 640, height: 480, close: vi.fn() }
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap))
    const input = file()
    const loaded = await loadImage(input)
    expect(createImageBitmap).toHaveBeenCalledWith(input, { imageOrientation: 'from-image' })
    loaded.close()
    expect(bitmap.close).toHaveBeenCalledOnce()
  })
  it('解码后超限也会关闭 Bitmap', async () => {
    const bitmap = { width: 10000, height: 10000, close: vi.fn() }
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap))
    await expect(loadImage(file())).rejects.toThrow('尺寸过大')
    expect(bitmap.close).toHaveBeenCalledOnce()
  })
  it('解码失败只返回友好消息', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('private-stack')))
    await expect(loadImage(file())).rejects.toThrow('图片解码失败')
    expect(mediaErrorMessage(new Error('private-stack'))).not.toContain('private-stack')
  })
  it('HTMLImageElement fallback 释放解码 URL', async () => {
    vi.stubGlobal('createImageBitmap', undefined)
    vi.stubGlobal(
      'Image',
      class {
        naturalWidth = 640
        naturalHeight = 480
        set src(value) {
          if (value) queueMicrotask(() => this.onload?.())
        }
      },
    )
    const loaded = await loadImage(file())
    expect(loaded.width).toBe(640)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test')
    loaded.close()
  })
  it('缺少全部图片解码 API 时不创建 URL', async () => {
    vi.stubGlobal('createImageBitmap', undefined)
    vi.stubGlobal('Image', undefined)
    await expect(loadImage(file())).rejects.toThrow('不支持图片解码')
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })
  it('HTML 解码超时退出并释放资源', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('createImageBitmap', undefined)
    vi.stubGlobal('Image', class {})
    const promise = loadImage(file()).catch((error) => error)
    await vi.advanceTimersByTimeAsync(15000)
    expect((await promise).message).toContain('超时')
    expect(URL.revokeObjectURL).toHaveBeenCalledOnce()
  })
  it('JPEG 先填白再绘图，释放 Canvas', async () => {
    await processImage({ source: {} }, { width: 100, height: 50, mime: 'image/jpeg', quality: 80 })
    expect(context.fillStyle).toBe('#ffffff')
    expect(context.fillRect).toHaveBeenCalledWith(0, 0, 100, 50)
    expect(context.fillRect.mock.invocationCallOrder[0]).toBeLessThan(
      context.drawImage.mock.invocationCallOrder[0],
    )
    expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledWith(
      expect.any(Function),
      'image/jpeg',
      0.8,
    )
    expect(HTMLCanvasElement.prototype.toBlob.mock.instances[0].width).toBe(1)
  })
  it('PNG 保留透明并忽略质量', async () => {
    await processImage({ source: {} }, { width: 100, height: 50, mime: 'image/png', quality: 50 })
    expect(context.fillRect).not.toHaveBeenCalled()
    expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledWith(
      expect.any(Function),
      'image/png',
      undefined,
    )
  })
  it('Canvas 无上下文或绘图失败', async () => {
    HTMLCanvasElement.prototype.getContext.mockReturnValueOnce(null)
    await expect(
      processImage({ source: {} }, { width: 10, height: 10, mime: 'image/png' }),
    ).rejects.toThrow('Canvas')
    context.drawImage.mockImplementationOnce(() => {
      throw new Error('DOMException')
    })
    await expect(
      processImage({ source: {} }, { width: 10, height: 10, mime: 'image/png' }),
    ).rejects.toThrow('图片处理失败')
  })
  it.each([null, new Blob([], { type: 'image/png' }), new Blob(['data'], { type: 'image/png' })])(
    '拒绝空导出或 MIME 静默回退',
    async (blob) => {
      await expect(
        canvasToBlob({ toBlob: (done) => done(blob) }, 'image/webp', 0.8),
      ).rejects.toThrow()
    },
  )
  it('导出 API 缺失和同步失败', async () => {
    await expect(canvasToBlob({}, 'image/png')).rejects.toThrow('不支持')
    await expect(
      canvasToBlob(
        {
          toBlob: () => {
            throw new Error('internal')
          },
        },
        'image/png',
      ),
    ).rejects.toThrow('导出失败')
  })
  it('下载创建链接后延迟回收 URL', async () => {
    vi.useFakeTimers()
    let anchor
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
      anchor = this
    })
    downloadBlob(new Blob(['png'], { type: 'image/png' }), 'qrcode.png')
    expect(anchor.download).toBe('qrcode.png')
    expect(anchor.href).toBe('blob:test')
    expect(document.body.contains(anchor)).toBe(false)
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1000)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test')
  })
  it('下载失败也回收，缺少 API 友好错误', async () => {
    vi.useFakeTimers()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(() => downloadBlob(new Blob(['x']), 'x.png')).toThrow('下载失败')
    await vi.advanceTimersByTimeAsync(1000)
    expect(URL.revokeObjectURL).toHaveBeenCalledOnce()
    URL.createObjectURL = undefined
    expect(() => downloadBlob(new Blob(['x']), 'x.png')).toThrow('不支持')
    expect(() => downloadBlob(null, 'x.png')).toThrow('请先生成')
  })
})
