import { describe, expect, it } from 'vitest'
import { officialDownloadUrl, safeImageUrl } from '../utils/urls'

describe('外部链接安全', () => {
  it.each([
    'https://www.microsoft.com/software-download/windows11',
    'https://microsoft.com/',
    'https://download.microsoft.com/example',
  ])('保留后端官方 URL %s', (url) => {
    expect(officialDownloadUrl(url)).toBe(url)
  })
  it.each([
    null,
    '',
    'javascript:alert(1)',
    'http://www.microsoft.com/a',
    'https://microsoft.com.evil.example/a',
    'https://evil-microsoft.com/a',
    'https://microsoft.com@evil.example/a',
    'https://user:password@microsoft.com/a',
    '/download',
  ])('拒绝不安全或非官方地址 %s', (url) => {
    expect(officialDownloadUrl(url)).toBe('')
  })
  it.each([
    'javascript:alert(1)',
    'data:image/svg+xml,<svg onload=alert(1)>',
    'file:///a',
    'https://user:password@example.com/a',
    null,
  ])('拒绝危险图片 %s', (url) => {
    expect(safeImageUrl(url)).toBe('')
  })
  it('允许 HTTPS 和相对图片地址', () => {
    expect(safeImageUrl('https://example.com/a.png')).toBe('https://example.com/a.png')
    expect(safeImageUrl('/cover.png')).toBe(`${window.location.origin}/cover.png`)
  })
})
