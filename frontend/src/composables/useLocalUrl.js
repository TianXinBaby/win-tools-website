import { onBeforeUnmount, ref } from 'vue'
import { createLocalUrl } from '../utils/tools/media'

export function useLocalUrl() {
  const url = ref('')
  function clear() {
    if (url.value) URL.revokeObjectURL(url.value)
    url.value = ''
  }
  function set(blob) {
    clear()
    url.value = createLocalUrl(blob)
  }
  onBeforeUnmount(clear)
  return { url, set, clear }
}
