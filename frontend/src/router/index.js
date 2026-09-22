import { createRouter, createWebHistory } from 'vue-router'
import { installAdminGuard } from './adminGuard'

export const routes = [
  {
    path: '/admin/login',
    name: 'admin-login',
    component: () => import('../views/admin/AdminLoginView.vue'),
    meta: { title: '管理员登录', adminArea: true },
  },
  {
    path: '/admin',
    component: () => import('../layouts/AdminLayout.vue'),
    meta: { requiresAdmin: true, adminArea: true },
    children: [
      {
        path: 'windows',
        name: 'admin-windows',
        component: () => import('../views/admin/AdminWindowsView.vue'),
        meta: { title: 'Windows 管理' },
      },
      {
        path: 'tools',
        name: 'admin-tools',
        component: () => import('../views/admin/AdminToolsView.vue'),
        meta: { title: '工具管理' },
      },
      {
        path: 'articles',
        name: 'admin-articles',
        component: () => import('../views/admin/AdminArticlesView.vue'),
        meta: { title: '文章管理' },
      },
      {
        path: '',
        name: 'admin-dashboard',
        component: () => import('../views/admin/AdminDashboardView.vue'),
        meta: { title: 'Dashboard' },
      },
    ],
  },
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
    path: '/tools/json',
    name: 'tool-json',
    component: () => import('../views/tools/JsonToolView.vue'),
    meta: { title: 'JSON 格式化' },
  },
  {
    path: '/tools/uuid',
    name: 'tool-uuid',
    component: () => import('../views/tools/UuidToolView.vue'),
    meta: { title: 'UUID v4 生成' },
  },
  {
    path: '/tools/timestamp',
    name: 'tool-timestamp',
    component: () => import('../views/tools/TimestampToolView.vue'),
    meta: { title: '时间戳转换' },
  },
  {
    path: '/tools/sha256',
    name: 'tool-sha256',
    component: () => import('../views/tools/Sha256ToolView.vue'),
    meta: { title: 'SHA-256' },
  },
  {
    path: '/tools/base64',
    name: 'tool-base64',
    component: () => import('../views/tools/Base64ToolView.vue'),
    meta: { title: 'Base64 编解码' },
  },
  {
    path: '/tools/qrcode',
    name: 'tool-qrcode',
    component: () => import('../views/tools/QrCodeToolView.vue'),
    meta: { title: '二维码生成' },
  },
  {
    path: '/tools/image-compress',
    name: 'tool-image-compress',
    component: () => import('../views/tools/ImageCompressToolView.vue'),
    meta: { title: '图片压缩' },
  },
  {
    path: '/tools/image-resize',
    name: 'tool-image-resize',
    component: () => import('../views/tools/ImageResizeToolView.vue'),
    meta: { title: '图片尺寸调整' },
  },
  {
    path: '/tools/image-convert',
    name: 'tool-image-convert',
    component: () => import('../views/tools/ImageConvertToolView.vue'),
    meta: { title: '图片格式转换' },
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
installAdminGuard(router)
export default router
