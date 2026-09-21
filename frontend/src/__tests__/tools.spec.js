import { afterEach, describe, expect, it, vi } from 'vitest'
import { webcrypto, createHash } from 'node:crypto'
import { formatJson, compactJson } from '../utils/tools/json'
import { generateUuid, generateUuids } from '../utils/tools/uuid'
import {
  timestampToDate,
  dateToTimestamp,
  parseLocalDateTime,
  formatLocalDateTime,
} from '../utils/tools/timestamp'
import { sha256 } from '../utils/tools/sha256'
import { encodeBase64, decodeBase64 } from '../utils/tools/base64'
import { isToolAvailable } from '../utils/tools/registry'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('JSON 原生解析与序列化', () => {
  it.each([{ a: 1 }, { a: { b: [1, true, null] } }, [1, 'a'], true, false, null, 42, '中文'])(
    '格式化和压缩 %j',
    (value) => {
      const input = JSON.stringify(value)
      expect(formatJson(input)).toBe(JSON.stringify(value, null, 2))
      expect(compactJson(formatJson(input))).toBe(input)
    },
  )
  it.each(['', '{', '{"a":}', '{"a":1,}', 'undefined', '{"a":NaN}'])(
    '拒绝非法 JSON %s',
    (value) => {
      expect(() => formatJson(value)).toThrow()
      expect(() => compactJson(value)).toThrow()
    },
  )
})

describe('UUID v4', () => {
  const pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
  it('优先使用 randomUUID', () => {
    const api = {
      randomUUID: vi.fn(() => '31e0ef74-3504-4d15-9df6-4cd788e3c6c1'),
      getRandomValues: vi.fn(),
    }
    expect(generateUuid(api)).toMatch(pattern)
    expect(api.randomUUID).toHaveBeenCalledOnce()
    expect(api.getRandomValues).not.toHaveBeenCalled()
  })
  it.each([0, 0x40, 0x80, 0xff])('fallback 强制正确 version 和 variant：%i', (byte) => {
    const api = { getRandomValues: vi.fn((bytes) => bytes.fill(byte)) }
    expect(generateUuid(api)).toMatch(pattern)
    expect(api.getRandomValues).toHaveBeenCalledWith(expect.any(Uint8Array))
  })
  it.each([1, 5, 10, 20, 50, 100])('真实 Web Crypto 生成 %i 个', (count) => {
    const results = generateUuids(count, webcrypto)
    expect(results).toHaveLength(count)
    results.forEach((value) => expect(value).toMatch(pattern))
  })
  it.each([0, -1, 101, 1.5, NaN, Infinity, '5'])('拒绝非法数量 %s', (count) => {
    expect(() => generateUuids(count, webcrypto)).toThrow('1 到 100')
  })
  it('缺少安全随机 API 时拒绝生成', () => {
    expect(() => generateUuid({})).toThrow('当前浏览器不支持')
    expect(() => generateUuid(null)).toThrow('当前浏览器不支持')
  })
})

