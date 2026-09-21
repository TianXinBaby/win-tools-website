export function safeImageUrl(value) {
  if (typeof value !== 'string' || !value) return ''
  try {
    const url = new URL(value, window.location.origin)
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : ''
  } catch {
    return ''
  }
}

export function officialDownloadUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      (url.hostname === 'microsoft.com' || url.hostname.endsWith('.microsoft.com'))
      ? url.href
      : ''
  } catch {
    return ''
  }
}
