import request from '../utils/request'
import { getAdminCsrf } from './adminAuth'

const base = '/tools/video-converter'
export const getVideoCapabilities = () => request.get(`${base}/capabilities`, { timeout: 15000 })
export const getVideoJob = (id) => request.get(`${base}/jobs/${encodeURIComponent(id)}`)
export async function createVideoJob(file, targetFormat, onUploadProgress) {
  const csrf = await getAdminCsrf()
  const data = new FormData()
  data.append('file', file)
  data.append('targetFormat', targetFormat)
  return request.post(`${base}/jobs`, data, {
    headers: { [csrf.headerName]: csrf.token },
    timeout: 300000,
    onUploadProgress,
  })
}
export async function cancelVideoJob(id) {
  const csrf = await getAdminCsrf()
  return request.delete(`${base}/jobs/${encodeURIComponent(id)}`, {
    headers: { [csrf.headerName]: csrf.token },
  })
}

export { videoMessage } from '../utils/videoMessages'
