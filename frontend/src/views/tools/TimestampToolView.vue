<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import ToolPageHeader from '../../components/ToolPageHeader.vue'
import CopyButton from '../../components/CopyButton.vue'
import {
  timestampToDate,
  dateToTimestamp,
  parseLocalDateTime,
  formatLocalDateTime,
} from '../../utils/tools/timestamp'

const now = ref(new Date())
let timer
onMounted(() => {
  timer = setInterval(() => {
    now.value = new Date()
  }, 1000)
})
onBeforeUnmount(() => clearInterval(timer))
const currentSeconds = computed(() => dateToTimestamp(now.value, 'seconds'))
const currentMilliseconds = computed(() => dateToTimestamp(now.value, 'milliseconds'))
const timestamp = ref('')
const unit = ref('seconds')
const localDate = ref('')
const dateResult = ref('')
const stampResult = ref('')
const dateError = ref('')
const stampError = ref('')
function resetDateResult() {
  dateResult.value = ''
  dateError.value = ''
}
function resetStampResult() {
  stampResult.value = ''
  stampError.value = ''
}
function clear() {
  timestamp.value = ''
  localDate.value = ''
  resetDateResult()
  resetStampResult()
}
function toDate() {
  resetDateResult()
  try {
    dateResult.value = formatLocalDateTime(timestampToDate(timestamp.value, unit.value))
  } catch (cause) {
    dateError.value = cause.message
  }
}
function toTimestamp() {
  resetStampResult()
  try {
    const date = parseLocalDateTime(localDate.value)
    stampResult.value = `Unix 秒：${dateToTimestamp(date, 'seconds')}\nUnix 毫秒：${dateToTimestamp(date, 'milliseconds')}`
  } catch (cause) {
    stampError.value = cause.message
  }
}
</script>

<template>
  <ToolPageHeader
    title="时间戳转换"
    description="Unix 秒 / 毫秒与日期时间双向转换。输入和结果按当前浏览器本地时区解释与显示，支持 1970 年之前的负数时间戳。"
  />
  <section class="card tool-panel" aria-label="当前时间">
    <h2>当前时间</h2>
    <dl class="clock-values">
      <div>
        <dt>当前本地时间</dt>
        <dd>{{ formatLocalDateTime(now) }}</dd>
      </div>
      <div>
        <dt>当前 Unix 秒</dt>
        <dd>{{ currentSeconds }}</dd>
      </div>
      <div>
        <dt>当前 Unix 毫秒</dt>
        <dd>{{ currentMilliseconds }}</dd>
      </div>
    </dl>
    <p>
      每秒刷新。夏令时回拨时重复出现的本地时间按浏览器 Date 规则选择较早时刻；跳过的时间会提示错误。
    </p>
  </section>
  <div class="tool-columns">
    <section class="card tool-panel" aria-label="时间戳转日期">
      <h2>时间戳 → 本地日期时间</h2>
      <label for="timestamp-input">Unix 时间戳（整数）</label>
      <input
        id="timestamp-input"
        v-model="timestamp"
        type="text"
        placeholder="例如：0、-1 或 1700000000"
        @input="resetDateResult"
      />
      <label for="timestamp-unit">输入单位</label>
      <select id="timestamp-unit" v-model="unit" @change="resetDateResult">
        <option value="seconds">秒</option>
        <option value="milliseconds">毫秒</option>
      </select>
      <div class="tool-actions">
        <ElButton type="primary" @click="toDate">转换为日期时间</ElButton>
      </div>
      <p v-if="dateError" class="tool-error" role="alert">{{ dateError }}</p>
      <label for="date-output">本地日期时间结果</label>
      <textarea
        id="date-output"
        :value="dateResult"
        rows="3"
        readonly
        placeholder="按浏览器本地时区显示"
      />
      <CopyButton :text="dateResult" :disabled="!dateResult" />
    </section>
    <section class="card tool-panel" aria-label="日期转时间戳">
      <h2>本地日期时间 → 时间戳</h2>
      <label for="date-input">本地日期时间</label>
      <input
        id="date-input"
        v-model="localDate"
        type="datetime-local"
        step="0.001"
        @input="resetStampResult"
      />
      <p>可输入到毫秒；Unix 秒向下取整。</p>
      <div class="tool-actions">
        <ElButton type="primary" @click="toTimestamp">转换为时间戳</ElButton>
      </div>
      <p v-if="stampError" class="tool-error" role="alert">{{ stampError }}</p>
      <label for="timestamp-output">Unix 秒 / 毫秒结果</label>
      <textarea
        id="timestamp-output"
        :value="stampResult"
        rows="3"
        readonly
        placeholder="同时显示秒和毫秒"
      />
      <CopyButton :text="stampResult" :disabled="!stampResult" />
    </section>
  </div>
  <div class="tool-actions"><ElButton @click="clear">清空</ElButton></div>
</template>
