export function parseWheelOptions(input) {
  const options = input
    .split(/[,，\r\n]+/)
    .map((option) => option.trim())
    .filter(Boolean)
  if (options.length < 2 || options.length > 12) throw new Error('请输入 2 到 12 个选项。')
  if (options.some((option) => Array.from(option).length > 20)) {
    throw new Error('每个选项最多 20 个字符。')
  }
  return options
}

export function pickWheelIndex(options, random = Math.random) {
  if (!Array.isArray(options) || options.length < 2 || options.length > 12) {
    throw new Error('请输入 2 到 12 个选项。')
  }
  const value = random()
  if (!Number.isFinite(value) || value < 0 || value >= 1) throw new Error('随机数无效。')
  return Math.floor(value * options.length)
}

export function nextWheelRotation(current, index, count) {
  if (
    !Number.isFinite(current) ||
    !Number.isInteger(count) ||
    count < 2 ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= count
  ) {
    throw new Error('转盘参数无效。')
  }
  const target = (360 - ((index + 0.5) * 360) / count + 360) % 360
  const currentAngle = ((current % 360) + 360) % 360
  return current + 5 * 360 + ((target - currentAngle + 360) % 360)
}
