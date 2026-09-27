// Run against the built frontend with the deployment example's response headers.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { resolve, sep, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { env } from 'node:process'

const root = fileURLToPath(new URL('../../', import.meta.url))
  .replaceAll('\\', '/')
  .replace(/\/$/, '')
const profile = `${root}/.cache/phase11114-browser-profile`
const dist = fileURLToPath(new URL('../dist/', import.meta.url))
const nginx = await readFile(
  new URL('../../deploy/nginx/win-tools.conf.example', import.meta.url),
  'utf8',
)
const csp = nginx.match(/add_header Content-Security-Policy "([^"]+)" always;/)?.[1]
const permissions = nginx.match(/add_header Permissions-Policy "([^"]+)" always;/)?.[1]
assert.ok(csp, 'Deployment CSP must be present')
assert.ok(
  permissions?.includes('microphone=(self)'),
  'Deployment must allow local microphone access',
)
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
}
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const server = createServer(async (request, response) => {
  response.setHeader('Content-Security-Policy', csp)
  response.setHeader('Permissions-Policy', permissions)
  response.setHeader('X-Content-Type-Options', 'nosniff')
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
    const file = resolve(dist, `.${pathname}`)
    if (!file.startsWith(resolve(dist) + sep) && file !== resolve(dist)) {
      response.writeHead(403).end()
      return
    }
    let bytes
    let extension
    try {
      bytes = await readFile(file)
      extension = extname(file)
    } catch {
      if (pathname.startsWith('/assets/')) {
        response.writeHead(404).end()
        return
      }
      bytes = await readFile(resolve(dist, 'index.html'))
      extension = '.html'
    }
    response.setHeader('Content-Type', types[extension] || 'application/octet-stream')
    response.end(bytes)
  } catch {
    response.writeHead(500).end()
  }
})
await new Promise((done) => server.listen(0, '127.0.0.1', done))
const origin = `http://127.0.0.1:${server.address().port}`
let chrome
let socket

await mkdir(profile, { recursive: true })
try {
  chrome = spawn(
    env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    [
      '--headless=new',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      '--remote-debugging-port=0',
      `--user-data-dir=${profile}`,
      'about:blank',
    ],
    { windowsHide: true, stdio: 'ignore' },
  )
  let launchError
  chrome.on('error', (error) => (launchError = error))
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
      // Chrome is starting.
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
  async function open(slug, title) {
    const response = await fetch(`${origin}/tools/${slug}`)
    assert.equal(response.status, 200)
    assert.match(await response.text(), /id="app"/)
    await cdp('Page.navigate', { url: `${origin}/tools/${slug}` })
    await waitFor(`document.querySelector('h1')?.textContent === ${JSON.stringify(title)}`)
    await cdp('Page.reload')
    await pause(200)
    await waitFor(`document.querySelector('h1')?.textContent === ${JSON.stringify(title)}`)
  }
  async function leaveTool() {
    await evaluate(`(() => {
      history.pushState({}, '', '/tools/typing-test');
      dispatchEvent(new PopStateEvent('popstate'));
    })()`)
  }
  await cdp('Page.enable')
  await cdp('Runtime.enable')
  await open('mikutap', 'Mikutap')
  await evaluate(`(() => {
    window.__contexts = [];
    const NativeContext = window.AudioContext;
    window.AudioContext = class extends NativeContext {
      constructor() { super(); window.__contexts.push(this); }
    };
    document.querySelector('.tap-stage').click();
  })()`)
  await waitFor(`document.body.innerText.includes('已创作 1 个音符')`)
  assert.equal(await evaluate('window.__contexts.length'), 1)
  assert.equal(await evaluate('window.__contexts[0].state'), 'running')
  await leaveTool()
  await waitFor(`window.__contexts[0].state === 'closed'`)

  await open('online-piano', '在线钢琴')
  await evaluate(`(() => {
    window.__contexts = [];
    const NativeContext = window.AudioContext;
    window.AudioContext = class extends NativeContext {
      constructor() { super(); window.__contexts.push(this); }
    };
    document.querySelector('.piano-key').click();
  })()`)
  await waitFor(`window.__contexts[0]?.state === 'running'`)
  await leaveTool()
  await waitFor(`window.__contexts[0].state === 'closed'`)

  await open('random-avatar', '随机头像生成器')
  await waitFor(`document.querySelector('.avatar-preview img')?.naturalWidth === 256`)
  const first = await evaluate(`document.querySelector('.avatar-preview img').src`)
  assert.ok(first.startsWith('data:image/svg+xml'))
  await evaluate(`document.querySelector('.tool-actions button').click()`)
  await waitFor(`document.querySelector('.avatar-preview img')?.naturalWidth === 256`)

  await open('voice-ball', '声控弹力球')
  assert.equal(await evaluate(`document.body.innerText.includes('状态：未启动')`), true)
  await evaluate(`(() => {
    window.__streams = [];
    const nativeGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (...args) => {
      const stream = await nativeGetUserMedia(...args);
      window.__streams.push(stream);
      return stream;
    };
    document.querySelector('.tool-actions button').click();
  })()`)
  await waitFor(`document.body.innerText.includes('状态：运行中')`)
  assert.equal(await evaluate(`window.__streams[0].getAudioTracks()[0].readyState`), 'live')
  await leaveTool()
  await waitFor(`window.__streams[0].getAudioTracks()[0].readyState === 'ended'`)
  assert.deepEqual(errors, [])
  console.log(
    'Interactive tools: four direct routes and refreshes, local audio, SVG, microphone cleanup passed',
  )
} finally {
  socket?.close()
  chrome?.kill()
  server.closeAllConnections()
  await new Promise((done) => server.close(done))
}
