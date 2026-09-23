// Real Chrome smoke test. Start npm.cmd run dev first. Generated fixtures/results stay in .cache.
import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { Buffer } from 'node:buffer'
import { env } from 'node:process'
import assert from 'node:assert/strict'

const root = fileURLToPath(new URL('../../', import.meta.url))
  .replaceAll('\\', '/')
  .replace(/\/$/, '')
const cache = `${root}/.cache`
const profile = `${cache}/phase7-browser-profile`
const downloadPath = `${cache}/phase7-downloads`
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const errors = [],
  requests = [],
  cases = [],
  downloads = []
let chrome, socket
await mkdir(profile, { recursive: true })
await mkdir(downloadPath, { recursive: true })
try {
  chrome = spawn(
    env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    [
      '--headless=new',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      'about:blank',
    ],
    { windowsHide: true, stdio: 'ignore' },
  )
  let launchError
  chrome.on('error', (error) => {
    launchError = error
  })
  let target
  for (let attempt = 0; attempt < 100; attempt++) {
    if (launchError) throw launchError
    try {
      const port = (await readFile(`${profile}/DevToolsActivePort`, 'utf8')).split('\n')[0]
      target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(
        (item) => item.type === 'page',
      )
      if (target) break
    } catch {
      /* Chrome is starting. */
    }
    await pause(100)
  }
  assert.ok(target, 'Chrome remote debugging did not start')
  socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })
  const pending = new Map()
  let nextId = 0
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data)
    if (pending.has(message.id)) {
      pending.get(message.id)(message)
      pending.delete(message.id)
    }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails)
    if (message.method === 'Log.entryAdded' && message.params.entry.source === 'security')
      errors.push('Browser security policy violation')
    if (
      message.method === 'Runtime.consoleAPICalled' &&
      ['error', 'warning'].includes(message.params.type)
    )
      errors.push(message.params)
    if (message.method === 'Network.requestWillBeSent') requests.push(message.params.request)
    if (message.method === 'Browser.downloadProgress' && message.params.state === 'completed')
      downloads.push(message.params.guid)
  })
  function cdp(method, params = {}) {
    const id = ++nextId
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id)
        reject(new Error(`CDP timeout: ${method}`))
      }, 20000)
      pending.set(id, (message) => {
        clearTimeout(timer)
        message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result)
      })
      socket.send(JSON.stringify({ id, method, params }))
    })
  }
  async function evaluate(expression) {
    const response = await cdp('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    })
    if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails))
    return response.result.value
  }
  async function waitFor(expression) {
    for (let attempt = 0; attempt < 150; attempt++) {
      if (await evaluate(expression)) return
      await pause(50)
    }
    throw new Error(`Wait failed: ${expression}`)
  }
  async function open(slug) {
    await cdp('Page.navigate', {
      url: `${env.BASE_URL || 'http://127.0.0.1:5173'}/tools/${slug}`,
    })
    await waitFor(
      `!!document.querySelector('${slug === 'qrcode' ? '#qrcode-input' : '#image-file'}')`,
    )
  }
  async function setValue(id, value) {
    await evaluate(
      `(() => { const element = document.getElementById(${JSON.stringify(id)}); element.value = ${JSON.stringify(value)}; element.dispatchEvent(new Event('input', { bubbles: true })); element.dispatchEvent(new Event('change', { bubbles: true })); })()`,
    )
    await pause(30)
  }
  async function click(label) {
    await evaluate(
      `[...document.querySelectorAll('button')].find(element => element.innerText.trim() === ${JSON.stringify(label)}).click()`,
    )
    await pause(30)
  }
  async function select(mime, noise = false) {
    await evaluate(`(async () => {
      const canvas = document.createElement('canvas'); canvas.width = ${noise ? 1400 : 96}; canvas.height = ${noise ? 1000 : 64};
      const context = canvas.getContext('2d');
      if (${noise}) {
        const pixels = context.createImageData(canvas.width, canvas.height); let seed = 7;
        for (let i = 0; i < pixels.data.length; i += 4) { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; pixels.data[i] = seed & 255; pixels.data[i+1] = (seed >>> 8) & 255; pixels.data[i+2] = (seed >>> 16) & 255; pixels.data[i+3] = 255; }
        context.putImageData(pixels, 0, 0);
      } else { context.fillStyle = '#e06020'; context.fillRect(24, 16, 48, 32); }
      const blob = await new Promise(resolve => canvas.toBlob(resolve, ${JSON.stringify(mime)}, 0.95));
      const file = new File([blob], 'generated.' + ({'image/png':'png','image/jpeg':'jpg','image/webp':'webp'})[blob.type], {type: blob.type});
      const transfer = new DataTransfer(); transfer.items.add(file); const input = document.querySelector('#image-file'); input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true }));
      canvas.width = canvas.height = 1;
    })()`)
    await waitFor(`document.querySelector('[aria-busy]').getAttribute('aria-busy') === 'false'`)
    assert.equal(
      await evaluate(`!!document.querySelector('[role="alert"]')`),
      false,
      await evaluate('document.body.innerText'),
    )
    await waitFor(`!!document.querySelector('[data-testid="original-info"]')`)
    assert.equal(await evaluate(`document.querySelector('#image-file').files.length`), 1)
  }
  async function inspectResult(mime, width, height, white = false) {
    await waitFor(`!!document.querySelector('[data-testid="result-info"]')`)
    const result = await evaluate(`(async () => {
      const img = [...document.querySelectorAll('.media-preview img')].at(-1); const blob = window.liveUrls.get(img.src); const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height; const context = canvas.getContext('2d'); context.drawImage(bitmap, 0, 0);
      const answer = { width: bitmap.width, height: bitmap.height, type: blob.type, size: blob.size, corner: [...context.getImageData(0, 0, 1, 1).data] };
      bitmap.close(); canvas.width = canvas.height = 1; return answer;
    })()`)
    assert.equal(result.type, mime)
    assert.equal(result.width, width)
    assert.equal(result.height, height)
    assert.ok(result.size > 0)
    if (white) assert.deepEqual(result.corner, [255, 255, 255, 255])
    return result
  }
  async function download(label, mime) {
    const before = downloads.length
    await click(label)
    for (let i = 0; i < 100 && downloads.length === before; i++) await pause(50)
    assert.equal(
      downloads.length,
      before + 1,
      `Download must complete: ${JSON.stringify(errors)} ${await evaluate('document.body.innerText')}`,
    )
    const bytes = await readFile(`${downloadPath}/${downloads.at(-1)}`)
    assert.ok(bytes.length > 0)
    if (mime === 'image/png') assert.equal(bytes.readUInt32BE(0), 0x89504e47)
    if (mime === 'image/jpeg') assert.equal(bytes.readUInt16BE(0), 0xffd8)
    if (mime === 'image/webp') assert.equal(bytes.toString('ascii', 8, 12), 'WEBP')
  }
  async function checkLayout(width, slug) {
    await waitFor(
      `[...document.querySelectorAll('.media-preview img')].every(img => img.complete && img.naturalWidth > 0)`,
    )
    assert.equal(
      await evaluate('document.documentElement.scrollWidth <= window.innerWidth'),
      true,
      `${slug} overflows at ${width}`,
    )
    assert.deepEqual(await evaluate('window.privacyWrites'), [])
    if ([1440, 320].includes(width)) {
      const screenshot = await cdp('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: true,
      })
      await writeFile(
        `${cache}/phase7-${slug}-${width}.png`,
        Buffer.from(screenshot.data, 'base64'),
      )
    }
  }
  async function clearAndCheck() {
    await click('清空')
    await waitFor('window.liveUrls.size === 0')
    assert.equal(await evaluate(`document.querySelectorAll('.media-preview img').length`), 0)
  }
  await cdp('Runtime.enable')
  await cdp('Log.enable')
  await cdp('Page.enable')
  await cdp('Network.enable')
  await cdp('Browser.setDownloadBehavior', {
    behavior: 'allowAndName',
    downloadPath: downloadPath.replaceAll('/', '\\'),
    eventsEnabled: true,
  })
  await cdp('Page.addScriptToEvaluateOnNewDocument', {
    source: `
    window.liveUrls = new Map(); window.privacyWrites = [];
    const makeUrl = URL.createObjectURL.bind(URL), freeUrl = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = blob => { const url = makeUrl(blob); window.liveUrls.set(url, blob); return url; };
    URL.revokeObjectURL = url => { window.liveUrls.delete(url); freeUrl(url); };
    Storage.prototype.setItem = function() { window.privacyWrites.push('storage'); throw new Error('Unexpected storage write'); };
    IDBFactory.prototype.open = function() { window.privacyWrites.push('indexedDB'); throw new Error('Unexpected IndexedDB'); };
    Object.defineProperty(document, 'cookie', { get() { return ''; }, set() { window.privacyWrites.push('cookie'); throw new Error('Unexpected cookie write'); } });
  `,
  })

  for (const width of [1440, 768, 390, 320]) {
    await cdp('Emulation.setDeviceMetricsOverride', {
      width,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    })
    await open('qrcode')
    for (const text of ['Hello QR', '中文二维码 😀 https://example.com']) {
      await setValue('qrcode-input', text)
      await setValue('qrcode-size', 256)
      await click('生成二维码')
      await waitFor(`!!document.querySelector('.media-preview img')`)
      assert.equal(await evaluate(`document.querySelector('[role="alert"]')?.innerText || ''`), '')
      await download('下载 PNG', 'image/png')
      await checkLayout(width, 'qrcode')
      await clearAndCheck()
      cases.push({ width, action: 'qrcode', text })
    }
    for (const mime of ['image/jpeg', 'image/png', 'image/webp']) {
      await open('image-compress')
      await select(mime)
      if (mime !== 'image/png') await setValue('image-quality', 40)
      await click('压缩 / 重新编码')
      const result = await inspectResult(mime, 96, 64)
      await download('下载图片', mime)
      await checkLayout(width, 'image-compress')
      await clearAndCheck()
      cases.push({ width, action: 'compress', ...result })
    }
    await open('image-resize')
    await select('image/png')
    await setValue('image-width', 48)
    assert.equal(await evaluate(`document.querySelector('#image-height').value`), '32')
    await click('调整尺寸')
    await inspectResult('image/png', 48, 32)
    await download('下载图片', 'image/png')
    await evaluate(`document.querySelector('#image-ratio').click()`)
    await setValue('image-height', 20)
    await click('调整尺寸')
    await inspectResult('image/png', 48, 20)
    await checkLayout(width, 'image-resize')
    await clearAndCheck()
    cases.push({ width, action: 'resize locked and custom' })
    for (const [input, output] of [
      ['image/png', 'image/jpeg'],
      ['image/jpeg', 'image/webp'],
      ['image/webp', 'image/png'],
    ]) {
      await open('image-convert')
      await select(input)
      await setValue('image-format', output)
      await click('转换格式')
      const result = await inspectResult(output, 96, 64, output === 'image/jpeg')
      await download('下载图片', output)
      await checkLayout(width, 'image-convert')
      await clearAndCheck()
      cases.push({ width, action: 'convert', input, ...result })
    }
  }
  // Several-MiB fixture: deterministic noise, no user images or retained source files.
  await open('image-compress')
  await select('image/png', true)
  const sourceSize = await evaluate('window.liveUrls.values().next().value.size')
  assert.ok(sourceSize > 3 * 1024 * 1024)
  const started = Date.now()
  await click('压缩 / 重新编码')
  const result = await inspectResult('image/png', 1400, 1000)
  cases.push({
    action: 'several MiB image',
    sourceSize,
    elapsedMs: Date.now() - started,
    ...result,
  })
  await clearAndCheck()
  assert.deepEqual(errors, [])
  assert.ok(
    requests.every(
      (request) =>
        ['blob:', 'data:'].includes(new URL(request.url).protocol) ||
        ['127.0.0.1', 'localhost'].includes(new URL(request.url).hostname),
    ),
    'No external requests',
  )
  assert.deepEqual(
    requests.filter(
      (request) => request.method !== 'GET' || new URL(request.url).pathname.startsWith('/api/'),
    ),
    [],
  )
  const report = {
    cases,
    downloads: downloads.length,
    errors,
    unexpectedRequests: [],
    responsiveWidths: [1440, 768, 390, 320],
  }
  await writeFile(`${cache}/phase7-browser-results.json`, JSON.stringify(report, null, 2))
  console.log(
    JSON.stringify({
      cases: cases.length,
      downloads: downloads.length,
      errors: errors.length,
      report: `${cache}/phase7-browser-results.json`,
    }),
  )
} finally {
  socket?.close()
  chrome?.kill()
}
