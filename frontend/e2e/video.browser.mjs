// Local only: real Spring/H2/FFmpeg plus Chrome CDP. No browser test dependency added.
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { spawn, spawnSync } from 'node:child_process'
import { createServer, request as proxyRequest } from 'node:http'
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises'
import { resolve, delimiter, extname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { env, platform } from 'node:process'

const root = resolve(fileURLToPath(new URL('../../', import.meta.url)))
const output = resolve(root, `.cache/phase11.18-browser-${Date.now()}`)
await mkdir(output, { recursive: true })
const ffmpeg = env.VIDEO_REAL_FFMPEG
const ffprobe = env.VIDEO_REAL_FFPROBE
assert.ok(
  ffmpeg && ffprobe && env.JAVA_HOME,
  'Set JAVA_HOME, VIDEO_REAL_FFMPEG and VIDEO_REAL_FFPROBE',
)
const cp = [
  resolve(root, 'backend/target/test-classes'),
  resolve(root, 'backend/target/classes'),
  (await readFile(resolve(root, 'backend/target/video-classpath.txt'), 'utf8')).trim(),
].join(delimiter)
const backend = spawn(
  resolve(env.JAVA_HOME, 'bin', platform === 'win32' ? 'java.exe' : 'java'),
  ['-cp', cp, 'com.xiaoc.backend.support.VideoBrowserApplication'],
  {
    cwd: resolve(root, 'backend'),
    windowsHide: true,
    env: { ...env, WIN_TOOLS_FFMPEG_PATH: ffmpeg, WIN_TOOLS_FFPROBE_PATH: ffprobe },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
)
let backendLog = ''
backend.stdout.on('data', (chunk) => {
  backendLog = (backendLog + chunk).slice(-100000)
})
backend.stderr.on('data', (chunk) => {
  backendLog = (backendLog + chunk).slice(-100000)
})
const pause = (ms) => new Promise((done) => setTimeout(done, ms))
const nginx = await readFile(resolve(root, 'deploy/nginx/win-tools.conf.example'), 'utf8')
const csp = nginx.match(/add_header Content-Security-Policy "([^"]+)" always;/)[1]
const server = createServer(async (req, res) => {
  if (req.url.startsWith('/api/')) {
    const upstream = proxyRequest(
      {
        hostname: '127.0.0.1',
        port: 18081,
        path: req.url,
        method: req.method,
        headers: req.headers,
      },
      (response) => {
        res.writeHead(response.statusCode, response.headers)
        response.pipe(res)
      },
    )
    upstream.on('error', () => res.writeHead(502).end())
    req.pipe(upstream)
    return
  }
  res.setHeader('Content-Security-Policy', csp)
  const pathname = new URL(req.url, 'http://localhost').pathname
  const asset = pathname.startsWith('/assets/') || pathname.startsWith('/images/')
  const file = resolve(root, 'frontend/dist', asset ? `.${pathname}` : 'index.html')
  if (!file.startsWith(resolve(root, 'frontend/dist') + sep)) {
    res.writeHead(403).end()
    return
  }
  try {
    const bytes = await readFile(file)
    res.setHeader(
      'Content-Type',
      { '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.html': 'text/html' }[
        extname(file)
      ] || 'application/octet-stream',
    )
    res.end(bytes)
  } catch {
    res.writeHead(404).end()
  }
})
let chrome, socket
const checks = []
try {
  let catalog
  for (let i = 0; i < 200; i++) {
    try {
      const response = await fetch('http://127.0.0.1:18081/api/tools')
      const body = await response.json()
      if (body.data?.some((tool) => tool.slug === 'video-converter')) {
        catalog = body.data
        break
      }
    } catch {
      /* startup */
    }
    await pause(100)
  }
  assert.ok(catalog, backendLog)
  await new Promise((done) => server.listen(0, '127.0.0.1', done))
  const origin = `http://127.0.0.1:${server.address().port}`
  const profile = resolve(output, 'chrome-profile')
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
  let target
  for (let i = 0; i < 100; i++) {
    try {
      const port = (await readFile(resolve(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]
      target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find(
        (item) => item.type === 'page',
      )
      if (target) break
    } catch {
      /* startup */
    }
    await pause(100)
  }
  assert.ok(target, 'Chrome startup failed')
  socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((done) => socket.addEventListener('open', done, { once: true }))
  const pending = new Map()
  let nextId = 0
  const errors = []
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data)
    if (pending.has(message.id)) {
      pending.get(message.id)(message)
      pending.delete(message.id)
    }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails)
  })
  function cdp(method, params = {}) {
    const id = ++nextId
    return new Promise((done, reject) => {
      const timer = setTimeout(() => reject(new Error(`CDP timeout ${method}`)), 20000)
      pending.set(id, (message) => {
        clearTimeout(timer)
        message.error ? reject(new Error(JSON.stringify(message.error))) : done(message.result)
      })
      socket.send(JSON.stringify({ id, method, params }))
    })
  }
  async function evaluate(expression) {
    const result = await cdp('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
      userGesture: true,
    })
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails))
    return result.result.value
  }
  async function waitFor(expression) {
    for (let i = 0; i < 200; i++) {
      if (await evaluate(expression)) return
      await pause(100)
    }
    throw new Error(`Wait failed: ${expression}`)
  }
  async function navigate(path) {
    await cdp('Page.navigate', { url: origin + path })
    await waitFor(
      `location.pathname === ${JSON.stringify(path.split('?')[0])} && !!document.querySelector('.compact-tool-card')`,
    )
  }
  async function screenshot(name) {
    const { data } = await cdp('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    })
    await writeFile(resolve(output, name + '.png'), Buffer.from(data, 'base64'))
  }
  await cdp('Page.enable')
  await cdp('Runtime.enable')
  await cdp('Page.addScriptToEvaluateOnNewDocument', {
    source: `localStorage.setItem('win-tools:favorites', ${JSON.stringify(JSON.stringify(catalog.map((tool) => tool.slug)))});localStorage.setItem('win-tools:recent', ${JSON.stringify(JSON.stringify(catalog.slice(0, 10).map((tool) => tool.slug)))});`,
  })
  for (const width of [320, 519, 520, 899, 900, 1199, 1200, 1440]) {
    await cdp('Emulation.setDeviceMetricsOverride', {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    })
    for (const path of ['/tools', '/tools?category=fun', '/favorites', '/']) {
      await navigate(path)
      const layout =
        await evaluate(`(() => ({overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        grids: [...document.querySelectorAll('.tool-grid')].map(el => getComputedStyle(el).gridTemplateColumns.split(' ').length),
        heights: [...document.querySelectorAll('.compact-tool-card')].map(el => el.getBoundingClientRect().height),
        nested: document.querySelectorAll('.tool-card-link button').length}))()`)
      assert.equal(layout.overflow, false, `${width} ${path} overflow`)
      assert.ok(
        layout.heights.length > 0 && layout.heights.every((h) => h >= 90 && h <= 110),
        JSON.stringify(layout),
      )
      assert.ok(
        layout.grids.every(
          (cols) => cols === (width >= 1200 ? 4 : width >= 900 ? 3 : width >= 520 ? 2 : 1),
        ),
        JSON.stringify(layout),
      )
      assert.equal(layout.nested, 0)
      checks.push({ width, path, ...layout })
      if ([320, 1440].includes(width) && path === '/tools') {
        if (width === 320) await evaluate(`document.querySelector('.tool-grid').scrollIntoView()`)
        await screenshot(`tools-${width}`)
      }
    }
  }
  await navigate('/tools')
  await evaluate(`document.querySelector('.compact-tool-card button').click()`)
  assert.equal(await evaluate('location.pathname'), '/tools')
  await evaluate(`document.querySelector('.tool-card-link').focus()`)
  await cdp('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Tab',
    code: 'Tab',
    windowsVirtualKeyCode: 9,
  })
  await cdp('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Tab',
    code: 'Tab',
    windowsVirtualKeyCode: 9,
  })
  assert.equal(await evaluate(`document.activeElement.classList.contains('favorite-button')`), true)
  await evaluate(`document.querySelector('.tool-card-link').focus()`)
  await cdp('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Enter',
    code: 'Enter',
    windowsVirtualKeyCode: 13,
  })
  await cdp('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Enter',
    code: 'Enter',
    windowsVirtualKeyCode: 13,
  })
  await waitFor(`location.pathname === '/tools/json'`)
  await navigate('/tools')
  const point = await evaluate(
    `(() => { const a = document.querySelector('a[href="/tools/video-converter"].tool-card-link'); a.scrollIntoView(); const r=a.getBoundingClientRect(); return {x:r.x+10,y:r.bottom-10} })()`,
  )
  await cdp('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    ...point,
    button: 'left',
    clickCount: 1,
  })
  await cdp('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    ...point,
    button: 'left',
    clickCount: 1,
  })
  await waitFor(`!!document.querySelector('#video-file')`)
  const source = resolve(output, '中文 空格 &测试.asf')
  const generated = spawnSync(
    ffmpeg,
    [
      '-y',
      '-v',
      'error',
      '-f',
      'lavfi',
      '-i',
      'color=c=blue:s=320x240:r=10',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440',
      '-t',
      '2',
      '-c:v',
      'wmv2',
      '-c:a',
      'wmav2',
      '-f',
      'asf',
      source,
    ],
    { windowsHide: true },
  )
  assert.equal(generated.status, 0, generated.stderr.toString())
  const doc = await cdp('DOM.getDocument')
  const input = await cdp('DOM.querySelector', { nodeId: doc.root.nodeId, selector: '#video-file' })
  await cdp('DOM.setFileInputFiles', { nodeId: input.nodeId, files: [source] })
  await evaluate(`document.querySelector('.video-actions button').click()`)
  await waitFor(`!!document.querySelector('a[download]')`)
  assert.equal(await evaluate(`document.querySelector('[role="alert"]')?.textContent || ''`), '')
  await screenshot('video-completed-1440')
  await cdp('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: output })
  await evaluate(`document.querySelector('a[download]').click()`)
  for (let i = 0; i < 100 && !(await readdir(output)).includes('converted.mp4'); i++)
    await pause(100)
  const decoded = spawnSync(
    ffprobe,
    [
      '-v',
      'error',
      '-show_entries',
      'stream=codec_name:format=format_name',
      '-of',
      'json',
      resolve(output, 'converted.mp4'),
    ],
    { windowsHide: true },
  )
  assert.equal(decoded.status, 0, decoded.stderr.toString())
  const metadata = JSON.parse(decoded.stdout)
  assert.deepEqual(
    metadata.streams.map((stream) => stream.codec_name),
    ['h264', 'aac'],
  )
  await cdp('Emulation.setDeviceMetricsOverride', {
    width: 320,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  })
  assert.equal(
    await evaluate('document.documentElement.scrollWidth > document.documentElement.clientWidth'),
    false,
  )
  await evaluate(`document.querySelector('.video-actions').scrollIntoView({block: 'center'})`)
  await screenshot('video-completed-320')
  await evaluate(
    `Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('删除转换文件')).click()`,
  )
  await waitFor(`!document.querySelector('a[download]')`)
  assert.deepEqual(errors, [])
  await writeFile(
    resolve(output, 'results.json'),
    JSON.stringify(
      {
        status: 'PASS',
        layouts: checks,
        keyboard: 'Tab + Enter passed',
        cardBlankClick: 'passed',
        favoriteIsolation: 'passed',
        browserAsfDownload: metadata,
        browserErrors: errors,
      },
      null,
      2,
    ),
  )
  console.log(JSON.stringify({ status: 'PASS', layoutChecks: checks.length, output }))
} finally {
  socket?.close()
  chrome?.kill()
  backend.kill()
  server.close()
  await writeFile(resolve(output, 'backend.log'), backendLog)
}