describe('时间戳不依赖机器时区或当前时间', () => {
  it.each([
    ['0', 'seconds', 0],
    ['0', 'milliseconds', 0],
    ['1700000000', 'seconds', 1700000000000],
    ['1700000000123', 'milliseconds', 1700000000123],
    ['-1', 'seconds', -1000],
    ['-1', 'milliseconds', -1],
    ['8640000000000000', 'milliseconds', 8640000000000000],
    ['-8640000000000000', 'milliseconds', -8640000000000000],
    ['8640000000000', 'seconds', 8640000000000000],
  ])('%s %s 转换为 Date', (input, unit, expected) => {
    expect(timestampToDate(input, unit).getTime()).toBe(expected)
  })
  it.each([0, -1, -1000, 1700000000123, 8640000000000000])('Date %i 转换为秒和毫秒', (value) => {
    expect(dateToTimestamp(new Date(value), 'milliseconds')).toBe(value)
    expect(dateToTimestamp(new Date(value), 'seconds')).toBe(Math.floor(value / 1000))
  })
  it.each([
    '',
    ' ',
    'abc',
    '1.5',
    'NaN',
    'Infinity',
    '0x10',
    '1e3',
    '8640000000000001',
    '-8640000000000001',
  ])('拒绝非法或越界值 %s', (value) => {
    expect(() => timestampToDate(value, 'milliseconds')).toThrow()
  })
  it('秒边界、无效单位和无效 Date', () => {
    expect(() => timestampToDate('8640000000001', 'seconds')).toThrow('有效范围')
    expect(() => timestampToDate('1', 'auto')).toThrow('请选择')
    expect(() => dateToTimestamp(new Date(NaN), 'seconds')).toThrow('有效的日期')
    expect(() => dateToTimestamp('2020-01-01', 'seconds')).toThrow()
    expect(() => formatLocalDateTime(new Date(NaN))).toThrow()
  })
  it('本地时间解析保留毫秒，输出使用相同本地年月日', () => {
    const result = parseLocalDateTime('2024-02-29T12:34:56.123')
    expect(result.getFullYear()).toBe(2024)
    expect(result.getMonth()).toBe(1)
    expect(result.getDate()).toBe(29)
    expect(result.getHours()).toBe(12)
    expect(result.getMilliseconds()).toBe(123)
    expect(formatLocalDateTime(result)).toBe('2024-02-29 12:34:56.123')
    expect(parseLocalDateTime('2024-02-29T12:34:56.1').getMilliseconds()).toBe(100)
    expect(parseLocalDateTime('0099-01-01T12:00').getFullYear()).toBe(99)
  })
  it.each([
    '',
    '2023-02-29T12:00',
    '2024-13-01T12:00',
    '2024-01-32T12:00',
    '2024-01-01T24:00',
    '2024-01-01T12:60',
    '2024-01-01T12:00:60',
    '2024-01-01',
  ])('拒绝无效日期 %s', (value) => {
    expect(() => parseLocalDateTime(value)).toThrow()
  })
})

describe('SHA-256 真实标准向量', () => {
  it.each([
    ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
    ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
  ])('计算 %s', async (input, expected) => {
    vi.stubGlobal('crypto', webcrypto)
    expect(await sha256(input)).toBe(expected)
  })
  it('Unicode 使用 UTF-8 字节，结果与独立 Node Hash 一致', async () => {
    vi.stubGlobal('crypto', webcrypto)
    const input = '中文😀𝄞\n'
    const expected = createHash('sha256').update(input, 'utf8').digest('hex')
    expect(await sha256(input)).toBe(expected)
    expect(await sha256(input)).toMatch(/^[0-9a-f]{64}$/)
  })
  it.each(['crypto', 'TextEncoder'])('缺少 %s 显示不支持', async (name) => {
    vi.stubGlobal('crypto', webcrypto)
    vi.stubGlobal(name, undefined)
    await expect(sha256('abc')).rejects.toThrow('当前浏览器不支持此功能。')
  })
})

describe('Base64 UTF-8', () => {
  it.each([
    ['hello', 'aGVsbG8='],
    ['中文', '5Lit5paH'],
    ['😀', '8J+YgA=='],
    ['', ''],
    ['a\nb', 'YQpi'],
  ])('编码和解码 %j', (plain, encoded) => {
    expect(encodeBase64(plain)).toBe(encoded)
    expect(decodeBase64(encoded)).toBe(plain)
  })
  it.each(['中文😀𝄞é\u0301', '\uFEFF保留 BOM', '\u0000\t\r\n', '长😀'.repeat(100000)])(
    'Unicode 和长文本往返 %#',
    (value) => {
      expect(decodeBase64(encodeBase64(value))).toBe(value)
    },
  )
  it('允许编码中的 ASCII 空白', () => {
    expect(decodeBase64(' 5Lit\n5paH\t')).toBe('中文')
  })
  it.each(['%%%', '中', 'a', 'a===', '=YWJj', 'YQ=', 'YR==', '/w==', 'wA==', '8J-YgA=='])(
    '拒绝非法 Base64 或非法 UTF-8 %s',
    (value) => {
      expect(() => decodeBase64(value)).toThrow()
    },
  )
  it.each(['TextEncoder', 'TextDecoder', 'btoa', 'atob'])('缺少 %s 显示不支持', (name) => {
    vi.stubGlobal(name, undefined)
    expect(() => encodeBase64('abc')).toThrow('当前浏览器不支持')
    expect(() => decodeBase64('')).toThrow('当前浏览器不支持')
  })
})

it('registry 仅开放本阶段五个工具', () => {
  for (const slug of ['json', 'uuid', 'timestamp', 'sha256', 'base64'])
    expect(isToolAvailable(slug)).toBe(true)
  for (const slug of ['qr-code', 'image-compress', 'unknown', 'toString'])
    expect(isToolAvailable(slug)).toBe(false)
})
