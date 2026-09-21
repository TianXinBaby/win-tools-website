<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { getWindowsDetail } from '../api/windows'
import { useResource } from '../composables/useResource'
import { officialDownloadUrl, safeImageUrl } from '../utils/urls'
import ResourceState from '../components/ResourceState.vue'
const route = useRoute()
const { data, loading, error, reload } = useResource(getWindowsDetail, () => route.params.id)
const downloadUrl = computed(() => officialDownloadUrl(data.value?.officialDownloadUrl))
</script>
<template>
  <RouterLink class="back-link" to="/windows">← 返回 Windows 列表</RouterLink>
  <ResourceState
    :loading="loading"
    :error="error"
    :empty="!data"
    empty-text="暂无该 Windows 资源。"
    @retry="reload"
    ><article v-if="data" class="card detail-card">
      <p class="eyebrow">WINDOWS RESOURCE</p>
      <h1>{{ data.name }}</h1>
      <p class="detail-description">{{ data.description || '暂无简介。' }}</p>
      <img
        v-if="safeImageUrl(data.imageUrl)"
        class="detail-cover"
        :src="safeImageUrl(data.imageUrl)"
        :alt="data.name"
        referrerpolicy="no-referrer"
      />
      <dl class="detail-facts">
        <div>
          <dt>版本</dt>
          <dd>{{ data.version }}</dd>
        </div>
        <div>
          <dt>版本名称</dt>
          <dd>{{ data.edition || '未提供' }}</dd>
        </div>
        <div>
          <dt>架构</dt>
          <dd>{{ data.architecture || '未提供' }}</dd>
        </div>
        <div>
          <dt>发布日期</dt>
          <dd>{{ data.releaseDate || '未提供' }}</dd>
        </div>
        <div class="full-width">
          <dt>SHA-256</dt>
          <dd class="hash-value">{{ data.sha256 || '暂未提供校验值，请以官方信息为准。' }}</dd>
        </div>
      </dl>
      <div class="download-panel">
        <h2>Microsoft 官方下载</h2>
        <p>前往官方页面查看可用版本与下载说明，本站不存储 ISO 镜像。</p>
        <template v-if="downloadUrl"
          ><a
            class="button-link primary"
            :href="downloadUrl"
            target="_blank"
            rel="noopener noreferrer"
            >前往官方下载 ↗</a
          >
          <p class="url-text">{{ downloadUrl }}</p></template
        ><ElAlert
          v-else
          title="暂未提供有效的 Microsoft 官方下载链接。"
          type="info"
          :closable="false"
        />
      </div></article
  ></ResourceState>
</template>
