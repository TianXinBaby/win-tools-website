export function calculateVolume(samples) {
  if (!samples.length) return 0
  let sum = 0
  for (const sample of samples) {
    const normalized = (sample - 128) / 128
    sum += normalized * normalized
  }
  return Math.min(1, Math.sqrt(sum / samples.length))
}

export function nextVoiceStatus(current, action) {
  if (action === 'stop') return 'idle'
  if (current === 'idle' && action === 'start') return 'requesting'
  if (current === 'requesting' && action === 'granted') return 'running'
  if (current === 'requesting' && action === 'denied') return 'idle'
  return current
}
