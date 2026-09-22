<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getAdminCsrf, logoutAdmin } from '../api/adminAuth'
import { adminSession, clearAdminSession } from '../utils/adminSession'

const router = useRouter()
const name = computed(() => adminSession.admin?.nickname || adminSession.admin?.username)
const loading = ref(false)
const errorMessage = ref('')

async function logout() {
  if (loading.value) return
  loading.value = true
  errorMessage.value = ''
  try {
    await logoutAdmin(await getAdminCsrf())
    clearAdminSession()
    await router.replace({ name: 'admin-login' })
  } catch (error) {
    errorMessage.value =
      error.status === 403 ? '安全校验未通过，请重新点击退出。' : '退出失败，请检查网络后重试。'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <header class="site-header">
    <div class="container admin-header">
      <RouterLink to="/admin" class="brand">Win Tools 管理后台</RouterLink>
      <nav aria-label="后台导航"><RouterLink to="/admin">Dashboard</RouterLink></nav>
      <span>当前管理员：{{ name }}</span>
      <el-button :loading="loading" :disabled="loading" @click="logout">退出</el-button>
    </div>
  </header>
  <main class="container main-content">
    <p v-if="errorMessage" class="logout-error" role="alert">{{ errorMessage }}</p>
    <RouterView />
  </main>
</template>

<style scoped>
.admin-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 20px;
  padding-block: 20px;
}
.admin-header .brand {
  margin-right: auto;
}
.admin-header span {
  overflow-wrap: anywhere;
}
.logout-error {
  color: #b42318;
}
</style>
