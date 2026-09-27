export function calculateFps(frameCount, elapsedMs) {
  if (
    !Number.isFinite(frameCount) ||
    frameCount <= 0 ||
    !Number.isFinite(elapsedMs) ||
    elapsedMs <= 0
  ) {
    return 0
  }
  return Math.round((frameCount * 10000) / elapsedMs) / 10
}

export function calculateFrameTime(previousAt, currentAt) {
  const elapsed = currentAt - previousAt
  return Number.isFinite(elapsed) && elapsed > 0 ? Math.round(elapsed * 10) / 10 : 0
}
