<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { getAdminCsrf, loginAdmin } from '../../api/adminAuth'
import { adminSession, setCurrentAdmin } from '../../utils/adminSession'

const router = useRouter()
const username = ref('')
const password = ref('')
const loading = ref(false)
const errorMessage = ref('')

async function login() {
  if (loading.value) return
  errorMessage.value = ''
  if (!username.value.trim() || !password.value.trim()) {
    errorMessage.value = '请输入用户名和密码。'
    return
  }
  loading.value = true
  try {
    const csrf = await getAdminCsrf()
    const admin = await loginAdmin(
      { username: username.value.trim(), password: password.value },
      csrf,
    )
    setCurrentAdmin(admin)
    password.value = ''
    await router.replace({ name: 'admin-dashboard' })
  } catch (error) {
    errorMessage.value =
      error.status === 401
        ? '用户名或密码错误'
        : error.status === 403
          ? '安全校验未通过，请重新点击登录。'
          : '登录失败，请检查网络后重试。'
  } finally {
    password.value = ''
    loading.value = false
  }
}
</script>

<template>
  <main class="admin-login">
    <RouterLink to="/" class="brand">⊞ Win Tools</RouterLink>
    <section class="login-card" aria-labelledby="login-title">
      <p class="eyebrow">管理后台</p>
      <h1 id="login-title">管理员登录</h1>
      <p>登录后进入 Win Tools 管理后台。</p>
      <p v-if="adminSession.notice" role="status">{{ adminSession.notice }}</p>
      <form :aria-busy="loading" @submit.prevent="login">
        <label for="admin-username">用户名</label>
        <input
          id="admin-username"
          v-model="username"
          name="username"
          autocomplete="username"
          maxlength="100"
          required
          :disabled="loading"
        />
        <label for="admin-password">密码</label>
        <input
          id="admin-password"
          v-model="password"
          name="password"
          type="password"
          autocomplete="current-password"
          maxlength="72"
          required
          :disabled="loading"
        />
        <p v-if="errorMessage" class="login-error" role="alert">{{ errorMessage }}</p>
        <el-button type="primary" native-type="submit" :loading="loading" :disabled="loading">
          {{ loading ? '正在登录…' : '登录' }}
        </el-button>
      </form>
    </section>
    <RouterLink to="/">返回网站首页</RouterLink>
  </main>
</template>

<style scoped>
.admin-login {
  width: min(440px, calc(100% - 32px));
  margin: 9vh auto 40px;
}
.login-card {
  margin: 28px 0 24px;
  padding: 32px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: white;
}
h1 {
  font-size: 1.8rem;
}
form {
  display: grid;
  gap: 12px;
}
label {
  font-weight: 600;
}
input {
  min-width: 0;
  width: 100%;
  padding: 12px;
  border: 1px solid #9caabc;
  border-radius: 8px;
  font: inherit;
  margin-bottom: 8px;
}
input:focus-visible {
  outline: 3px solid #729ced;
  outline-offset: 2px;
}
.login-error {
  color: #b42318;
  margin: 0;
}
@media (max-width: 400px) {
  .login-card {
    padding: 24px;
  }
}
</style>
