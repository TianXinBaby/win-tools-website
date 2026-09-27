// Local dist + exact production CSP verification; not an Nginx/TLS substitute.
// Requires a fresh AdminBrowserApplication on 127.0.0.1:8080 (H2 test only).
import { createServer, request } from 'node:http'
import { readFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolve, sep, extname } from 'node:path'
import { env, execPath } from 'node:process'
import assert from 'node:assert/strict'

const dist = fileURLToPath(new URL('../dist/', import.meta.url))
const nginx = await readFile(
  new URL('../../deploy/nginx/win-tools.conf.example', import.meta.url),
  'utf8',
)
const policy = nginx.match(/add_header Content-Security-Policy "([^"]+)" always;/)?.[1]
assert.ok(policy, 'Read CSP directly from the deployment example')
const permissions = nginx.match(/add_header Permissions-Policy "([^"]+)" always;/)?.[1]
assert.ok(
  permissions?.includes('microphone=(self)'),
  'Only the same origin may request a microphone',
)
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
}
// Do not let startup races turn into misleading browser navigation timeouts.
let ready = false
for (let attempt = 0; attempt < 100; attempt++) {
  try {
    const health = await fetch('http://127.0.0.1:8080/api/health')
    if (health.ok) {
      ready = true
      break
    }
  } catch {
    // The isolated fixture may still be starting.
  }
  await new Promise((done) => setTimeout(done, 100))
}
assert.ok(ready, 'Start a fresh isolated AdminBrowserApplication before this test')
const server = createServer(async (req, res) => {
  res.setHeader('Content-Security-Policy', policy)
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Permissions-Policy', permissions)
  if (req.url.startsWith('/api/')) {
    const upstream = request(
      {
        hostname: '127.0.0.1',
        port: 8080,
        path: req.url,
        method: req.method,
        headers: req.headers,
      },
      (response) => {
        res.writeHead(response.statusCode, response.headers)
        response.pipe(res)
      },
    )
    upstream.on('error', () => {
      res.writeHead(502).end()
    })
    req.pipe(upstream)
    return
  }
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
    const file = resolve(dist, `.${pathname}`)
    if (!file.startsWith(resolve(dist) + sep) && file !== resolve(dist)) {
      res.writeHead(403).end()
      return
    }
    let bytes, extension
    try {
      bytes = await readFile(file)
      extension = extname(file)
    } catch {
      if (pathname.startsWith('/assets/')) {
        res.writeHead(404).end()
        return
      }
      bytes = await readFile(resolve(dist, 'index.html'))
      extension = '.html'
    }
    res.setHeader('Content-Type', types[extension] || 'application/octet-stream')
    res.end(bytes)
  } catch {
    res.writeHead(500).end()
  }
})
await new Promise((done) => server.listen(0, '127.0.0.1', done))
const origin = `http://127.0.0.1:${server.address().port}`
try {
  const response = await fetch(`${origin}/admin/login`)
  assert.equal(response.headers.get('content-security-policy'), policy)
  assert.equal(response.status, 200)
  for (const script of ['admin.browser.mjs', 'media.browser.mjs']) {
    await new Promise((done, reject) => {
      const child = spawn(execPath, [fileURLToPath(new URL(script, import.meta.url))], {
        env: { ...env, BASE_URL: origin },
        stdio: 'inherit',
        windowsHide: true,
      })
      child.on('error', reject)
      child.on('exit', (code) =>
        code === 0 ? done() : reject(new Error(`${script} exited with ${code}`)),
      )
    })
  }
  console.log('Production dist CSP: admin CRUD, Element Plus, QR and image tools passed')
} finally {
  server.closeAllConnections()
  await new Promise((done) => server.close(done))
}
