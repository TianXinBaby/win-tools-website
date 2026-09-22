import request from '../utils/request'

export const getAdminCsrf = () => request.get('/admin/auth/csrf')
export const getCurrentAdmin = () => request.get('/admin/auth/me')
export const loginAdmin = (credentials, csrf) =>
  request.post('/admin/auth/login', credentials, {
    headers: { [csrf.headerName]: csrf.token },
  })
export const logoutAdmin = (csrf) =>
  request.post('/admin/auth/logout', null, {
    headers: { [csrf.headerName]: csrf.token },
  })
