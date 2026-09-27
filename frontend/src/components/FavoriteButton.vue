<script setup>
import { computed } from 'vue'
import { toggleFavorite, useToolPreferences } from '../utils/toolPreferences'

const props = defineProps({
  slug: { type: String, required: true },
  name: { type: String, required: true },
})
const { favorites } = useToolPreferences()
const selected = computed(() => favorites.value.includes(props.slug))
</script>

<template>
  <button
    type="button"
    class="favorite-button"
    :class="{ 'is-favorite': selected }"
    :aria-pressed="selected"
    :aria-label="`${selected ? '取消收藏' : '收藏'}${name}`"
    @click="toggleFavorite(slug)"
  >
    <span aria-hidden="true">{{ selected ? '★' : '☆' }}</span>
    {{ selected ? '已收藏' : '收藏' }}
  </button>
</template>
