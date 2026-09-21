import { MediaError, canvasToBlob, createLocalUrl, safeFilename } from './media'

export const IMAGE_LIMITS = Object.freeze({
  maxBytes: 20 * 1024 * 1024,
  maxDimension: 8192,
  maxPixels: 16_000_000,
})
export const IMAGE_FORMATS = Object.freeze({
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
})
export const IMAGE_ACCEPT = Object.keys(IMAGE_FORMATS).join(',')

export function validateImageFile(file) {
  if (!file) throw new MediaError('请先选择图片。')
  if (file.type === 'image/gif' || /\.gif$/i.test(file.name))
    throw new MediaError('当前版本不支持保留 GIF 动画，请选择 JPEG、PNG 或 WebP。')
  if (!Object.hasOwn(IMAGE_FORMATS, file.type))
    throw new MediaError('不支持此文件类型，请选择 JPEG、PNG 或 WebP。')
  if (!file.size) throw new MediaError('图片文件为空。')
  if (file.size > IMAGE_LIMITS.maxBytes) throw new MediaError('文件过大，最多支持 20 MiB。')
}

export function validateDimensions(width, height) {
  if (![width, height].every((value) => Number.isSafeInteger(value) && value > 0))
    throw new MediaError('宽高必须为正整数，单位为 px。')
  if (
    width > IMAGE_LIMITS.maxDimension ||
    height > IMAGE_LIMITS.maxDimension ||
    width * height > IMAGE_LIMITS.maxPixels
  )
    throw new MediaError('图片尺寸过大：单边最多 8192 px，总像素最多 1600 万。')
  return { width, height }
}

export function calculateResizeDimensions(originalWidth, originalHeight, value, axis) {
  validateDimensions(originalWidth, originalHeight)
  if (!['width', 'height'].includes(axis)) throw new MediaError('请选择有效的宽高设置。')
  if (!Number.isSafeInteger(value) || value < 1)
    throw new MediaError('宽高必须为正整数，单位为 px。')
  return validateDimensions(
    axis === 'width' ? value : Math.max(1, Math.round((value * originalWidth) / originalHeight)),
    axis === 'height' ? value : Math.max(1, Math.round((value * originalHeight) / originalWidth)),
  )
}

export function qualityParameter(percent, mime) {
  if (!Object.hasOwn(IMAGE_FORMATS, mime)) throw new MediaError('不支持此输出格式。')
  if (mime === 'image/png') return undefined
  if (!Number.isInteger(percent) || percent < 10 || percent > 100)
    throw new MediaError('质量必须为 10% 到 100% 的整数。')
  return percent / 100
}

