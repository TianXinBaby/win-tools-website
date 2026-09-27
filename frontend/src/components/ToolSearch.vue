<script setup>
defineProps({
  query: { type: String, default: '' },
  category: { type: String, default: '' },
  categories: { type: Array, default: () => [] },
})
defineEmits(['update:query', 'update:category'])
</script>

<template>
  <div class="tool-search" role="search" aria-label="搜索工具">
    <label>
      <span>搜索工具</span>
      <input
        type="search"
        :value="query"
        placeholder="输入名称或描述，例如：二维码"
        @input="$emit('update:query', $event.target.value)"
      />
    </label>
    <label>
      <span>工具分类</span>
      <select :value="category" @change="$emit('update:category', $event.target.value)">
        <option value="">全部分类</option>
        <option v-for="item in categories" :key="item.value" :value="item.value">
          {{ item.label }}（{{ item.count }}）
        </option>
      </select>
    </label>
  </div>
</template>
