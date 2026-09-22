<script setup>
import { reactive } from 'vue'
import { ElButton } from 'element-plus'

const props = defineProps({
  fields: { type: Array, required: true },
  initial: { type: Object, required: true },
  submitting: Boolean,
})
const emit = defineEmits(['save', 'cancel'])
const values = reactive(
  Object.fromEntries(
    props.fields.map((field) => [field.key, props.initial[field.key] ?? field.default ?? '']),
  ),
)

function submit() {
  if (props.submitting) return
  const payload = Object.fromEntries(
    props.fields.map((field) => [
      field.key,
      values[field.key] === '' && !field.required ? null : values[field.key],
    ]),
  )
  emit('save', payload)
}
</script>

<template>
  <form class="admin-form" :aria-busy="submitting" @submit.prevent="submit">
    <fieldset :disabled="submitting">
      <div v-for="field in fields" :key="field.key" class="admin-field">
        <label :for="'admin-field-' + field.key"
          >{{ field.label }}{{ field.required ? ' *' : '' }}</label
        >
        <select
          v-if="field.type === 'status'"
          :id="'admin-field-' + field.key"
          v-model="values[field.key]"
        >
          <option :value="0">{{ field.draft ? '草稿' : '禁用' }}</option>
          <option :value="1">{{ field.draft ? '已发布' : '启用' }}</option>
        </select>
        <textarea
          v-else-if="field.type === 'textarea'"
          :id="'admin-field-' + field.key"
          v-model="values[field.key]"
          :rows="field.key === 'content' ? 16 : 3"
          :maxlength="field.max"
          :required="field.required"
        />
        <input
          v-else-if="field.type === 'number'"
          :id="'admin-field-' + field.key"
          v-model.number="values[field.key]"
          type="number"
          min="0"
          max="1000000"
          step="1"
          required
        />
        <input
          v-else
          :id="'admin-field-' + field.key"
          v-model="values[field.key]"
          :type="field.type || 'text'"
          :maxlength="field.max"
          :required="field.required"
          :pattern="field.pattern"
        />
        <small v-if="field.hint">{{ field.hint }}</small>
      </div>
    </fieldset>
    <div class="form-actions">
      <ElButton :disabled="submitting" @click="emit('cancel')">取消</ElButton>
      <ElButton type="primary" native-type="submit" :loading="submitting" :disabled="submitting"
        >保存</ElButton
      >
    </div>
  </form>
</template>

<style scoped>
fieldset {
  border: 0;
  padding: 0;
  margin: 0;
  min-width: 0;
}
.admin-field {
  display: grid;
  gap: 6px;
  margin-bottom: 16px;
}
input,
textarea,
select {
  width: 100%;
  min-width: 0;
  border: 1px solid #94a3b8;
  border-radius: 6px;
  padding: 9px;
  font: inherit;
  color: #182230;
  background: white;
  box-sizing: border-box;
}
textarea {
  resize: vertical;
}
small {
  color: #475467;
  overflow-wrap: anywhere;
}
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
