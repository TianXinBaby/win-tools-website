import request from '../utils/request'
import { adminWrite } from './adminRequest'

const base = '/admin/tools'
export const list = () => request.get(base)
export const detail = (id) => request.get(`${base}/${id}`)
export const create = (data) => adminWrite('post', base, data)
export const update = (id, data) => adminWrite('put', `${base}/${id}`, data)
export const updateStatus = (id, status) => adminWrite('put', `${base}/${id}/status`, { status })
export const updateSort = (id, sortOrder) => adminWrite('put', `${base}/${id}/sort`, { sortOrder })
export const remove = (id) => adminWrite('delete', `${base}/${id}`)
