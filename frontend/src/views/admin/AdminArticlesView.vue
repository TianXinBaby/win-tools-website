<script setup>
import AdminResourcePanel from '../../components/AdminResourcePanel.vue'
import * as resourceApi from '../../api/adminArticles'

const api = { ...resourceApi }

const fields = [
  {
    key: 'title',
    label: '标题',
    max: 255,
    required: true,
  },
  {
    key: 'slug',
    label: 'slug',
    max: 200,
    required: true,
    pattern: '[a-z0-9]+(-[a-z0-9]+)*',
    hint: '仅小写字母、数字和连字符。',
  },
  {
    key: 'summary',
    label: '摘要',
    max: 1000,
    type: 'textarea',
  },
  {
    key: 'content',
    label: '正文',
    max: 100000,
    type: 'textarea',
    hint: '普通文本，最多 100000 字符，不执行 HTML。',
  },
  {
    key: 'coverImage',
    label: '封面地址',
    max: 1000,
    type: 'url',
    hint: '仅支持 HTTPS 图片地址；不上传图片。',
  },
  {
    key: 'category',
    label: '分类',
    max: 100,
  },
  {
    key: 'status',
    label: '状态',
    type: 'status',
    default: 0,
    draft: true,
  },
]
const columns = [
  {
    key: 'id',
    label: 'ID',
  },
  {
    key: 'title',
    label: '标题',
  },
  {
    key: 'slug',
    label: 'slug',
  },
  {
    key: 'category',
    label: '分类',
  },
  {
    key: 'status',
    label: '状态',
  },
  {
    key: 'viewCount',
    label: '浏览量',
  },
  {
    key: 'createdAt',
    label: '创建时间',
  },
  {
    key: 'updatedAt',
    label: '更新时间',
  },
]
</script>

<template>
  <AdminResourcePanel title="文章" :api="api" :fields="fields" :columns="columns" article />
</template>
