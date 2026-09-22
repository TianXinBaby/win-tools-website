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
    <h2>下一阶段</h2>
    <p>Windows 管理、在线工具管理、文章管理当前阶段未实现，将在阶段 9 开放。</p>
    <RouterLink to="/">查看网站首页</RouterLink>
  </section>
</template>
