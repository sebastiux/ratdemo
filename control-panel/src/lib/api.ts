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
  consent?: string
}

export interface Agent {
  id: string
  hostname: string
  platform: string
  user: string
  ip: string
  registeredAt: string
  lastSeen: number
  status: string
}

export interface AgentResult {
  command: string
  success: boolean
  stdout: string
  stderr: string
  exitCode: number
  duration: number
  consent: string
  timestamp: string
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

  async execute(command: string, cwd?: string): Promise<ExecuteResult> {
    return this.fetchJson('/api/execute', {
      method: 'POST',
      body: JSON.stringify({ command, cwd }),
    })
  }

  // ─── Agent Relay ─────────────────────────────────────────────

  async getAgents(): Promise<{ agents: Agent[]; count: number }> {
    return this.fetchJson('/api/admin/agents')
  }

  async sendToAgent(agentId: string, command: string) {
    return this.fetchJson(`/api/admin/send/${agentId}`, {
      method: 'POST',
      body: JSON.stringify({ command }),
    })
  }

  async getAgentResults(agentId: string): Promise<{ agentId: string; results: AgentResult[] }> {
    return this.fetchJson(`/api/admin/results/${agentId}`)
  }

  async rickrollAgent(agentId: string) {
    return this.fetchJson(`/api/admin/rickroll/${agentId}`, {
      method: 'POST',
    })
  }
}

export const api = new ApiService()
