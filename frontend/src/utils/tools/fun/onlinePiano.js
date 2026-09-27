export const PIANO_NOTES = [
  { key: 'a', label: 'C4', frequency: 261.63 },
  { key: 's', label: 'D4', frequency: 293.66 },
  { key: 'd', label: 'E4', frequency: 329.63 },
  { key: 'f', label: 'F4', frequency: 349.23 },
  { key: 'g', label: 'G4', frequency: 392 },
  { key: 'h', label: 'A4', frequency: 440 },
  { key: 'j', label: 'B4', frequency: 493.88 },
]

export function pianoNoteFromEvent(event) {
  if (event.repeat || event.ctrlKey || event.altKey || event.metaKey) return null
  if (
    event.target?.isContentEditable ||
    /^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName || '')
  ) {
    return null
  }
  return PIANO_NOTES.find((note) => note.key === event.key?.toLowerCase()) || null
}
