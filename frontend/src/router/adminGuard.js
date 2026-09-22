import { watch } from 'vue'
import { getCurrentAdmin } from '../api/adminAuth'
import {
  adminSession,
  adminCheckFailed,
  setCurrentAdmin,
  expireAdminSession,
  clearAdminSession,
} from '../utils/adminSession'

export function installAdminGuard(router) {
  const removeGuard = router.beforeEach(async (to) => {
    if (!to.meta.requiresAdmin && to.name !== 'admin-login') return true
    try {
      // Verify the server session on entry, including when memory already has an admin.
      setCurrentAdmin(await getCurrentAdmin())
      return to.name === 'admin-login' ? { name: 'admin-dashboard' } : true
    } catch (error) {
      if (error.status === 401) {
        if (to.meta.requiresAdmin || adminSession.admin || adminSession.expired)
          expireAdminSession()
        else clearAdminSession()
      } else adminCheckFailed()
      return to.meta.requiresAdmin ? { name: 'admin-login' } : true
    }
  })
  const stopWatching = watch(
    () => adminSession.expired,
    (expired) => {
      if (expired && router.currentRoute.value.meta.requiresAdmin) {
        void router.replace({ name: 'admin-login' })
      }
    },
  )
  return () => {
    removeGuard()
    stopWatching()
  }
}
