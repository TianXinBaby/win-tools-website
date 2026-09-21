function checkSupport() {
  if (
    typeof globalThis.TextEncoder !== 'function' ||
    typeof globalThis.TextDecoder !== 'function' ||
    typeof globalThis.btoa !== 'function' ||
    typeof globalThis.atob !== 'function'
  ) {
    throw new Error('当前浏览器不支持此功能。')
  }
}

export function encodeBase64(input) {
  checkSupport()
  const bytes = new TextEncoder().encode(input)
  // 避免将长文本展开成函数参数而超过浏览器调用栈限制。
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

export function decodeBase64(input) {
  checkSupport()
  const text = input.replace(/[\t\n\r ]/g, '')
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(text)) {
    throw new Error('请输入有效的标准 Base64（包含必要的 = 填充）。')
  }
  try {
    const binary = atob(text)
    if (btoa(binary) !== text) throw new Error('Noncanonical Base64')
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)
  } catch {
    throw new Error('Base64 内容无效，或解码结果不是有效的 UTF-8 文本。')
  }
}
