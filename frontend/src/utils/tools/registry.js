const availableTools = new Set([
  'json',
  'uuid',
  'timestamp',
  'sha256',
  'base64',
  'qrcode',
  'image-compress',
  'image-resize',
  'image-convert',
])

export function isToolAvailable(slug) {
  return availableTools.has(slug)
}
