// Test fixture only: run against AdminBrowserApplication (isolated H2) and Vite.
import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { Buffer } from 'node:buffer'
import { env } from 'node:process'
import assert from 'node:assert/strict'

const cache = fileURLToPath(new URL('../../.cache/', import.meta.url))
const profile = `${cache}/phase8-browser-${Date.now()}`
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const cases = [],
  errors = []
let chrome, socket
await mkdir(profile, { recursive: true })
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
  let launchError, target
  chrome.on('error', (error) => {
    launchError = error
  })
  for (let i = 0; i < 100; i++) {
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
  let nextId = 0
  const pending = new Map()
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data)
    if (pending.has(message.id)) {
      pending.get(message.id)(message)
      pending.delete(message.id)
    }
    if (message.method === 'Runtime.exceptionThrown') errors.push('Uncaught browser exception')
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
        message.error ? reject(new Error(`CDP failed: ${method}`)) : resolve(message.result)
      })
      socket.send(JSON.stringify({ id, method, params }))
    })
  }
  async function evaluate(expression) {
    const result = await cdp('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    })
    assert.ok(!result.exceptionDetails, 'Browser evaluation failed')
    return result.result.value
  }
  async function waitFor(expression) {
    for (let i = 0; i < 160; i++) {
      if (await evaluate(expression)) return
      await pause(75)
    }
    throw new Error('Browser condition timed out')
  }
  async function open(path) {
    await cdp('Page.navigate', { url: `http://localhost:5173${path}` })
  }
  async function fill(id, value) {
    await evaluate(
      `(() => { const input = document.getElementById(${JSON.stringify(id)}); input.value = ${JSON.stringify(value)}; input.dispatchEvent(new Event('input', {bubbles:true})); })()`,
    )
  }
  async function submit(password) {
    await fill('admin-username', 'browser-test-admin')
    await fill('admin-password', password)
    await evaluate(`document.querySelector('form').requestSubmit()`)
  }
  async function screenshot(label, width) {
    await cdp('Emulation.setDeviceMetricsOverride', {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    })
    await pause(100)
    assert.equal(
      await evaluate('document.documentElement.scrollWidth <= innerWidth'),
      true,
      `${label}: no horizontal overflow`,
    )
    const shot = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
    await writeFile(`${cache}/phase8-${label}-${width}.png`, Buffer.from(shot.data, 'base64'))
  }
  await cdp('Runtime.enable')
  await cdp('Network.enable')
  await open('/admin')
  await waitFor(
    `location.pathname === '/admin/login' && !!document.querySelector('#admin-password')`,
  )
  cases.push('anonymous admin redirects to login')
  for (const width of [1440, 768, 390, 320]) await screenshot('login', width)
  await submit('incorrect-test-password')
  await waitFor(
    `document.querySelector('[role="alert"]')?.textContent.includes('用户名或密码错误')`,
  )
  cases.push('invalid credentials show generic error')
  await submit(' browser-test-only passphrase ')
  await waitFor(
    `location.pathname === '/admin' && document.body.innerText.includes('欢迎，浏览器测试管理员')`,
  )
  cases.push('login through Vite proxy with CSRF and HTTP session')
  const cookies = (await cdp('Network.getCookies')).cookies
  // Inspect only metadata, never persist or print cookie values.
  const sessionCookie = cookies.find((cookie) => cookie.name === 'JSESSIONID')
  assert.ok(sessionCookie && sessionCookie.httpOnly && sessionCookie.sameSite === 'Lax')
  assert.equal(sessionCookie.secure, false)
  cases.push('HttpOnly SameSite=Lax development cookie')
  for (const width of [1440, 768, 390, 320]) await screenshot('dashboard', width)
  await cdp('Page.reload')
  await waitFor(
    `location.pathname === '/admin' && document.body.innerText.includes('欢迎，浏览器测试管理员')`,
  )
  cases.push('refresh restores session using me')
  await open('/admin/login')
  await waitFor(
    `location.pathname === '/admin' && document.body.innerText.includes('欢迎，浏览器测试管理员')`,
  )
  cases.push('authenticated login page redirects to dashboard')
  assert.deepEqual(await evaluate('[localStorage.length, sessionStorage.length]'), [0, 0])
  cases.push('no persistent browser authentication storage')
  await evaluate(`document.querySelector('button').click()`)
  await waitFor(
    `location.pathname === '/admin/login' && !!document.querySelector('#admin-password')`,
  )
  assert.equal(await evaluate(`(async () => (await fetch('/api/admin/auth/me')).status)()`), 401)
  cases.push('logout invalidates backend session')
  await open('/admin')
  await waitFor(
    `location.pathname === '/admin/login' && !!document.querySelector('#admin-password')`,
  )
  cases.push('admin after logout requires login again')
  await submit(' browser-test-only passphrase ')
  await waitFor(
    `location.pathname === '/admin' && document.body.innerText.includes('欢迎，浏览器测试管理员')`,
  )
  // Simulate expiry by removing the browser cookie; the next protected API reports 401.
  await cdp('Network.clearBrowserCookies')
  await evaluate(
    `(async () => { const api = await import('/src/api/adminAuth.js'); try { await api.getCurrentAdmin() } catch { /* expected 401 */ } })()`,
  )
  await waitFor(
    `location.pathname === '/admin/login' && document.body.innerText.includes('登录状态已失效')`,
  )
  cases.push('expired session clears UI and redirects once')
  const statuses = await evaluate(
    `(async () => { const result = []; for (const path of ['/api/hello','/api/windows','/api/tools','/api/articles','/api/missing']) result.push((await fetch(path)).status); return result })()`,
  )
  assert.deepEqual(statuses, [200, 200, 200, 200, 404])
  cases.push('public APIs and 404 remain anonymous')
  assert.deepEqual(errors, [])
  await writeFile(
    `${cache}/phase8-browser-results.json`,
    JSON.stringify(
      { cases, errors, database: 'H2 test only', responsiveWidths: [1440, 768, 390, 320] },
      null,
      2,
    ),
  )
  console.log(
    JSON.stringify({ cases: cases.length, errors: errors.length, database: 'H2 test only' }),
  )
} finally {
  socket?.close()
  chrome?.kill()
}
