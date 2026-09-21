<script setup>
import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'
import { useLocalUrl } from '../composables/useLocalUrl'
import { downloadBlob, mediaErrorMessage } from '../utils/tools/media'
import {
  IMAGE_ACCEPT,
  IMAGE_FORMATS,
  IMAGE_LIMITS,
  calculateResizeDimensions,
  formatFileSize,
  imageFilename,
  loadImage,
  processImage,
  sizeSavings,
  validateDimensions,
} from '../utils/tools/image'

const props = defineProps({
  mode: {
    type: String,
    required: true,
    validator: (value) => ['compress', 'resize', 'convert'].includes(value),
  },
})
const fileInput = ref(null)
const file = shallowRef(null)
const image = shallowRef(null)
const result = shallowRef(null)
const busy = ref(false)
const error = ref('')
const quality = ref(80)
const mime = ref('image/webp')
const width = ref('')
const height = ref('')
const keepRatio = ref(true)
const originalPreview = useLocalUrl()
const outputPreview = useLocalUrl()
const originalUrl = originalPreview.url
const outputUrl = outputPreview.url
let revision = 0
let lastDimension = 'width'
const outputMime = computed(() =>
  props.mode === 'convert' ? mime.value : file.value?.type || 'image/png',
)
const action = computed(
  () => ({ compress: '压缩 / 重新编码', resize: '调整尺寸', convert: '转换格式' })[props.mode],
)
const savings = computed(() =>
  result.value ? sizeSavings(file.value.size, result.value.blob.size) : null,
)

function resetResult() {
  revision++
  error.value = ''
  result.value = null
  outputPreview.clear()
}
function clear(resetInput = true) {
  resetResult()
  originalPreview.clear()
  image.value?.close()
  image.value = null
  file.value = null
  width.value = height.value = ''
  quality.value = 80
  mime.value = 'image/webp'
  keepRatio.value = true
  lastDimension = 'width'
  if (resetInput && fileInput.value) fileInput.value.value = ''
}
onBeforeUnmount(clear)

async function selectFile(event) {
  if (busy.value) return
  const selected = event.target.files?.[0]
  if (!selected) return
  clear(false)
  const current = revision
  busy.value = true
  let decoded
  try {
    decoded = await loadImage(selected)
    if (current !== revision) {
      decoded.close()
      return
    }
    originalPreview.set(selected)
    file.value = selected
    image.value = decoded
    width.value = decoded.width
    height.value = decoded.height
  } catch (cause) {
    decoded?.close()
    if (fileInput.value) fileInput.value.value = ''
    if (current === revision) error.value = mediaErrorMessage(cause)
  } finally {
    busy.value = false
  }
}

function changeDimension(axis) {
  lastDimension = axis
  resetResult()
  if (!keepRatio.value || !image.value) return
  try {
    const dimensions = calculateResizeDimensions(
      image.value.width,
      image.value.height,
      Number(axis === 'width' ? width.value : height.value),
      axis,
    )
    width.value = dimensions.width
    height.value = dimensions.height
  } catch (cause) {
    error.value = mediaErrorMessage(cause)
  }
}

async function process() {
  if (busy.value) return
  resetResult()
  const current = revision
  busy.value = true
  try {
    if (!image.value) {
      error.value = '请先选择图片。'
      return
    }
    let dimensions =
      props.mode === 'resize'
        ? validateDimensions(Number(width.value), Number(height.value))
        : { width: image.value.width, height: image.value.height }
    // Use the last edited axis and original ratio, never reverse a rounded dimension.
    if (props.mode === 'resize' && keepRatio.value) {
      dimensions = calculateResizeDimensions(
        image.value.width,
        image.value.height,
        dimensions[lastDimension],
        lastDimension,
      )
      width.value = dimensions.width
      height.value = dimensions.height
    }
    const type = outputMime.value
    const blob = await processImage(image.value, {
      ...dimensions,
      mime: type,
      quality: quality.value,
    })
    if (current !== revision) return
    const suffix =
      props.mode === 'compress'
        ? '-compressed'
        : props.mode === 'resize'
          ? `-${dimensions.width}x${dimensions.height}`
          : ''
    outputPreview.set(blob)
    result.value = { blob, ...dimensions, filename: imageFilename(file.value.name, type, suffix) }
  } catch (cause) {
    if (current === revision) error.value = mediaErrorMessage(cause)
  } finally {
    busy.value = false
  }
}

function download() {
  try {
    downloadBlob(result.value?.blob, result.value?.filename)
  } catch (cause) {
    error.value = mediaErrorMessage(cause)
  }
}
</script>

