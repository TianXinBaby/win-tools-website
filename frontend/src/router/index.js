import { createRouter, createWebHistory } from 'vue-router'

export const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('../views/HomeView.vue'),
    meta: { title: '首页' },
  },
  {
    path: '/windows',
    name: 'windows',
    component: () => import('../views/WindowsView.vue'),
    meta: { title: 'Windows 下载' },
  },
  {
    path: '/windows/:id',
    name: 'windows-detail',
    component: () => import('../views/WindowsDetailView.vue'),
    meta: { title: 'Windows 详情' },
  },
  {
    path: '/tools',
    name: 'tools',
    component: () => import('../views/ToolsView.vue'),
    meta: { title: '在线工具' },
  },
  {
    path: '/tools/:slug',
    name: 'tool-detail',
    component: () => import('../views/ToolDetailView.vue'),
    meta: { title: '工具介绍' },
  },
  {
    path: '/articles',
    name: 'articles',
    component: () => import('../views/ArticlesView.vue'),
    meta: { title: '教程文章' },
  },
  {
    path: '/articles/:id',
    name: 'article-detail',
    component: () => import('../views/ArticleDetailView.vue'),
    meta: { title: '文章详情' },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('../views/NotFoundView.vue'),
    meta: { title: '页面不存在' },
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.afterEach((to) => {
  document.title = `${to.meta.title} · Win Tools`
})
export default router
