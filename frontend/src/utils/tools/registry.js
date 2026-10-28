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
  'video-converter',
  'nickname-generator',
  'ascii-art',
  'lucky-wheel',
  'reaction-test',
  'magic-keyboard',
  'crt-tv',
  'fps-test',
  'typing-test',
  'mikutap',
  'online-piano',
  'random-avatar',
  'voice-ball',
])

export function isToolAvailable(slug) {
  return availableTools.has(slug)
}
