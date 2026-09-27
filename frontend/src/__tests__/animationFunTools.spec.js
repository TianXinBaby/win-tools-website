import { describe, expect, it } from 'vitest'
import { createMagicParticles, magicKeyFromEvent } from '../utils/tools/fun/magicKeyboard'
import { calculateFps, calculateFrameTime } from '../utils/tools/fun/fps'
import {
  betterTypingScore,
  calculateTypingMetrics,
  parseBestTypingScore,
} from '../utils/tools/fun/typing'
import { isToolAvailable } from '../utils/tools/registry'

describe('魔法键盘', () => {
  it('识别字母、数字、标点和特殊键，忽略组合键与输入区域', () => {
    expect(magicKeyFromEvent({ key: 'a' })).toEqual({ label: 'A', color: '#397cf0' })
    expect(magicKeyFromEvent({ key: '7' })).toEqual({ label: '7', color: '#8b5cf6' })
    expect(magicKeyFromEvent({ key: '?' })).toEqual({ label: '?', color: '#00a6a6' })
    expect(magicKeyFromEvent({ key: ' ' }).label).toBe('空格')
    expect(magicKeyFromEvent({ key: 'ArrowLeft' }).label).toBe('←')
    expect(magicKeyFromEvent({ key: 'a', repeat: true })).toBeNull()
    expect(magicKeyFromEvent({ key: 'a', ctrlKey: true })).toBeNull()
    expect(magicKeyFromEvent({ key: 'a', target: { tagName: 'INPUT' } })).toBeNull()
    expect(magicKeyFromEvent({ key: 'Dead' })).toBeNull()
  })

  it('每次按键生成限定数量、从画布中心发出的粒子', () => {
    const particles = createMagicParticles(400, 200, '#397cf0', () => 0)
    expect(particles).toHaveLength(20)
    expect(particles[0]).toEqual({
      x: 200,
      y: 100,
      vx: 1.5,
      vy: 0,
      radius: 2,
      life: 28,
      maxLife: 28,
      color: '#397cf0',
    })
    expect(createMagicParticles(400, 200, '#00a6a6', () => 0.5)[0].vx).toBeCloseTo(-3)
  })
})

describe('FPS 计算', () => {
  it('按实际时间计算实时及平均 FPS', () => {
    expect(calculateFps(60, 1000)).toBe(60)
    expect(calculateFps(30, 500)).toBe(60)
    expect(calculateFps(59, 1010)).toBe(58.4)
    expect(calculateFps(1, 0)).toBe(0)
    expect(calculateFps(0, 1000)).toBe(0)
  })
  it('计算单帧耗时并拒绝反向时间', () => {
    expect(calculateFrameTime(100, 116.67)).toBe(16.7)
    expect(calculateFrameTime(116, 100)).toBe(0)
  })
})

describe('打字速度计算', () => {
  it('只用正确字符计算 WPM，计算准确率与用时', () => {
    expect(calculateTypingMetrics('hello world', 'hello worlx', 60000)).toEqual({
      wpm: 2,
      accuracy: 90.9,
      seconds: 60,
      correctChars: 10,
    })
    expect(calculateTypingMetrics('hello', 'heLlo', 12345)).toEqual({
      wpm: 4,
      accuracy: 80,
      seconds: 12.3,
      correctChars: 4,
    })
    expect(calculateTypingMetrics('hello', '', 0).wpm).toBe(0)
    expect(() => calculateTypingMetrics('hello', 'a', -1)).toThrow('时间')
  })
  it('只接受有效的最佳成绩，并按速度及正确率更新', () => {
    expect(parseBestTypingScore('{"wpm":85,"accuracy":98}')).toEqual({ wpm: 85, accuracy: 98 })
    expect(parseBestTypingScore('{"wpm":-1,"accuracy":100}')).toBeNull()
    expect(parseBestTypingScore('{"wpm":42,"accuracy":101}')).toBeNull()
    expect(parseBestTypingScore('invalid')).toBeNull()
    expect(betterTypingScore({ wpm: 85, accuracy: 90 }, { wpm: 85, accuracy: 98 })).toEqual({
      wpm: 85,
      accuracy: 98,
    })
    expect(betterTypingScore({ wpm: 85, accuracy: 90 }, { wpm: 84, accuracy: 100 })).toEqual({
      wpm: 85,
      accuracy: 90,
    })
  })
})

it('四个新增工具在开放目录中', () => {
  for (const slug of ['magic-keyboard', 'crt-tv', 'fps-test', 'typing-test']) {
    expect(isToolAvailable(slug)).toBe(true)
  }
})
