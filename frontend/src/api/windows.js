import request from '../utils/request'
export const getWindows = () => request.get('/windows')
export const getWindowsDetail = (id) => request.get(`/windows/${encodeURIComponent(id)}`)
