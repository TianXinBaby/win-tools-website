export const BEST_REACTION_KEY = 'win-tools:reaction-best-ms'

export function randomWaitDuration(random = Math.random) {
  const value = random()
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error('随机数无效。')
  return 1500 + Math.floor(value * 2501)
}

export function calculateReactionTime(start, end) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    throw new Error('反应时间无效。')
  }
  return Math.round(end - start)
}

export function parseBestReaction(raw) {
  if (typeof raw !== 'string' || !/^(0|[1-9]\d*)$/.test(raw)) return null
  const value = Number(raw)
  return Number.isSafeInteger(value) ? value : null
}

export function bestReactionTime(previous, current) {
  return previous === null ? current : Math.min(previous, current)
}
