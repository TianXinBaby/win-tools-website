export function generateUuid(cryptoApi = globalThis.crypto) {
  if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID()
  if (typeof cryptoApi?.getRandomValues !== 'function') {
    throw new Error('当前浏览器不支持此功能。')
  }
  const bytes = cryptoApi.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function generateUuids(count, cryptoApi = globalThis.crypto) {
  if (!Number.isInteger(count) || count < 1 || count > 100) {
    throw new Error('生成数量必须为 1 到 100 的整数。')
  }
  return Array.from({ length: count }, () => generateUuid(cryptoApi))
}
