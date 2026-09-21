import { onScopeDispose, ref, watch } from 'vue'

// Shared request state, including navigation between parameters of the same route.
export function useResource(loader, source = () => undefined) {
  const data = ref(null)
  const loading = ref(true)
  const error = ref('')
  let latestRequest = 0
  async function reload() {
    const requestId = ++latestRequest
    data.value = null
    error.value = ''
    loading.value = true
    try {
      const result = await loader(source())
      if (requestId === latestRequest) data.value = result
    } catch (failure) {
      if (requestId === latestRequest) error.value = failure.message || '加载失败，请稍后重试。'
    } finally {
      if (requestId === latestRequest) loading.value = false
    }
  }
  watch(source, reload, { immediate: true })
  onScopeDispose(() => {
    latestRequest++
  })
  return { data, loading, error, reload }
}