<template>
  <section class="card tool-panel" aria-label="图片处理工具" :aria-busy="busy">
    <p class="privacy-note">图片和输入内容仅在当前浏览器中处理，不会上传服务器。</p>
    <p class="tool-help">
      支持静态 JPEG、PNG、WebP；单文件最多 20 MiB，单边最多
      {{ IMAGE_LIMITS.maxDimension }} px，总像素最多 1600 万。当前版本不支持保留 GIF
      动画，也不支持动画 WebP、HEIC、RAW、PSD 或 AVIF。
    </p>
    <label for="image-file">选择本地图片</label>
    <input
      id="image-file"
      ref="fileInput"
      type="file"
      :accept="IMAGE_ACCEPT"
      :disabled="busy"
      @change="selectFile"
    />
    <div v-if="file" class="media-info" data-testid="original-info">
      <p>文件名：{{ file.name }}</p>
      <p>原始格式：{{ file.type }} · 原始大小：{{ formatFileSize(file.size) }}</p>
      <p>原始尺寸：{{ image.width }} × {{ image.height }} px</p>
    </div>
    <fieldset class="media-settings" :disabled="busy">
      <legend>处理设置</legend>
      <template v-if="mode === 'resize'">
        <label class="media-checkbox" for="image-ratio"
          ><input
            id="image-ratio"
            v-model="keepRatio"
            type="checkbox"
            @change="changeDimension('width')"
          />保持宽高比</label
        >
        <div class="media-dimensions">
          <div>
            <label for="image-width">目标宽度（px）</label
            ><input
              id="image-width"
              v-model="width"
              type="number"
              min="1"
              :max="IMAGE_LIMITS.maxDimension"
              step="1"
              @input="changeDimension('width')"
            />
          </div>
          <div>
            <label for="image-height">目标高度（px）</label
            ><input
              id="image-height"
              v-model="height"
              type="number"
              min="1"
              :max="IMAGE_LIMITS.maxDimension"
              step="1"
              @input="changeDimension('height')"
            />
          </div>
        </div>
      </template>
      <template v-if="mode === 'convert'">
        <label for="image-format">目标格式</label>
        <select id="image-format" v-model="mime" @change="resetResult">
          <option v-for="(extension, type) in IMAGE_FORMATS" :key="type" :value="type">
            {{ extension.toUpperCase() }}
          </option>
        </select>
      </template>
      <template v-if="outputMime !== 'image/png'">
        <label for="image-quality">输出质量：{{ quality }}%</label>
        <input
          id="image-quality"
          v-model.number="quality"
          type="range"
          min="10"
          max="100"
          step="1"
          @input="resetResult"
        />
      </template>
      <p v-else class="tool-help">
        PNG 将重新编码，质量参数不适用，不保证体积减小。希望明显减小体积时，可转换为 WebP / JPEG。
      </p>
      <p v-if="outputMime === 'image/jpeg'" class="tool-help">
        JPEG 不支持透明背景，透明区域将填充为白色。
      </p>
      <p v-if="file && mode !== 'convert'" class="tool-help">输出保持 {{ file.type }} 格式。</p>
    </fieldset>
    <div class="tool-actions">
      <ElButton type="primary" :loading="busy" :disabled="busy" @click="process">{{
        action
      }}</ElButton>
      <ElButton @click="clear">清空</ElButton>
      <ElButton :disabled="!result || busy" @click="download">下载图片</ElButton>
    </div>
    <p v-if="busy" role="status">正在读取或处理图片，请稍候…</p>
    <p v-if="error" class="tool-error" role="alert">{{ error }}</p>
    <div v-if="result" class="media-info" role="status" data-testid="result-info">
      <p>处理完成：{{ result.width }} × {{ result.height }} px · {{ result.blob.type }}</p>
      <p>输出大小：{{ formatFileSize(result.blob.size) }}</p>
      <template v-if="mode === 'compress'">
        <p>
          原始大小：{{ formatFileSize(file.size) }} · 节省大小：{{
            formatFileSize(savings.saved)
          }}
          · 节省比例：{{ savings.percent.toFixed(1) }}%
        </p>
        <p v-if="!savings.smaller">处理后的文件没有变小。</p>
      </template>
      <p>下载文件：{{ result.filename }}</p>
    </div>
    <div class="media-previews">
      <figure v-if="originalUrl" class="media-preview">
        <img :src="originalUrl" alt="所选原始图片的本地预览" />
        <figcaption>原始图片</figcaption>
      </figure>
      <figure v-if="outputUrl" class="media-preview">
        <img :src="outputUrl" alt="处理后图片的本地预览" />
        <figcaption>处理结果</figcaption>
      </figure>
    </div>
    <p class="tool-help">
      处理后的图片通常不会保留原始 EXIF 等元数据。浏览器负责解码和照片方向处理，不保证所有 EXIF
      方向数据都完全兼容。结果仅在当前页面保留，下载会生成新文件。
    </p>
  </section>
</template>
