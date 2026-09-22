<script setup>
import AdminResourcePanel from '../../components/AdminResourcePanel.vue'
import * as resourceApi from '../../api/adminWindows'

const api = { ...resourceApi }

const fields = [
  {
    key: 'name',
    label: '名称',
    max: 100,
    required: true,
  },
  {
    key: 'version',
    label: '版本',
    max: 50,
    required: true,
  },
  {
    key: 'edition',
    label: '版本类型',
    max: 100,
    required: true,
  },
  {
    key: 'architecture',
    label: '架构',
    max: 20,
    required: true,
  },
  {
    key: 'releaseDate',
    label: '发布日期',
    type: 'date',
  },
  {
    key: 'description',
    label: '描述',
    max: 10000,
    type: 'textarea',
  },
  {
    key: 'officialDownloadUrl',
    label: '官方下载地址',
    max: 1000,
    type: 'url',
    hint: '仅允许 Microsoft 官方 HTTPS 地址（microsoft.com 或其子域名）。',
  },
  {
    key: 'sha256',
    label: 'SHA-256',
    max: 64,
  },
  {
    key: 'imageUrl',
    label: '图片地址',
    max: 1000,
    type: 'url',
    hint: '仅支持 HTTPS 图片地址；不上传图片。',
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
    key: 'version',
    label: '版本',
  },
  {
    key: 'edition',
    label: '版本类型',
  },
  {
    key: 'architecture',
    label: '架构',
  },
  {
    key: 'releaseDate',
    label: '发布日期',
  },
  {
    key: 'status',
    label: '状态',
  },
  {
    key: 'sortOrder',
    label: '排序',
  },
]
</script>

<template>
  <AdminResourcePanel title="Windows" :api="api" :fields="fields" :columns="columns" />
</template>
