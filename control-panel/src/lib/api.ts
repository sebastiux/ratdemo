const API_BASE = import.meta.env.VITE_API_URL || ''

export interface ExecuteResult {
  success: boolean
  command: string
  stdout: string
  stderr: string
  exitCode: number
  duration: number
  error?: string
  warning?: string | null
  timestamp: string
  cwd: string
}

export interface SystemInfo {
  cpu: {
    model: string
    cores: number
    loadAvg: number[]
  }
  memory: {
    total: number
    used: number
    free: number
    percentage: number
  }
  os: {
    platform: string
    release: string
    hostname: string
    uptime: number
  }
  network: Array<{
    name: string
    addresses: Array<{
      address: string
      family: string
      internal: boolean
    }>
  }>
}

export interface Session {
  id: string
  target: string
  ip: string
  port: number
  os: string
  user: string
  connectedAt: string
  status: string
}

class ApiService {
  private baseUrl: string

  constructor() {
    this.baseUrl = API_BASE
  }

  private async fetchJson(path: string, options?: RequestInit) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }))
      throw new Error(err.error || `HTTP ${res.status}`)
    }
    return res.json()
  }

  async health() {
    return this.fetchJson('/api/health')
  }

  async getSystemInfo(): Promise<SystemInfo> {
    return this.fetchJson('/api/system')
  }

  async execute(command: string, cwd?: string): Promise<ExecuteResult> {
    return this.fetchJson('/api/execute', {
      method: 'POST',
      body: JSON.stringify({ command, cwd }),
    })
  }

  async executeBatch(commands: string[], cwd?: string) {
    return this.fetchJson('/api/execute/batch', {
      method: 'POST',
      body: JSON.stringify({ commands, cwd }),
    })
  }

  async getSessions(): Promise<{ sessions: Session[]; listening: boolean; listenPort: number }> {
    return this.fetchJson('/api/sessions')
  }

  async listFiles(targetPath?: string) {
    return this.fetchJson('/api/files/list', {
      method: 'POST',
      body: JSON.stringify({ path: targetPath }),
    })
  }
}

export const api = new ApiService()
