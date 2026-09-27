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
  'nickname-generator',
  'ascii-art',
  'lucky-wheel',
  'reaction-test',
])

export function isToolAvailable(slug) {
  return availableTools.has(slug)
}
