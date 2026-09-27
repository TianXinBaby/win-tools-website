<script setup>
import AdminResourcePanel from '../../components/AdminResourcePanel.vue'
import * as resourceApi from '../../api/adminTools'

const api = { ...resourceApi }

const fields = [
  {
    key: 'name',
    label: '名称',
    max: 100,
    required: true,
  },
  {
    key: 'slug',
    label: 'slug',
    max: 100,
    required: true,
    pattern: '[a-z0-9]+(-[a-z0-9]+)*',
    hint: '仅小写字母、数字和连字符。',
  },
  {
    key: 'icon',
    label: '图标',
    max: 255,
  },
  {
    key: 'description',
    label: '描述',
    max: 10000,
    type: 'textarea',
  },
  {
    key: 'category',
    label: '分类',
    max: 100,
  },
  {
    key: 'path',
    label: '工具路径',
    max: 255,
    required: true,
    pattern: '/tools/[a-z0-9]+(-[a-z0-9]+)*(/[a-z0-9]+(-[a-z0-9]+)*)*',
    hint: '必须以 /tools/ 开头，填写已实现的站内工具路由。',
  },
  {
    key: 'status',
    label: '状态',
    type: 'status',
    default: 1,
    draft: false,
  },
  {
    key: 'sortOrder',
    label: '排序',
    type: 'number',
    default: 0,
  },
]
const columns = [
  {
    key: 'id',
    label: 'ID',
  },
  {
    key: 'name',
    label: '名称',
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
    key: 'path',
    label: '工具路径',
  },
  {
    key: 'status',
    label: '状态',
  },
  {
    key: 'sortOrder',
    label: '排序',
  },
  {
    key: 'createdAt',
    label: '创建时间',
  },
]
</script>

<template>
  <AdminResourcePanel title="工具" :api="api" :fields="fields" :columns="columns" tool-controls />
</template>
