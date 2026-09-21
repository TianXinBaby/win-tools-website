export class MediaError extends Error {}

export function mediaErrorMessage(error) {
  return error instanceof MediaError ? error.message : '处理失败，请重试或换一张图片。'
}

export function createLocalUrl(blob) {
  if (!URL.createObjectURL || !URL.revokeObjectURL)
    throw new MediaError('当前浏览器不支持本地文件预览或下载。')
  return URL.createObjectURL(blob)
}

export function canvasToBlob(canvas, mime, quality) {
  return new Promise((resolve, reject) => {
    if (typeof canvas.toBlob !== 'function') {
      reject(new MediaError('当前浏览器不支持图片导出。'))
      return
    }
    try {
      canvas.toBlob(
        (blob) => {
          if (!blob || !blob.size) reject(new MediaError('图片导出失败，请尝试更小的尺寸。'))
          else if (blob.type !== mime)
            reject(new MediaError('当前浏览器不支持输出此格式，请选择 PNG 或 JPEG。'))
          else resolve(blob)
        },
        mime,
        mime === 'image/png' ? undefined : quality,
      )
    } catch {
      reject(new MediaError('图片导出失败，请尝试更小的尺寸。'))
    }
  })
}

export function safeFilename(name) {
  const cleaned = Array.from(String(name), (char) =>
    char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 ? '_' : char,
  )
    .join('')
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\.{2,}/g, '_')
    .replace(/^[. ]+|[. ]+$/g, '')
    .slice(0, 120)
  return !cleaned || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(cleaned)
    ? `image-${cleaned || 'output'}`
    : cleaned
}

export function downloadBlob(blob, filename) {
  if (!blob?.size) throw new MediaError('请先生成可下载的结果。')
  const url = createLocalUrl(blob)
  const link = document.createElement('a')
  try {
    link.href = url
    link.download = safeFilename(filename)
    document.body.append(link)
    link.click()
  } catch {
    throw new MediaError('下载失败，请重试。')
  } finally {
    link.remove()
    // Give the browser time to start reading the Blob before releasing the URL.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}
