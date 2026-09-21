import request from '../utils/request'
export const getTools = () => request.get('/tools')
export const getToolDetail = (slug) => request.get(`/tools/${encodeURIComponent(slug)}`)
