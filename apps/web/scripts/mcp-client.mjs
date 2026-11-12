/**
 * Minimal MCP stdio client for awwwards-mcp.
 *
 * The server speaks JSON-RPC over stdio, so we can drive it directly from a
 * script instead of needing a full MCP host.
 *
 * Usage:
 *   node scripts/mcp-client.mjs list
 *   node scripts/mcp-client.mjs call <toolName> '<jsonArgs>'
 */
import { spawn } from 'node:child_process'

// Resolve a global npm bin to its absolute path. Scoped packages contain an
// "@" which the Windows shell treats as a special character, so we always
// spawn the resolved .cmd file directly.
function resolveServer(cmd) {
  if (cmd.includes('/') || cmd.includes('\\')) return cmd
  const isWindows = process.platform === 'win32'
  const root = isWindows
    ? process.env.APPDATA + '\\npm'
    : '/usr/local/bin'
  const exe = isWindows ? '.cmd' : ''
  return root + '\\' + cmd + exe
}

const SERVER = resolveServer(process.env.AWWWARDS_CMD || 'awwwards-mcp')

export function createClient() {
  // On Windows the global bin is a .cmd shim, which Node cannot exec directly.
  const isWindows = process.platform === 'win32'
  const child = spawn(SERVER, [], {
    stdio: ['pipe', 'pipe', 'pipe'],
    shell: isWindows,
    windowsHide: true,
    env: { ...process.env, AWWWARDS_AUTO_UPDATE: '0' },
  })

  let nextId = 1
  const pending = new Map()
  let buffer = ''

  child.stdout.on('data', (chunk) => {
    buffer += chunk.toString()
    let index
    while ((index = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, index).trim()
      buffer = buffer.slice(index + 1)
      if (!line) continue
      let msg
      try {
        msg = JSON.parse(line)
      } catch {
        continue
      }
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id)
        pending.delete(msg.id)
        if (msg.error) reject(new Error(JSON.stringify(msg.error)))
        else resolve(msg.result)
      }
    }
  })

  let stderr = ''
  child.stderr.on('data', (c) => {
    stderr += c.toString()
  })

  function send(method, params) {
    const id = nextId++
    const payload = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'
    child.stdin.write(payload)
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject })
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id)
          reject(new Error('timeout waiting for ' + method + '\n' + stderr.slice(-800)))
        }
      }, 180000)
    })
  }

  function notify(method, params) {
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n')
  }

  async function initialize() {
    await send('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'urownmenu-build', version: '1.0.0' },
    })
    notify('notifications/initialized', {})
  }

  async function listTools() {
    const res = await send('tools/list', {})
    return res.tools || []
  }

  async function callTool(name, args) {
    return send('tools/call', { name, arguments: args || {} })
  }

  function close() {
    try { child.stdin.end() } catch {}
    try { child.kill() } catch {}
  }

  return { initialize, listTools, callTool, close, stderr: () => stderr }
}

async function main() {
  const [mode, a, b] = process.argv.slice(2)
  const client = createClient()
  try {
    await client.initialize()
    if (mode === 'list') {
      const tools = await client.listTools()
      const names = tools.map((t) => t.name)
      console.log('TOOLS (' + names.length + '):')
      console.log(names.join('\n'))
      if (a) {
        const t = tools.find((x) => x.name === a)
        console.log('\nSCHEMA for ' + a + ':')
        console.log(JSON.stringify(t && t.inputSchema, null, 2))
      }
    } else if (mode === 'call') {
      const res = await client.callTool(a, b ? JSON.parse(b) : {})
      const text = (res.content || [])
        .map((c) => (c.type === 'text' ? c.text : ''))
        .filter(Boolean)
        .join('\n')
      console.log(text || JSON.stringify(res, null, 2))
    }
  } finally {
    client.close()
  }
}

if (import.meta.url === 'file://' + process.argv[1].replace(/\\/g, '/')) {
  main().catch((e) => {
    console.error('ERROR:', e.message)
    process.exit(1)
  })
}
