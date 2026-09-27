export const nicknameCategories = [
  { value: 'game', label: '游戏昵称' },
  { value: 'developer', label: '程序员昵称' },
  { value: 'cute', label: '可爱昵称' },
  { value: 'fantasy', label: '中二昵称' },
]

const words = {
  game: {
    first: ['暗影', '疾风', '星际', '霜刃', '烈焰', '苍蓝'],
    second: ['游侠', '猎手', '战神', '剑客', '骑士', '领航员'],
  },
  developer: {
    first: ['代码', '算法', '像素', '终端', '递归', '开源'],
    second: ['骑士', '诗人', '旅人', '修理匠', '探险家', '魔法师'],
  },
  cute: {
    first: ['软糖', '奶泡', '小熊', '棉花', '桃子', '团子'],
    second: ['同学', '星星', '饼干', '喵喵', '云朵', '兔兔'],
  },
  fantasy: {
    first: ['漆黑', '永夜', '终焉', '虚空', '苍穹', '赤月'],
    second: ['之眼', '使徒', '魔王', '审判者', '契约者', '守望者'],
  },
}

function pick(list, random) {
  const value = random()
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error('随机数无效。')
  return list[Math.floor(value * list.length)]
}

export function generateNickname(category, random = Math.random) {
  const group = words[category]
  if (!group) throw new Error('请选择昵称分类。')
  return pick(group.first, random) + pick(group.second, random)
}
