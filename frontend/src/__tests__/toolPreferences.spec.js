import { beforeEach, describe, expect, it } from 'vitest'
import {
  FAVORITES_KEY,
  RECENT_KEY,
  recordRecentTool,
  refreshToolPreferences,
  toggleFavorite,
  useToolPreferences,
} from '../utils/toolPreferences'

beforeEach(() => {
  localStorage.clear()
  refreshToolPreferences()
})

describe('浏览器本地工具偏好', () => {
  it('添加和取消收藏，保存 slug 并允许重新读取', () => {
    const { favorites } = useToolPreferences()
    toggleFavorite('json')
    expect(favorites.value).toEqual(['json'])
    expect(JSON.parse(localStorage.getItem(FAVORITES_KEY))).toEqual(['json'])
    refreshToolPreferences()
    expect(favorites.value).toEqual(['json'])
    toggleFavorite('json')
    expect(favorites.value).toEqual([])
    expect(JSON.parse(localStorage.getItem(FAVORITES_KEY))).toEqual([])
  })

  it('最近使用去重、重新访问置顶并最多保留 10 项', () => {
    const { recent } = useToolPreferences()
    for (let index = 0; index < 12; index++) recordRecentTool(`tool-${index}`)
    expect(recent.value).toHaveLength(10)
    expect(recent.value[0]).toBe('tool-11')
    expect(recent.value).not.toContain('tool-0')
    recordRecentTool('tool-5')
    expect(recent.value[0]).toBe('tool-5')
    expect(recent.value.filter((slug) => slug === 'tool-5')).toHaveLength(1)
    expect(JSON.parse(localStorage.getItem(RECENT_KEY))).toEqual(recent.value)
  })

  it('损坏的存储数据与无效 slug 不影响页面', () => {
    localStorage.setItem(FAVORITES_KEY, '{broken')
    localStorage.setItem(RECENT_KEY, JSON.stringify(['json', 'json', '/tools/evil', 42]))
    refreshToolPreferences()
    const { favorites, recent } = useToolPreferences()
    expect(favorites.value).toEqual([])
    expect(recent.value).toEqual(['json'])
    toggleFavorite('javascript:alert(1)')
    recordRecentTool('/tools/evil')
    expect(favorites.value).toEqual([])
    expect(recent.value).toEqual(['json'])
  })
})
