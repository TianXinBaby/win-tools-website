<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import ToolPageHeader from '../../components/ToolPageHeader.vue'
import {
  getVideoCapabilities,
  createVideoJob,
  getVideoJob,
  cancelVideoJob,
  videoMessage,
} from '../../api/videoConverter'

const capabilities = ref(null)
const file = ref(null)
const target = ref('mp4')
const job = ref(null)
const uploading = ref(false)
const uploadProgress = ref(null)
const error = ref('')
const cancelRequested = ref(false)
const cancelling = ref(false)
const loading = ref(true)
const pollFailed = ref(false)
let timer, expiryTimer
let disposed = false
let pollVersion = 0
const active = computed(
  () => uploading.value || ['QUEUED', 'VALIDATING', 'CONVERTING'].includes(job.value?.status),
)
const busy = computed(() => active.value || cancelling.value)
const labels = {
  QUEUED: '排队中',
  VALIDATING: '正在验证视频',
  CONVERTING: '正在转换',
  COMPLETED: '转换完成',
  FAILED: '转换失败',
  CANCELLED: '已取消',
  EXPIRED: '已过期',
}
const accept = '.asf,.wmv,.mp4,.mkv,.mov,.avi,.webm'
const size = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`
const downloadUrl = computed(() =>
  job.value?.status === 'COMPLETED'
    ? `/api/tools/video-converter/jobs/${encodeURIComponent(job.value.jobId)}/download`
    : null,
)

async function loadCapabilities() {
  loading.value = true
  error.value = ''
  try {
    capabilities.value = await getVideoCapabilities()
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
function selectFile(selected) {
  if (busy.value || !selected) return
  error.value = ''
  const extension = selected.name.split('.').pop().toLowerCase()
  if (!accept.split(',').includes(`.${extension}`)) {
    file.value = null
    error.value = videoMessage('VIDEO_INPUT_UNSUPPORTED')
  } else if (!selected.size || selected.size > capabilities.value?.maxUploadBytes) {
    file.value = null
    error.value = selected.size
      ? videoMessage('VIDEO_TOO_LARGE')
      : videoMessage('VIDEO_INVALID_FILE')
  } else file.value = selected
}
async function poll() {
  clearTimeout(timer)
  if (disposed || !job.value) return
  const version = pollVersion
  try {
    const result = await getVideoJob(job.value.jobId)
    if (disposed || version !== pollVersion) return
    job.value = result
    pollFailed.value = false
    error.value = job.value.status === 'FAILED' ? videoMessage(job.value.errorCode) : ''
    if (active.value) timer = setTimeout(poll, 1000)
    if (job.value.status === 'COMPLETED') {
      expiryTimer = setTimeout(() => {
        job.value = { ...job.value, status: 'EXPIRED' }
        error.value = videoMessage('VIDEO_JOB_NOT_FOUND')
      }, capabilities.value.jobTtlMinutes * 60000)
    }
  } catch (e) {
    if (disposed || version !== pollVersion) return
    if (e.status === 404) job.value = { ...job.value, status: 'EXPIRED' }
    else pollFailed.value = true
    error.value = e.message
  }
}
async function cancel() {
  pollVersion++
  cancelRequested.value = true
  if (uploading.value) return // The response gives us the server ID needed for authenticated cleanup.
  if (!job.value) return
  cancelling.value = true
  clearTimeout(timer)
  clearTimeout(expiryTimer)
  try {
    job.value = await cancelVideoJob(job.value.jobId)
    error.value = ''
    pollFailed.value = false
  } catch (e) {
    if (e.status === 404) job.value = { ...job.value, status: 'EXPIRED' }
    else pollFailed.value = true
    error.value = e.message
  } finally {
    cancelling.value = false
    cancelRequested.value = false
  }
}
async function start() {
  if (!file.value || busy.value || !capabilities.value?.available) return
  pollVersion++
  clearTimeout(expiryTimer)
  if (job.value?.status === 'COMPLETED') {
    await cancel()
    if (error.value) return
  }
  uploading.value = true
  cancelRequested.value = false
  uploadProgress.value = null
  job.value = null
  error.value = ''
  pollFailed.value = false
  try {
    job.value = await createVideoJob(file.value, target.value, (event) => {
      uploadProgress.value = event.total
        ? Math.min(100, Math.round((event.loaded / event.total) * 100))
        : null
    })
    uploading.value = false
    if (cancelRequested.value || disposed) await cancel()
    else await poll()
  } catch (e) {
    error.value = e.message
  } finally {
    uploading.value = false
  }
}
onMounted(loadCapabilities)
onBeforeUnmount(() => {
  disposed = true
  clearTimeout(timer)
  clearTimeout(expiryTimer)
  if (busy.value) void cancel()
})
</script>

<template>
  <ToolPageHeader
    title="视频格式转换器"
    server-processing
    description="将 ASF、WMV 等视频转换为 MP4、MKV、MOV、AVI 或 WebM。实际解码能力取决于服务器，部分编码可能不受支持。"
    :privacy-note="`视频将上传至本站服务器进行 FFmpeg 转换，不发送给第三方。完成的文件保留 ${capabilities?.jobTtlMinutes || 30} 分钟；取消、失败或过期后清理。刷新页面或会话失效后请重新上传。`"
  />
  <section class="card video-converter" aria-label="视频转换">
    <p v-if="loading" role="status">正在检查服务状态…</p>
    <template v-else-if="!capabilities?.available">
      <p role="status">
        {{ capabilities ? videoMessage(capabilities.reason) : '暂时无法连接视频转换服务。' }}
      </p>
      <button type="button" class="button-link" @click="loadCapabilities">重新检查</button>
    </template>
    <template v-else>
      <p>
        单文件最多 {{ size(capabilities.maxUploadBytes) }}，时长最多
        {{ capabilities.maxDurationSeconds }} 秒，尺寸最多 4K
        像素。服务器转换可能需要等待，请保持页面打开。
      </p>
      <div
        class="video-dropzone"
        @dragover.prevent
        @drop.prevent="selectFile($event.dataTransfer.files[0])"
      >
        <label for="video-file">选择视频，或将单个文件拖放到这里</label>
        <input
          id="video-file"
          type="file"
          :accept="accept"
          :disabled="busy"
          @change="selectFile($event.target.files[0])"
        />
        <p v-if="file" class="video-filename">{{ file.name }} · {{ size(file.size) }}</p>
        <p>支持 ASF / WMV / MP4 / MKV / MOV / AVI / WebM；服务器会检查实际视频内容。</p>
      </div>
      <label for="video-format">输出格式</label>
      <select id="video-format" v-model="target" :disabled="busy">
        <option v-for="format in capabilities.outputFormats" :key="format" :value="format">
          {{ format.toUpperCase() }}
        </option>
      </select>
      <div class="video-actions">
        <button type="button" class="button-link primary" :disabled="!file || busy" @click="start">
          开始转换
        </button>
        <button
          v-if="active || job?.status === 'COMPLETED'"
          type="button"
          class="button-link"
          :disabled="cancelling || cancelRequested"
          @click="cancel"
        >
          {{ job?.status === 'COMPLETED' ? '删除转换文件' : '取消任务' }}
        </button>
        <button v-if="pollFailed" type="button" class="button-link" @click="poll">重试查询</button>
        <a v-if="downloadUrl" class="button-link primary" :href="downloadUrl" download
          >下载 {{ job.targetFormat.toUpperCase() }}</a
        >
      </div>
      <div role="status" aria-live="polite">
        <template v-if="uploading">
          <p>
            正在上传{{ uploadProgress === null ? '' : ` ${uploadProgress}%`
            }}{{ uploadProgress === 100 ? '，等待服务器接收确认' : '' }}
          </p>
          <progress :value="uploadProgress ?? undefined" max="100" aria-label="文件上传进度" />
        </template>
        <p v-if="cancelRequested">已请求取消，收到上传响应后将立即终止任务并清理文件。</p>
        <p v-if="job">
          {{ labels[job.status]
          }}{{ job.status === 'CONVERTING' && job.progress !== null ? ` ${job.progress}%` : '' }}
        </p>
        <progress
          v-if="job?.status === 'CONVERTING'"
          :value="job.progress ?? undefined"
          max="100"
          aria-label="服务器转换进度"
        />
      </div>
    </template>
    <p v-if="error" role="alert">{{ error }}</p>
  </section>
</template>

<style scoped>
.video-converter {
  padding: 24px;
}
.video-dropzone {
  border: 2px dashed var(--line);
  border-radius: 10px;
  padding: 20px;
  margin: 20px 0;
}
.video-dropzone label {
  display: block;
  margin-bottom: 12px;
}
.video-dropzone input {
  max-width: 100%;
}
.video-filename {
  overflow-wrap: anywhere;
}
.video-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 20px 0;
}
select {
  margin-left: 12px;
  padding: 8px;
  border: 1px solid var(--line);
  border-radius: 6px;
}
button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
progress {
  width: 100%;
}
[role='alert'] {
  color: #b42318;
}
</style>