export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`
}

export function sizeSavings(before, after) {
  const saved = Math.max(0, before - after)
  return { saved, percent: before > 0 ? (saved / before) * 100 : 0, smaller: after < before }
}

export function imageFilename(name, mime, suffix = '') {
  if (!Object.hasOwn(IMAGE_FORMATS, mime)) throw new MediaError('不支持此输出格式。')
  const stem = safeFilename(String(name).replace(/\.[^.]*$/, '')).slice(0, 80)
  return safeFilename(`${stem}${suffix}.${IMAGE_FORMATS[mime]}`)
}

// Inspect container headers BEFORE decoding; a small compressed file can have huge dimensions.
export function readImageDimensions(buffer, mime) {
  const data = new DataView(buffer)
  const ascii = (offset, length) =>
    Array.from({ length }, (_, i) => String.fromCharCode(data.getUint8(offset + i))).join('')
  try {
    if (
      mime === 'image/png' &&
      data.getUint32(0) === 0x89504e47 &&
      data.getUint32(4) === 0x0d0a1a0a &&
      ascii(12, 4) === 'IHDR'
    )
      return validateDimensions(data.getUint32(16), data.getUint32(20))
    if (mime === 'image/jpeg' && data.getUint16(0) === 0xffd8) {
      let offset = 2
      while (offset + 4 <= data.byteLength) {
        if (data.getUint8(offset++) !== 0xff) break
        while (data.getUint8(offset) === 0xff) offset++
        const marker = data.getUint8(offset++)
        if (marker === 0xd9 || marker === 0xda) break
        if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue
        const length = data.getUint16(offset)
        if (length < 2 || offset + length > data.byteLength) break
        if (
          [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(
            marker,
          )
        )
          return validateDimensions(data.getUint16(offset + 5), data.getUint16(offset + 3))
        offset += length
      }
    }
    if (mime === 'image/webp' && ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') {
      const chunk = ascii(12, 4)
      if (chunk === 'VP8X') {
        if (data.getUint8(20) & 2) throw new MediaError('当前版本不支持动画 WebP，请选择静态图片。')
        const uint24 = (offset) =>
          data.getUint8(offset) +
          data.getUint8(offset + 1) * 256 +
          data.getUint8(offset + 2) * 65536
        return validateDimensions(uint24(24) + 1, uint24(27) + 1)
      }
      if (chunk === 'VP8L' && data.getUint8(20) === 0x2f) {
        const bits = data.getUint32(21, true)
        return validateDimensions((bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1)
      }
      if (
        chunk === 'VP8 ' &&
        data.getUint8(23) === 0x9d &&
        data.getUint8(24) === 1 &&
        data.getUint8(25) === 0x2a
      )
        return validateDimensions(
          data.getUint16(26, true) & 0x3fff,
          data.getUint16(28, true) & 0x3fff,
        )
    }
  } catch (error) {
    if (error instanceof MediaError) throw error
  }
  throw new MediaError('图片头无效或格式与文件类型不符，请选择有效图片。')
}

function loadHtmlImage(file) {
  return new Promise((resolve, reject) => {
    if (typeof Image !== 'function') {
      reject(new MediaError('当前浏览器不支持图片解码。'))
      return
    }
    const url = createLocalUrl(file)
    const image = new Image()
    const finish = () => {
      clearTimeout(timer)
      image.onload = image.onerror = null
      URL.revokeObjectURL(url)
    }
    const timer = setTimeout(() => {
      finish()
      image.src = ''
      reject(new MediaError('图片解码超时，请换一张图片。'))
    }, 15000)
    image.onload = () => {
      finish()
      resolve(image)
    }
    image.onerror = () => {
      finish()
      reject(new MediaError('图片解码失败，请选择有效图片。'))
    }
    image.src = url
  })
}

export async function loadImage(file) {
  validateImageFile(file)
  if (typeof file.arrayBuffer !== 'function') throw new MediaError('当前浏览器不支持读取图片。')
  let source
  try {
    readImageDimensions(await file.arrayBuffer(), file.type)
    source =
      typeof createImageBitmap === 'function'
        ? await createImageBitmap(file, { imageOrientation: 'from-image' })
        : await loadHtmlImage(file)
    const { width, height } = validateDimensions(
      source.naturalWidth || source.width,
      source.naturalHeight || source.height,
    )
    return {
      source,
      width,
      height,
      close: () => {
        if (typeof source.close === 'function') source.close()
        else source.src = ''
      },
    }
  } catch (error) {
    if (source) {
      if (typeof source.close === 'function') source.close()
      else source.src = ''
    }
    if (error instanceof MediaError) throw error
    throw new MediaError('图片解码失败，请选择有效图片或更换浏览器。')
  }
}

export async function processImage(image, { width, height, mime, quality = 80 }) {
  if (!image) throw new MediaError('请先选择图片。')
  validateDimensions(width, height)
  const parameter = qualityParameter(quality, mime)
  let canvas
  try {
    canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) throw new MediaError('当前浏览器无法创建 Canvas，请尝试更小的图片。')
    if (mime === 'image/jpeg') {
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, width, height)
    }
    context.drawImage(image.source, 0, 0, width, height)
    return await canvasToBlob(canvas, mime, parameter)
  } catch (error) {
    if (error instanceof MediaError) throw error
    throw new MediaError('图片处理失败，请尝试更小的尺寸或更换浏览器。')
  } finally {
    if (canvas) canvas.width = canvas.height = 1
  }
}
