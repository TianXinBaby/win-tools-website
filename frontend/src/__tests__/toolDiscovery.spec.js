import { describe, expect, it } from 'vitest'
import { filterTools, getToolCategories, selectPopularTools } from '../utils/toolDiscovery'

const tools = [
  { slug: 'qrcode', name: '二维码生成', description: '将链接编码为图片', category: 'media' },
  { slug: 'json', name: 'JSON 格式化', description: '美化数据', category: 'developer' },
  { slug: 'image-compress', name: '图片压缩', description: '本地压缩图片', category: 'media' },
  { slug: 'nickname-generator', name: '随机昵称', description: '娱乐小游戏', category: 'fun' },
  { slug: 'other', name: '其他', description: null, category: 'custom' },
]

describe('工具发现逻辑', () => {
  it('名称、描述均可实时按关键词过滤，忽略首尾空格及大小写', () => {
    expect(filterTools(tools, ' 二维码 ').map((tool) => tool.slug)).toEqual(['qrcode'])
    expect(filterTools(tools, '编码').map((tool) => tool.slug)).toEqual(['qrcode'])
    expect(filterTools(tools, ' json ').map((tool) => tool.slug)).toEqual(['json'])
    expect(filterTools(tools, '不存在')).toEqual([])
  })

  it('分类过滤可与关键词组合，空分类显示全部', () => {
    expect(filterTools(tools, '', 'media').map((tool) => tool.slug)).toEqual([
      'qrcode',
      'image-compress',
    ])
    expect(filterTools(tools, '图片', 'media').map((tool) => tool.slug)).toEqual([
      'qrcode',
      'image-compress',
    ])
    expect(filterTools(tools, 'JSON', 'media')).toEqual([])
    expect(filterTools(tools)).toEqual(tools)
  })

  it('分类来自现有目录数据并显示数量', () => {
    expect(getToolCategories(tools)).toEqual([
      { value: 'media', label: '媒体工具', count: 2 },
      { value: 'developer', label: '开发工具', count: 1 },
      { value: 'fun', label: '娱乐工具', count: 1 },
      { value: 'custom', label: 'custom', count: 1 },
    ])
  })

  it('热门工具按固定优先级选取当前目录数据，缺少优先项时补足且不改源数组', () => {
    const original = [...tools]
    expect(selectPopularTools(tools).map((tool) => tool.slug)).toEqual([
      'json',
      'image-compress',
      'qrcode',
      'nickname-generator',
    ])
    expect(selectPopularTools([tools[4], tools[0]], 3).map((tool) => tool.slug)).toEqual([
      'qrcode',
      'other',
    ])
    expect(tools).toEqual(original)
  })
})
