function unitFactor(unit) {
  if (unit === 'seconds') return 1000
  if (unit === 'milliseconds') return 1
  throw new Error('请选择秒或毫秒。')
}

export function timestampToDate(input, unit) {
  const text = String(input).trim()
  if (!/^[+-]?\d+$/.test(text)) throw new Error('请输入有效的整数时间戳。')
  const value = Number(text)
  const milliseconds = value * unitFactor(unit)
  if (!Number.isSafeInteger(value) || Math.abs(milliseconds) > 8640000000000000) {
    throw new Error('时间戳超出 JavaScript Date 有效范围。')
  }
  return new Date(milliseconds)
}

export function dateToTimestamp(date, unit) {
  const milliseconds = date instanceof Date ? date.getTime() : NaN
  if (!Number.isFinite(milliseconds)) throw new Error('请输入有效的日期时间。')
  return Math.floor(milliseconds / unitFactor(unit))
}

// datetime-local 不带时区，逐项校验以拒绝 Date 自动纠正的无效日期及夏令时跳过的时间。
export function parseLocalDateTime(input) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(input)
  if (!match) throw new Error('请输入有效的本地日期时间。')
  const [, year, month, day, hour, minute, second = '0', fraction = '0'] = match
  const parts = [
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    Number(fraction.padEnd(3, '0')),
  ]
  const date = new Date(0)
  date.setFullYear(parts[0], parts[1], parts[2])
  date.setHours(parts[3], parts[4], parts[5], parts[6])
  const actual = [
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds(),
  ]
  if (parts.some((part, index) => part !== actual[index])) {
    throw new Error('日期时间无效或在当前本地时区不存在。')
  }
  return date
}

export function formatLocalDateTime(date) {
  dateToTimestamp(date, 'milliseconds')
  const pad = (value, size = 2) => String(value).padStart(size, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`
}
