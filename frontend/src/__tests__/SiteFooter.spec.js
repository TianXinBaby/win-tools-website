import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { ElButton } from 'element-plus'
import SiteFooter from '../components/SiteFooter.vue'
import App from '../App.vue'
import { routes } from '../router'

let wrapper
afterEach(() => wrapper?.unmount())

function expectRegistrations() {
  expect(wrapper.findAll('footer')).toHaveLength(1)
  const links = wrapper.findAll('footer a')
  expect(links).toHaveLength(2)
  expect(links[0].text()).toBe('赣公网安备36082802000204号')
  expect(links[0].attributes('href')).toBe(
    'https://beian.mps.gov.cn/#/query/webSearch?code=36082802000204',
  )
  expect(links[1].text()).toBe('赣ICP备2026025057号-1')
  expect(links[1].attributes('href')).toBe('https://beian.miit.gov.cn/')
  for (const link of links) {
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('rel')).toBe('noopener noreferrer')
    expect(link.element.tabIndex).toBe(0)
  }
}

describe('统一备案页脚', () => {
  it('提供准确的备案编号、查询链接、安全属性和可聚焦链接', () => {
    wrapper = mount(SiteFooter)
    expectRegistrations()
    expect(wrapper.text()).toContain('© 2026 Win Tools')
  })

  it('使用真实本地 PNG，装饰性图标在同一公安链接中文字之前', () => {
    wrapper = mount(SiteFooter)
    const link = wrapper.get('footer a')
    const icon = link.get('img')
    expect(icon.attributes('src')).toBe('/images/gongan-beian.png')
    expect(icon.attributes('alt')).toBe('')
    expect(link.element.firstElementChild).toBe(icon.element)
    expect(icon.element.nextElementSibling.textContent).toBe('赣公网安备36082802000204号')
    const bytes = readFileSync('public/images/gongan-beian.png')
    expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
    expect(bytes.readUInt32BE(16)).toBe(36)
    expect(bytes.readUInt32BE(20)).toBe(40)
    expect(bytes.subarray(-8, -4).toString()).toBe('IEND')
  })

  // 保留真实路由结构、App 和两种 Layout，仅替换页面内容以隔离业务/API。
  // 真实页面功能另由 App、AdminViews、工具页面测试及浏览器检查覆盖。
  const page = { template: '<h1>路由内容</h1>' }
  const layoutRoutes = routes.map((route) =>
    route.children
      ? { ...route, children: route.children.map((child) => ({ ...child, component: page })) }
      : { ...route, component: page },
  )
  const pages = routes.flatMap((route) =>
    route.children
      ? route.children.map((child) => [child.name, `/admin${child.path ? `/${child.path}` : ''}`])
      : [
          [
            route.name,
            route.path
              .replace(':id', '1')
              .replace(':slug', 'future-tool')
              .replace(':pathMatch(.*)*', 'missing/nested'),
          ],
        ],
  )

  it.each(pages)('%s 布局包含且仅包含一个统一页脚', async (name, path) => {
    const router = createRouter({ history: createMemoryHistory(), routes: layoutRoutes })
    await router.push(path)
    await router.isReady()
    wrapper = mount(App, { global: { plugins: [router, ElButton] } })
    await flushPromises()
    expect(router.currentRoute.value.name).toBe(name)
    expect(wrapper.get('h1').text()).toBe('路由内容')
    expect(wrapper.find('.main-nav').exists()).toBe(!path.startsWith('/admin'))
    expectRegistrations()
  })

  it('在普通页面、后台及登录页之间切换不重复挂载页脚', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes: layoutRoutes })
    await router.push('/')
    await router.isReady()
    wrapper = mount(App, { global: { plugins: [router, ElButton] } })
    const footer = wrapper.get('footer').element
    for (const path of ['/admin', '/admin/windows', '/admin/login', '/favorites', '/missing']) {
      await router.push(path)
      await flushPromises()
      expectRegistrations()
      expect(wrapper.get('footer').element).toBe(footer)
    }
  })
})
