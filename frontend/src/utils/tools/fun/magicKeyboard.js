const specialLabels = {
  ' ': '空格',
  Enter: '回车',
  Backspace: '退格',
  Escape: 'Esc',
  Tab: 'Tab',
  Shift: 'Shift',
  Control: 'Ctrl',
  Alt: 'Alt',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Delete: 'Delete',
}

export function magicKeyFromEvent(event) {
  if (!event || event.repeat || event.isComposing || event.metaKey) return null
  const target = event.target
  if (target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName)) {
    return null
  }
  if ((event.ctrlKey || event.altKey) && !['Control', 'Alt'].includes(event.key)) return null
  const key = event.key
  if (typeof key !== 'string' || key === 'Dead' || key === 'Unidentified') return null
  if (key.length !== 1 && !(key in specialLabels)) return null

  const label = specialLabels[key] ?? (/^[a-z]$/i.test(key) ? key.toUpperCase() : key)
  const color = /^[a-z]$/i.test(key) ? '#397cf0' : /^[0-9]$/.test(key) ? '#8b5cf6' : '#00a6a6'
  return { label, color }
}

export function createMagicParticles(width, height, color, random = Math.random) {
  return Array.from({ length: 20 }, () => {
    const angle = random() * Math.PI * 2
    const speed = 1.5 + random() * 3
    const life = 28 + Math.floor(random() * 22)
    return {
      x: width / 2,
      y: height / 2,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 2 + random() * 3,
      life,
      maxLife: life,
      color,
    }
  })
}
