import { describe, expect, it } from 'vitest'
import {
  appendTapParticles,
  createTapParticles,
  MAX_TAP_PARTICLES,
} from '../utils/tools/fun/mikutap'
import { PIANO_NOTES, pianoNoteFromEvent } from '../utils/tools/fun/onlinePiano'
import { createAvatar, renderAvatarSvg } from '../utils/tools/fun/randomAvatar'
import { calculateVolume, nextVoiceStatus } from '../utils/tools/fun/voiceBall'
import { isToolAvailable } from '../utils/tools/registry'

describe('Mikutap', () => {
  it('一次点击生成有限粒子，并将画面总量限制在上限内', () => {
    const burst = createTapParticles(40, 70, '#245cd4', () => 0)
    expect(burst).toHaveLength(20)
    expect(burst[0]).toEqual({
      x: 40,
      y: 70,
      vx: 1.5,
      vy: 0,
      radius: 2,
      life: 28,
      maxLife: 28,
      color: '#245cd4',
    })
    const capped = appendTapParticles(Array(MAX_TAP_PARTICLES).fill(burst[0]), burst)
    expect(capped).toHaveLength(MAX_TAP_PARTICLES)
    expect(capped.slice(-20)).toEqual(burst)
  })
})

describe('在线钢琴', () => {
  it('A 到 J 映射 C4 到 B4，忽略重复、组合键和表单输入', () => {
    expect(PIANO_NOTES.map((note) => note.key)).toEqual(['a', 's', 'd', 'f', 'g', 'h', 'j'])
    expect(pianoNoteFromEvent({ key: 'A' })).toEqual(PIANO_NOTES[0])
    expect(pianoNoteFromEvent({ key: 'j' })).toEqual(PIANO_NOTES[6])
    expect(PIANO_NOTES.map((note) => note.frequency)).toEqual([
      261.63, 293.66, 329.63, 349.23, 392, 440, 493.88,
    ])
    expect(pianoNoteFromEvent({ key: 'a', repeat: true })).toBeNull()
    expect(pianoNoteFromEvent({ key: 'a', ctrlKey: true })).toBeNull()
    expect(pianoNoteFromEvent({ key: 'a', target: { tagName: 'INPUT' } })).toBeNull()
    expect(pianoNoteFromEvent({ key: 'q' })).toBeNull()
  })
})

describe('随机头像', () => {
  it('随机组合全部五种元素，SVG 只使用预设值', () => {
    const first = createAvatar(() => 0)
    expect(first).toEqual({
      background: '#dbeafe',
      face: 'round',
      eyes: 'dots',
      mouth: 'smile',
      decoration: 'freckles',
    })
    const last = createAvatar(() => 0.99)
    expect(last).toEqual({
      background: '#e9e4ff',
      face: 'oval',
      eyes: 'sleepy',
      mouth: 'surprised',
      decoration: 'none',
    })
    const svg = renderAvatarSvg(first)
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"')
    expect(svg).toContain('fill="#dbeafe"')
    expect(svg).toContain('<circle cx="128" cy="140" r="78" />')
    expect(svg).toContain('<circle cx="100" cy="130" r="7" />')
    expect(svg).toContain('M103 166q25 29 50 0')
    expect(svg).toContain('<circle cx="79" cy="158" r="3" />')
    expect(renderAvatarSvg(last)).toContain('<ellipse cx="128" cy="140"')
    expect(() => renderAvatarSvg({ ...first, background: '" onload="alert(1)' })).toThrow()
    expect(() => renderAvatarSvg({ ...first, face: '__proto__' })).toThrow()
    expect(() => renderAvatarSvg({ ...first, decoration: 'constructor' })).toThrow()
  })
})

describe('声控弹力球', () => {
  it('计算声音波形的均方根音量', () => {
    expect(calculateVolume(new Uint8Array())).toBe(0)
    expect(calculateVolume(Uint8Array.from([128, 128, 128]))).toBe(0)
    expect(calculateVolume(Uint8Array.from([0, 255]))).toBeCloseTo(0.996, 2)
    expect(calculateVolume(Uint8Array.from([128, 192]))).toBeCloseTo(Math.sqrt(0.125))
  })
  it('只按合法操作切换未启动、等待授权和运行中状态', () => {
    expect(nextVoiceStatus('idle', 'start')).toBe('requesting')
    expect(nextVoiceStatus('requesting', 'granted')).toBe('running')
    expect(nextVoiceStatus('requesting', 'denied')).toBe('idle')
    expect(nextVoiceStatus('running', 'stop')).toBe('idle')
    expect(nextVoiceStatus('requesting', 'stop')).toBe('idle')
    expect(nextVoiceStatus('idle', 'granted')).toBe('idle')
  })
})

it('四个新工具在开放目录中', () => {
  for (const slug of ['mikutap', 'online-piano', 'random-avatar', 'voice-ball']) {
    expect(isToolAvailable(slug)).toBe(true)
  }
})
