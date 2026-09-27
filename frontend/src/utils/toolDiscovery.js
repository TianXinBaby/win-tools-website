const popularSlugs = ['json', 'image-compress', 'qrcode', 'nickname-generator']

const categoryLabels = {
  developer: '开发工具',
  media: '媒体工具',
  fun: '娱乐工具',
}

export function filterTools(tools, query = '', category = '') {
  const keyword = query.trim().toLocaleLowerCase()
  return tools.filter(
    (tool) =>
      (!category || tool.category === category) &&
      (!keyword ||
        [tool.name, tool.description].some((value) =>
          String(value || '')
            .toLocaleLowerCase()
            .includes(keyword),
        )),
  )
}

export function getToolCategories(tools) {
  const counts = new Map()
  for (const tool of tools) {
    if (tool.category) counts.set(tool.category, (counts.get(tool.category) || 0) + 1)
  }
  return [...counts].map(([value, count]) => ({
    value,
    label: categoryLabels[value] || value,
    count,
  }))
}

export function selectPopularTools(tools, limit = 4) {
  const ranking = new Map(popularSlugs.map((slug, index) => [slug, index]))
  return [...tools]
    .sort(
      (first, second) =>
        (ranking.get(first.slug) ?? popularSlugs.length) -
        (ranking.get(second.slug) ?? popularSlugs.length),
    )
    .slice(0, limit)
}
