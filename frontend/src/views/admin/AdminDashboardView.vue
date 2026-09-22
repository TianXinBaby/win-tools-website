<script setup>
import { adminSession } from '../../utils/adminSession'
</script>

<template>
  <section aria-labelledby="dashboard-title">
    <p class="eyebrow">Dashboard</p>
    <h1 id="dashboard-title">
      欢迎，{{ adminSession.admin?.nickname || adminSession.admin?.username }}
    </h1>
    <p>管理员安全登录与 Session 管理已开放。</p>
    <h2>内容管理</h2>
    <p>通过上方导航管理 Windows 资源、在线工具目录和文章，支持新增、编辑与单条删除。</p>
    <RouterLink to="/">查看网站首页</RouterLink>
  </section>
</template>
