import request from '../utils/request'

export const getStats = () => request.get('/admin/dashboard/stats')
