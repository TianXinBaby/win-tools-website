<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElButton, ElDialog, ElMessage, ElMessageBox } from 'element-plus'
import 'element-plus/theme-chalk/el-dialog.css'
import 'element-plus/theme-chalk/el-overlay.css'
import 'element-plus/theme-chalk/el-message.css'
import 'element-plus/theme-chalk/el-message-box.css'
import AdminContentForm from './AdminContentForm.vue'

const props = defineProps({
  title: { type: String, required: true },
  api: { type: Object, required: true },
  fields: { type: Array, required: true },
  columns: { type: Array, required: true },
  article: Boolean,
  toolControls: Boolean,
})
const rows = ref([])
const search = ref('')
const categoryFilter = ref('')
const statusFilter = ref('all')
const sortDrafts = ref({})
const loading = ref(false)
const busy = ref(false)
const submitting = ref(false)
const errorMessage = ref('')
const formError = ref('')
const dialog = ref(false)
const current = ref({})
const formKey = ref(0)
const categories = computed(() => {
  const counts = new Map()
  for (const row of rows.value) {
    if (row.category && !row.category.trim()) continue
    if (row.category) counts.set(row.category, (counts.get(row.category) || 0) + 1)
  }
  return [...counts].map(([name, count]) => ({ name, count }))
})
const visibleRows = computed(() => {
  const keyword = search.value.trim().toLocaleLowerCase()
  return rows.value.filter((row) => {
    if (statusFilter.value !== 'all' && row.status !== Number(statusFilter.value)) return false
    if (props.toolControls) {
      return (
        (!categoryFilter.value || row.category === categoryFilter.value) &&
        (!keyword ||
          [row.name, row.slug].some((value) => value?.toLocaleLowerCase().includes(keyword)))
      )
    }
    return true
  })
})

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    rows.value = await props.api.list()
    sortDrafts.value = Object.fromEntries(rows.value.map((row) => [row.id, row.sortOrder]))
  } catch (error) {
    errorMessage.value = error.message
  } finally {
    loading.value = false
  }
}
async function edit(row) {
  if (busy.value || loading.value) return
  busy.value = true
  errorMessage.value = ''
  try {
    current.value = row ? await props.api.detail(row.id) : {}
    formError.value = ''
    formKey.value++
    dialog.value = true
  } catch (error) {
    errorMessage.value = error.message
  } finally {
    busy.value = false
  }
}
async function save(payload) {
  if (submitting.value) return
  submitting.value = true
  formError.value = ''
  try {
    if (current.value.id) await props.api.update(current.value.id, payload)
    else await props.api.create(payload)
    dialog.value = false
    ElMessage.success('保存成功')
    await load()
  } catch (error) {
    formError.value = error.status === 400 ? '请检查必填项、字段长度及格式。' : error.message
  } finally {
    submitting.value = false
  }
}
async function remove(row) {
  if (busy.value || loading.value) return
  busy.value = true
  errorMessage.value = ''
  try {
    await ElMessageBox.confirm(
      `确定删除“${row.name || row.title}”吗？删除后无法恢复。`,
      '删除确认',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
    await props.api.remove(row.id)
    ElMessage.success('删除成功')
    await load()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close')
      errorMessage.value = error.message || '删除失败，请重试。'
  } finally {
    busy.value = false
  }
}
async function toggleStatus(row) {
  if (busy.value || loading.value) return
  busy.value = true
  errorMessage.value = ''
  const nextStatus = row.status === 1 ? 0 : 1
  try {
    await ElMessageBox.confirm(
      `确定${nextStatus === 1 ? '启用' : '关闭'}“${row.name}”吗？`,
      '状态确认',
      { confirmButtonText: '确认', cancelButtonText: '取消', type: 'warning' },
    )
    await props.api.updateStatus(row.id, nextStatus)
    ElMessage.success('状态已更新')
    await load()
  } catch (error) {
    if (error !== 'cancel' && error !== 'close')
      errorMessage.value = error.message || '状态更新失败，请重试。'
  } finally {
    busy.value = false
  }
}
async function saveSort(row) {
  if (busy.value || loading.value) return
  const raw = String(sortDrafts.value[row.id])
  const sortOrder = Number(raw)
  if (!/^\d+$/.test(raw) || !Number.isInteger(sortOrder) || sortOrder > 1000000) {
    errorMessage.value = '排序值必须是 0 到 1000000 之间的整数。'
    return
  }
  if (sortOrder === row.sortOrder) return
  busy.value = true
  errorMessage.value = ''
  try {
    await props.api.updateSort(row.id, sortOrder)
    ElMessage.success('排序已更新')
    await load()
  } catch (error) {
    errorMessage.value = error.message || '排序更新失败，请重试。'
  } finally {
    busy.value = false
  }
}
function beforeClose(done) {
  if (!submitting.value) done()
}
onMounted(load)
</script>

<template>
  <section class="admin-resource" :aria-busy="loading || busy">
    <div class="admin-toolbar">
      <h1>{{ title }}管理</h1>
      <ElButton type="primary" :disabled="loading || busy" data-action="create" @click="edit()"
        >新增{{ title }}</ElButton
      >
      <ElButton :disabled="loading || busy" @click="load">刷新</ElButton>
    </div>
    <p v-if="errorMessage" role="alert">{{ errorMessage }}</p>
    <p v-if="loading" role="status">正在加载…</p>
    <div v-if="toolControls || article" class="admin-filters">
      <label v-if="toolControls" for="admin-tool-search">
        搜索工具
        <input id="admin-tool-search" v-model="search" type="search" placeholder="名称或 slug" />
      </label>
      <label v-if="toolControls" for="admin-category-filter">
        分类
        <select id="admin-category-filter" v-model="categoryFilter">
          <option value="">全部分类</option>
          <option v-for="category in categories" :key="category.name" :value="category.name">
            {{ category.name }}
          </option>
        </select>
      </label>
      <label for="admin-status-filter">
        状态
        <select id="admin-status-filter" v-model="statusFilter">
          <option value="all">全部状态</option>
          <option value="1">{{ article ? '已发布' : '启用' }}</option>
          <option value="0">{{ article ? '草稿' : '禁用' }}</option>
        </select>
      </label>
    </div>
    <section v-if="toolControls" class="category-summary" aria-label="工具分类统计">
      <h2>分类统计</h2>
      <ul v-if="categories.length">
        <li v-for="category in categories" :key="category.name">
          <span>{{ category.name }}</span
          ><strong>{{ category.count }} 个工具</strong>
        </li>
      </ul>
      <p v-else>暂无分类</p>
    </section>
    <div class="table-scroll" tabindex="0" :aria-label="title + '管理列表'">
      <table>
        <thead>
          <tr>
            <th v-for="column in columns" :key="column.key" scope="col">{{ column.label }}</th>
            <th scope="col">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in visibleRows" :key="row.id">
            <template v-for="column in columns" :key="column.key">
              <td v-if="toolControls && column.key === 'sortOrder'">
                <div class="sort-control">
                  <input
                    :value="sortDrafts[row.id]"
                    :aria-label="`排序值：${row.name}`"
                    type="number"
                    min="0"
                    max="1000000"
                    step="1"
                    @input="sortDrafts[row.id] = $event.target.value"
                  />
                  <ElButton :disabled="loading || busy" data-action="sort" @click="saveSort(row)"
                    >保存排序</ElButton
                  >
                </div>
              </td>
              <td v-else>
                {{
                  column.key === 'status'
                    ? row.status === 1
                      ? article
                        ? '已发布'
                        : '启用'
                      : article
                        ? '草稿'
                        : '禁用'
                    : column.key === 'publishedAt'
                      ? row.status === 1
                        ? '未记录'
                        : '未发布'
                      : (row[column.key] ?? '—')
                }}
              </td>
            </template>
            <td class="row-actions">
              <ElButton
                v-if="toolControls"
                :disabled="loading || busy"
                data-action="status"
                @click="toggleStatus(row)"
                >{{ row.status === 1 ? '关闭' : '启用' }}</ElButton
              >
              <ElButton :disabled="loading || busy" data-action="edit" @click="edit(row)"
                >编辑</ElButton
              >
              <ElButton
                type="danger"
                :disabled="loading || busy"
                data-action="delete"
                @click="remove(row)"
                >删除</ElButton
              >
            </td>
          </tr>
          <tr v-if="!loading && !visibleRows.length">
            <td :colspan="columns.length + 1">
              {{ rows.length ? '没有符合条件的数据' : '暂无数据' }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <ElDialog
      v-model="dialog"
      :title="(current.id ? '编辑' : '新增') + title"
      width="min(720px, 94vw)"
      :close-on-click-modal="false"
      :close-on-press-escape="!submitting"
      :show-close="!submitting"
      :before-close="beforeClose"
      destroy-on-close
    >
      <p v-if="formError" role="alert">{{ formError }}</p>
      <AdminContentForm
        :key="formKey"
        :fields="fields"
        :initial="current"
        :submitting="submitting"
        @save="save"
        @cancel="dialog = false"
      />
    </ElDialog>
  </section>
</template>

<style scoped>
.admin-resource {
  min-width: 0;
}
.admin-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}
.admin-toolbar h1 {
  margin-right: auto;
}
.admin-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 20px;
}
.admin-filters label {
  display: grid;
  gap: 6px;
  min-width: 160px;
}
.admin-filters input,
.admin-filters select,
.sort-control input {
  border: 1px solid #b9c6d8;
  border-radius: 6px;
  padding: 8px;
  font: inherit;
}
.category-summary {
  margin-bottom: 20px;
}
.category-summary ul {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.category-summary li {
  display: flex;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
}
.sort-control {
  display: flex;
  align-items: center;
  gap: 8px;
}
.sort-control input {
  width: 100px;
}
.table-scroll {
  overflow-x: auto;
  max-width: 100%;
  border: 1px solid #d0d5dd;
  border-radius: 8px;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
th,
td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #e4e7ec;
  min-width: 65px;
  max-width: 280px;
  overflow-wrap: anywhere;
}
th {
  background: #f2f4f7;
  white-space: nowrap;
}
.row-actions {
  min-width: 220px;
  white-space: nowrap;
}
[role='alert'] {
  color: #b42318;
  overflow-wrap: anywhere;
}
</style>
