<script setup>
import { useRoute } from 'vue-router'
const route = useRoute()
const navigation = [
  { path: '/', title: '首页' },
  { path: '/windows', title: 'Windows 下载' },
  { path: '/tools', title: '在线工具' },
  { path: '/favorites', title: '我的收藏' },
  { path: '/articles', title: '教程文章' },
]
const isCurrent = (path) =>
  route.path === path || (path !== '/' && route.path.startsWith(`${path}/`))
</script>

<template>
  <a class="skip-link" href="#main-content">跳转到主要内容</a>
  <header class="site-header">
    <div class="container header-inner">
      <RouterLink to="/" class="brand"
        ><span class="brand-mark" aria-hidden="true">⊞</span>Win Tools</RouterLink
      >
      <nav class="main-nav" aria-label="主导航">
        <RouterLink
          v-for="item in navigation"
          :key="item.path"
          :to="item.path"
          :class="{ 'is-active': isCurrent(item.path) }"
          :aria-current="isCurrent(item.path) ? 'page' : undefined"
          >{{ item.title }}</RouterLink
        >
      </nav>
    </div>
  </header>
  <main id="main-content" class="container main-content" tabindex="-1"><slot /></main>
</template>
