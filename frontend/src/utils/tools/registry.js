const availableTools = new Set(['json', 'uuid', 'timestamp', 'sha256', 'base64'])

export function isToolAvailable(slug) {
  return availableTools.has(slug)
}
