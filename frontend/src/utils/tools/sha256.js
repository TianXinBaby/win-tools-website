export async function sha256(input) {
  if (
    typeof globalThis.crypto?.subtle?.digest !== 'function' ||
    typeof globalThis.TextEncoder !== 'function'
  ) {
    throw new Error('当前浏览器不支持此功能。')
  }
  const bytes = new TextEncoder().encode(input)
  const buffer = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
