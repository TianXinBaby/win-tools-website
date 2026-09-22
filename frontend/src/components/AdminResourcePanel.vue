<script setup>
import { onMounted, ref } from 'vue'
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
})
const rows = ref([])
const loading = ref(false)
const busy = ref(false)
const submitting = ref(false)
const errorMessage = ref('')
const formError = ref('')
const dialog = ref(false)
const current = ref({})
const formKey = ref(0)

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    rows.value = await props.api.list()
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
    <div class="table-scroll" tabindex="0" :aria-label="title + '管理列表'">
      <table>
        <thead>
          <tr>
            <th v-for="column in columns" :key="column.key" scope="col">{{ column.label }}</th>
            <th scope="col">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.id">
            <td v-for="column in columns" :key="column.key">
              {{
                column.key === 'status'
                  ? row.status === 1
                    ? article
                      ? '已发布'
                      : '启用'
                    : article
                      ? '草稿'
                      : '禁用'
                  : (row[column.key] ?? '—')
              }}
            </td>
            <td class="row-actions">
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
          <tr v-if="!loading && !rows.length">
            <td :colspan="columns.length + 1">暂无数据</td>
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
  min-width: 160px;
  white-space: nowrap;
}
[role='alert'] {
  color: #b42318;
  overflow-wrap: anywhere;
}
</style>
