<script setup>
import { ref } from 'vue'
import ToolPageHeader from '../../../components/ToolPageHeader.vue'
import CopyButton from '../../../components/CopyButton.vue'
import { generateNickname, nicknameCategories } from '../../../utils/tools/fun/nickname'

const category = ref('game')
const nickname = ref('')

function generate() {
  nickname.value = generateNickname(category.value)
}
</script>

<template>
  <ToolPageHeader
    title="随机昵称生成器"
    description="从内置词库组合游戏、程序员、可爱和中二风格的昵称。"
  />
  <section class="card tool-panel" aria-label="随机昵称生成器">
    <label for="nickname-category">昵称分类</label>
    <select id="nickname-category" v-model="category" @change="nickname = ''">
      <option v-for="item in nicknameCategories" :key="item.value" :value="item.value">
        {{ item.label }}
      </option>
    </select>
    <div class="tool-actions">
      <ElButton type="primary" @click="generate">{{ nickname ? '重新生成' : '生成昵称' }}</ElButton>
      <CopyButton :text="nickname" :disabled="!nickname" label="复制昵称" />
    </div>
    <div v-if="nickname" class="fun-result" role="status" aria-live="polite">{{ nickname }}</div>
  </section>
</template>
