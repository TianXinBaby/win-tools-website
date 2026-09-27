import { describe, expect, it } from 'vitest'
import { generateNickname, nicknameCategories } from '../utils/tools/fun/nickname'
import { toAsciiArt } from '../utils/tools/fun/asciiArt'
import { parseWheelOptions, pickWheelIndex, nextWheelRotation } from '../utils/tools/fun/luckyWheel'
import {
  randomWaitDuration,
  calculateReactionTime,
  parseBestReaction,
  bestReactionTime,
} from '../utils/tools/fun/reaction'
import { isToolAvailable } from '../utils/tools/registry'

describe('随机昵称', () => {
  it.each([
    ['game', '暗影游侠'],
    ['developer', '代码骑士'],
    ['cute', '软糖同学'],
    ['fantasy', '漆黑之眼'],
  ])('%s 从对应词库组合', (category, expected) => {
    expect(generateNickname(category, () => 0)).toBe(expected)
    expect(nicknameCategories.some((item) => item.value === category)).toBe(true)
  })
  it('分别随机选择前缀和后缀', () => {
    const values = [0, 0.999]
    expect(generateNickname('game', () => values.shift())).toBe('暗影领航员')
  })
  it('拒绝无效分类和随机值', () => {
    expect(() => generateNickname('other')).toThrow('分类')
    expect(() => generateNickname('game', () => 1)).toThrow('随机数')
  })
})

describe('ASCII 字符映射', () => {
  it('大小写使用相同图案，输出仅含 ASCII 字符', () => {
    expect(toAsciiArt('a')).toBe(toAsciiArt('A'))
    expect(toAsciiArt('A')).toBe(' ###\n#   #\n#   #\n#####\n#   #\n#   #\n#   #')
    expect(toAsciiArt('A 1!?')).toMatch(/^[ #\n]+$/)
    expect(toAsciiArt('A 1!?').split('\n')).toHaveLength(7)
  })
  it.each(['', '  ', '中文', 'A\nB', '😀', 'A'.repeat(33)])(
    '拒绝空白、未映射或过长文本 %j',
    (input) => {
      expect(() => toAsciiArt(input)).toThrow()
    },
  )
})

describe('幸运转盘', () => {
  it('解析换行与中英文逗号，并保留完整选项', () => {
    expect(parseWheelOptions(' 读书\n散步， 看电影, 打游戏\n')).toEqual([
      '读书',
      '散步',
      '看电影',
      '打游戏',
    ])
  })
  it.each(['', '只有一个', Array(13).fill('A').join('\n'), `A\n${'字'.repeat(21)}`])(
    '拒绝数量或长度无效 %j',
    (input) => {
      expect(() => parseWheelOptions(input)).toThrow()
    },
  )
  it('随机索引覆盖首尾并拒绝越界随机值', () => {
    const options = ['A', 'B', 'C', 'D']
    expect(pickWheelIndex(options, () => 0)).toBe(0)
    expect(pickWheelIndex(options, () => 0.999)).toBe(3)
    expect(() => pickWheelIndex(options, () => -0.1)).toThrow()
    expect(() => pickWheelIndex(['A'], () => 0.5)).toThrow()
  })
  it('旋转至少五圈，最终指针落在抽中扇区的中心', () => {
    for (const count of [2, 4, 7, 12]) {
      for (let index = 0; index < count; index++) {
        const current = 731.5
        const end = nextWheelRotation(current, index, count)
        expect(end - current).toBeGreaterThanOrEqual(1800)
        expect((end + ((index + 0.5) * 360) / count) % 360).toBeCloseTo(0, 8)
      }
    }
  })
})

describe('反应时间', () => {
  it('随机等待时间在 1500 到 4000 ms 范围', () => {
    expect(randomWaitDuration(() => 0)).toBe(1500)
    expect(randomWaitDuration(() => 0.5)).toBe(2750)
    expect(randomWaitDuration(() => 0.999999)).toBe(4000)
  })
  it('计算单调时钟差值并四舍五入到毫秒', () => {
    expect(calculateReactionTime(1000, 1243.6)).toBe(244)
    expect(calculateReactionTime(1000, 1000)).toBe(0)
    expect(() => calculateReactionTime(1000, 999)).toThrow()
  })
  it('解析最佳成绩并仅更新更好成绩', () => {
    expect(parseBestReaction('243')).toBe(243)
    expect(parseBestReaction('0')).toBe(0)
    for (const invalid of [null, '-1', '1.5', '001', 'NaN', '9007199254740992']) {
      expect(parseBestReaction(invalid)).toBeNull()
    }
    expect(bestReactionTime(null, 250)).toBe(250)
    expect(bestReactionTime(250, 300)).toBe(250)
    expect(bestReactionTime(250, 200)).toBe(200)
  })
})

it('四个娱乐工具都在开放目录', () => {
  for (const slug of ['nickname-generator', 'ascii-art', 'lucky-wheel', 'reaction-test']) {
    expect(isToolAvailable(slug)).toBe(true)
  }
})
