<script setup>
import { onMounted, ref } from 'vue'
import { ElButton } from 'element-plus'
import { getStats } from '../../api/adminDashboard'
import { adminSession } from '../../utils/adminSession'

const stats = ref(null)
const loading = ref(false)
const errorMessage = ref('')

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    stats.value = await getStats()
  } catch (error) {
    errorMessage.value = error.message
  } finally {
    loading.value = false
  }
}
onMounted(load)
</script>

<template>
  <section aria-labelledby="dashboard-title">
    <p class="eyebrow">Dashboard</p>
    <h1 id="dashboard-title">
      欢迎，{{ adminSession.admin?.nickname || adminSession.admin?.username }}
    </h1>
    <p>管理员安全登录与 Session 管理已开放。</p>
    <div class="dashboard-heading">
      <h2>内容管理</h2>
      <ElButton :disabled="loading" @click="load">刷新统计</ElButton>
    </div>
    <p>通过上方导航管理 Windows 资源、在线工具目录和文章，支持新增、编辑与单条删除。</p>
    <p v-if="loading" role="status">正在加载统计…</p>
    <p v-if="errorMessage" role="alert">{{ errorMessage }}</p>
    <div v-if="stats" class="stats-grid" aria-label="后台数据统计">
      <dl>
        <dt>工具总数</dt>
        <dd>{{ stats.toolTotal }}</dd>
      </dl>
      <dl>
        <dt>启用工具</dt>
        <dd>{{ stats.toolEnabled }}</dd>
      </dl>
      <dl>
        <dt>禁用工具</dt>
        <dd>{{ stats.toolDisabled }}</dd>
      </dl>
      <dl>
        <dt>文章总数</dt>
        <dd>{{ stats.articleTotal }}</dd>
      </dl>
      <dl>
        <dt>已发布文章</dt>
        <dd>{{ stats.articlePublished }}</dd>
      </dl>
      <dl>
        <dt>工具分类</dt>
        <dd>{{ stats.categoryCount }}</dd>
      </dl>
    </div>
    <RouterLink to="/">查看网站首页</RouterLink>
  </section>
</template>

<style scoped>
.dashboard-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
  margin-block: 24px;
}
.stats-grid dl {
  margin: 0;
  padding: 18px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
}
.stats-grid dt {
  font-size: 0.9rem;
}
.stats-grid dd {
  margin-top: 8px;
  font-size: 1.7rem;
  font-weight: 700;
}
[role='alert'] {
  color: #b42318;
}
</style>
