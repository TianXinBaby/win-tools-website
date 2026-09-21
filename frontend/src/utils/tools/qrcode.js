import QRCode from 'qrcode'
import { MediaError, canvasToBlob } from './media'

export const QR_SIZES = [128, 256, 512, 1024]
export const QR_MAX_BYTES = 1200

export function validateQrInput(text, size) {
  if (typeof text !== 'string' || !text.trim()) throw new MediaError('请输入文本或 URL。')
  if (!QR_SIZES.includes(size)) throw new MediaError('请选择 128、256、512 或 1024 px。')
  if (typeof TextEncoder !== 'function') throw new MediaError('当前浏览器不支持文本编码。')
  if (text.length > QR_MAX_BYTES || new TextEncoder().encode(text).length > QR_MAX_BYTES)
    throw new MediaError(`内容过长，请控制在 ${QR_MAX_BYTES} 个 UTF-8 字节以内。`)
  return { width: size, margin: 4, errorCorrectionLevel: 'M' }
}

export async function generateQrCode(text, size) {
  const options = validateQrInput(text, size)
  let canvas
  try {
    const matrix = QRCode.create(text, options)
    if (matrix.modules.size + options.margin * 2 > size)
      throw new MediaError('此内容需要更大的二维码，请选择更大尺寸。')
    canvas = document.createElement('canvas')
    await QRCode.toCanvas(canvas, text, options)
    return await canvasToBlob(canvas, 'image/png')
  } catch (error) {
    if (error instanceof MediaError) throw error
    throw new MediaError('二维码生成失败，请缩短内容或检查浏览器 Canvas 支持。')
  } finally {
    if (canvas) canvas.width = canvas.height = 1
  }
}
