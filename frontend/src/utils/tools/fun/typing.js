export const BEST_TYPING_KEY = 'win-tools-best-typing-v1'

export function calculateTypingMetrics(target, input, elapsedMs) {
  if (typeof target !== 'string' || !target || typeof input !== 'string') {
    throw new Error('测试文本无效')
  }
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) throw new Error('测试时间无效')

  let correctChars = 0
  for (let index = 0; index < input.length; index++) {
    if (input[index] === target[index]) correctChars++
  }
  return {
    wpm: elapsedMs > 0 ? Math.round((correctChars / 5 / elapsedMs) * 60000) : 0,
    accuracy: input.length ? Math.round((correctChars / input.length) * 1000) / 10 : 0,
    seconds: Math.round(elapsedMs / 100) / 10,
    correctChars,
  }
}

export function parseBestTypingScore(value) {
  if (!value) return null
  try {
    const score = JSON.parse(value)
    if (
      Number.isInteger(score.wpm) &&
      score.wpm >= 0 &&
      Number.isFinite(score.accuracy) &&
      score.accuracy >= 0 &&
      score.accuracy <= 100
    ) {
      return { wpm: score.wpm, accuracy: score.accuracy }
    }
  } catch {
    // Invalid browser data is ignored.
  }
  return null
}

export function betterTypingScore(current, result) {
  if (!current || result.wpm > current.wpm) {
    return { wpm: result.wpm, accuracy: result.accuracy }
  }
  if (result.wpm === current.wpm && result.accuracy > current.accuracy) {
    return { wpm: result.wpm, accuracy: result.accuracy }
  }
  return current
}
