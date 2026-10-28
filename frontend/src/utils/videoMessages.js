export const videoMessages = {
  VIDEO_DISABLED: '视频转换暂未启用，请稍后再试。',
  VIDEO_DEPENDENCY_UNAVAILABLE: '视频转换组件暂不可用，请稍后再试。',
  VIDEO_STORAGE_CONFIGURATION: '视频转换服务尚未准备就绪。',
  VIDEO_STORAGE_UNAVAILABLE: '临时存储不可用，请稍后重试。',
  VIDEO_TARGET_UNSUPPORTED: '不支持此输出格式。',
  VIDEO_INPUT_UNSUPPORTED: '请选择 ASF、WMV、MP4、MKV、MOV、AVI 或 WebM 文件。',
  VIDEO_TOO_LARGE: '文件超过服务器大小限制。',
  VIDEO_QUEUE_FULL: '转换队列或临时存储已满，请稍后重试。',
  VIDEO_INVALID_FILE: '文件损坏或无法识别，请重新选择有效视频。',
  VIDEO_NO_VIDEO_STREAM: '文件中没有视频流。',
  VIDEO_DIMENSIONS_UNSUPPORTED: '视频尺寸无效或超过 4K 像素上限。',
  VIDEO_DURATION_INVALID: '视频时长未知、无效或超过限制。',
  VIDEO_PROCESS_FAILED:
    '无法解码或转换该视频；文件可能损坏，或服务器不支持所需编码器。请更换文件或输出格式。',
  VIDEO_TIMEOUT: '转换超时，请使用更短或更小的视频重试。',
  VIDEO_OUTPUT_INVALID: '输出文件不完整或超过大小限制，请使用更短的视频重试。',
  VIDEO_CANCELLED: '任务已取消。',
  VIDEO_CONVERSION_FAILED: '转换失败，请重试。',
  VIDEO_JOB_NOT_FOUND: '任务已过期、会话已失效或服务已重启，请重新上传。',
  VIDEO_NOT_READY: '文件尚未转换完成。',
}
export const videoMessage = (code) => videoMessages[code] || '转换失败，请重试。'
