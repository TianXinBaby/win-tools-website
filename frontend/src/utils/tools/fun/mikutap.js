export const MAX_TAP_PARTICLES = 160

export const TAP_COLORS = ['#245cd4', '#16a3b8', '#8b5cf6', '#ec6090', '#f59e42']

export function createTapParticles(x, y, color, random = Math.random) {
  return Array.from({ length: 20 }, () => {
    const angle = random() * Math.PI * 2
    const speed = 1.5 + random() * 3.5
    const life = 28 + Math.floor(random() * 24)
    return {
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: 2 + random() * 4,
      life,
      maxLife: life,
      color,
    }
  })
}

export function appendTapParticles(existing, created) {
  return [...existing, ...created].slice(-MAX_TAP_PARTICLES)
}
