import { beforeEach, afterEach, it, expect } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import ToolCard from '../components/ToolCard.vue'
import { routes, installToolHistory } from '../router'
import { refreshToolPreferences, useToolPreferences } from '../utils/toolPreferences'
let wrapper
beforeEach(() => {
  localStorage.clear()
  refreshToolPreferences()
})
afterEach(() => wrapper?.unmount())
it('整卡原生链接包含图标、名称和简介，独立收藏不会导航，路由记录最近使用', async () => {
  const router = createRouter({ history: createMemoryHistory(), routes })
  installToolHistory(router)
  await router.push('/tools')
  wrapper = mount(ToolCard, {
    props: {
      item: {
        slug: 'video-converter',
        name: '视频格式转换器',
        description: '本站服务器转换',
        path: '/tools/video-converter',
      },
    },
    global: { plugins: [router] },
  })
  const link = wrapper.get('a.tool-card-link')
  expect(link.attributes('href')).toBe('/tools/video-converter')
  expect(link.attributes('tabindex')).toBeUndefined() // Native anchor participates in Tab and Enter navigation.
  expect(link.get('h3').text()).toBe('视频格式转换器')
  expect(link.get('p').text()).toBe('本站服务器转换')
  expect(link.find('button').exists()).toBe(false)
  await wrapper.get('button').trigger('click')
  expect(router.currentRoute.value.path).toBe('/tools')
  expect(useToolPreferences().favorites.value).toContain('video-converter')
  const navigation = new Promise((resolve) => {
    const stop = router.afterEach(() => {
      stop()
      resolve()
    })
  })
  await link.trigger('click')
  await navigation
  await flushPromises()
  expect(router.currentRoute.value.path).toBe('/tools/video-converter')
  expect(useToolPreferences().recent.value[0]).toBe('video-converter')
})
