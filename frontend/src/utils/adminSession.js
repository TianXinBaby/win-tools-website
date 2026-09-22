import { reactive, readonly } from 'vue'

const state = reactive({ admin: null, expired: false, notice: '' })
export const adminSession = readonly(state)

export function setCurrentAdmin(admin) {
  state.admin = admin
  state.expired = false
  state.notice = ''
}

export function clearAdminSession() {
  state.admin = null
  state.expired = false
  state.notice = ''
}

export function expireAdminSession() {
  state.admin = null
  state.expired = true
  state.notice = '登录状态已失效，请重新登录。'
}

export function adminCheckFailed() {
  state.admin = null
  state.notice = '暂时无法确认登录状态，请稍后重试。'
}
