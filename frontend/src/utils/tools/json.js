export function formatJson(input) {
  return JSON.stringify(JSON.parse(input), null, 2)
}

export function compactJson(input) {
  return JSON.stringify(JSON.parse(input))
}
