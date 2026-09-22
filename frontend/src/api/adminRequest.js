import request from '../utils/request'
import { getAdminCsrf } from './adminAuth'

// Obtain a fresh token for each write. Fail visibly; never replay a mutation automatically.
export async function adminWrite(method, url, data) {
  const csrf = await getAdminCsrf()
  return request({ method, url, data, headers: { [csrf.headerName]: csrf.token } })
}
