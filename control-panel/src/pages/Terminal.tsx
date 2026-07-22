import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { api, type ExecuteResult, type Agent, type AgentResult } from '@/lib/api'
import {
  Terminal as TerminalIcon,
  LogOut,
  Send,
  Trash2,
  Copy,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Server,
  Play,
  RotateCcw,
  Shield,
  LayoutDashboard,
  Monitor,
  Users,
  Laptop,
  Wifi,
  WifiOff,
  Zap,
  Music
} from 'lucide-react'

interface CommandHistory {
  id: string
  command: string
  result: ExecuteResult | null
  status: 'pending' | 'success' | 'error'
  mode: 'local' | 'agent'
  agentId?: string
  consent?: string
  timestamp: Date
}

const QUICK_COMMANDS = [
  { label: 'echo Hello', cmd: 'echo "Hello from Agent!"' },
  { label: 'pwd', cmd: 'pwd' },
  { label: 'ls -la', cmd: 'ls -la' },
  { label: 'whoami', cmd: 'whoami' },
  { label: 'date', cmd: 'date' },
  { label: 'uptime', cmd: 'uptime' },
  { label: 'uname -a', cmd: 'uname -a' },
  { label: 'env', cmd: 'env' },
]

export default function TerminalPage() {
  const { user, isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()
  const [command, setCommand] = useState('')
  const [history, setHistory] = useState<CommandHistory[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [currentDir, setCurrentDir] = useState('~')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [agentResults, setAgentResults] = useState<Record<string, AgentResult[]>>({})
  const [mode, setMode] = useState<'local' | 'agent'>('local')

  useEffect(() => {
    if (!isAuthenticated) navigate('/')
  }, [isAuthenticated, navigate])

  useEffect(() => {
    api.health()
      .then(() => setIsConnected(true))
      .catch(() => setIsConnected(false))
  }, [])

  useEffect(() => {
    const pollAgents = async () => {
      try {
        const data = await api.getAgents()
        setAgents(data.agents)
      } catch {
        // silent
      }
    }
    pollAgents()
    const interval = setInterval(pollAgents, 3000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!selectedAgent || mode !== 'agent') return
    const pollResults = async () => {
      try {
        const data = await api.getAgentResults(selectedAgent)
        setAgentResults(prev => ({ ...prev, [selectedAgent]: data.results }))
      } catch {
        // silent
      }
    }
    pollResults()
    const interval = setInterval(pollResults, 3000)
    return () => clearInterval(interval)
  }, [selectedAgent, mode])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [history])

  const executeLocal = useCallback(async (cmd: string) => {
    if (!cmd.trim() || isLoading) return
    const id = Math.random().toString(36).substring(7)
    setHistory(prev => [...prev, {
      id, command: cmd, result: null, status: 'pending' as const, mode: 'local' as const, timestamp: new Date(),
    }])
    setIsLoading(true)
    setCommand('')

    try {
      const result = await api.execute(cmd, currentDir === '~' ? undefined : currentDir)
      setHistory(prev => prev.map(h => h.id === id ? { ...h, result, status: result.success ? 'success' as const : 'error' as const } : h))
      if (cmd.trim() === 'pwd' && result.success) setCurrentDir(result.stdout.trim() || '~')
    } catch (err: any) {
      setHistory(prev => prev.map(h => h.id === id ? {
        ...h, result: { success: false, command: cmd, stdout: '', stderr: err.message, exitCode: -1, duration: 0, timestamp: new Date().toISOString(), cwd: currentDir },
        status: 'error' as const,
      } : h))
    } finally {
      setIsLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isLoading, currentDir])

  const sendToAgent = useCallback(async (cmd: string) => {
    if (!cmd.trim() || isLoading || !selectedAgent) return
    const id = Math.random().toString(36).substring(7)
    setHistory(prev => [...prev, {
      id, command: cmd, result: null, status: 'pending' as const, mode: 'agent' as const, agentId: selectedAgent,
      consent: 'waiting', timestamp: new Date(),
    }])
    setIsLoading(true)
    setCommand('')

    try {
      await api.sendToAgent(selectedAgent, cmd)
      setHistory(prev => prev.map(h => h.id === id ? {
        ...h,
        result: {
          success: true, command: cmd, stdout: `Command sent to agent ${selectedAgent}. Waiting for user consent...`,
          stderr: '', exitCode: 0, duration: 0, timestamp: new Date().toISOString(), cwd: '~',
        },
        status: 'success' as const,
      } : h))
    } catch (err: any) {
      setHistory(prev => prev.map(h => h.id === id ? {
        ...h, result: { success: false, command: cmd, stdout: '', stderr: err.message, exitCode: -1, duration: 0, timestamp: new Date().toISOString(), cwd: '~' },
        status: 'error' as const,
      } : h))
    } finally {
      setIsLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isLoading, selectedAgent])

  useEffect(() => {
    if (!selectedAgent) return
    const results = agentResults[selectedAgent] || []
    if (results.length === 0) return

    setHistory(prev => {
      let changed = false
      const updated = prev.map(h => {
        if (h.mode !== 'agent' || h.agentId !== selectedAgent || h.status !== 'pending') return h
        const match = [...results].reverse().find(r => r.command === h.command && new Date(r.timestamp) >= h.timestamp)
        if (match) {
          changed = true
          return {
            ...h,
            result: {
              success: match.success,
              command: match.command,
              stdout: match.stdout,
              stderr: match.stderr,
              exitCode: match.exitCode,
              duration: match.duration,
              timestamp: match.timestamp,
              cwd: '~',
            },
            status: match.success ? 'success' as const : 'error' as const,
            consent: match.consent,
          }
        }
        return h
      })
      return changed ? updated : prev
    })
  }, [agentResults, selectedAgent])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (mode === 'local') executeLocal(command)
    else sendToAgent(command)
  }

  const clearHistory = () => setHistory([])
  const copyOutput = (text: string) => navigator.clipboard.writeText(text)
  const handleLogout = () => { logout(); navigate('/') }

  const handleRickroll = useCallback(async () => {
    if (!selectedAgent) return
    try {
      await api.rickrollAgent(selectedAgent)
      setHistory(prev => [...prev, {
        id: Math.random().toString(36).substring(7),
        command: 'Rick Roll',
        result: {
          success: true, command: 'open https://youtu.be/dQw4w9WgXcQ',
          stdout: 'Rick Roll command sent! Waiting for user consent...',
          stderr: '', exitCode: 0, duration: 0, timestamp: new Date().toISOString(), cwd: '~',
        },
        status: 'success' as const, mode: 'agent' as const, agentId: selectedAgent,
        consent: 'waiting', timestamp: new Date(),
      }])
    } catch (err: any) {
      setHistory(prev => [...prev, {
        id: Math.random().toString(36).substring(7),
        command: 'Rick Roll',
        result: {
          success: false, command: 'open https://youtu.be/dQw4w9WgXcQ',
          stdout: '', stderr: err.message, exitCode: -1, duration: 0, timestamp: new Date().toISOString(), cwd: '~',
        },
        status: 'error' as const, mode: 'agent' as const, agentId: selectedAgent,
        timestamp: new Date(),
      }])
    }
  }, [selectedAgent])

  if (!isAuthenticated) return null

  const onlineAgents = agents.filter(a => a.status === 'online')
  const selectedAgentInfo = agents.find(a => a.id === selectedAgent)

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
                <TerminalIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">ControlHub</h1>
                <p className="text-xs text-slate-500">Remote Terminal with Consent</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')} className="text-slate-400 hover:text-white">
                <LayoutDashboard className="w-4 h-4 mr-2" /> Dashboard
              </Button>
              <Badge variant="outline" className={isConnected ? 'border-green-500/30 text-green-400' : 'border-red-500/30 text-red-400'}>
                <Server className="w-3 h-3 mr-1" />
                {isConnected ? 'Connected' : 'Disconnected'}
              </Badge>
              <Badge variant="outline" className="border-blue-500/30 text-blue-400">
                <Shield className="w-3 h-3 mr-1" /> {user?.role}
              </Badge>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-slate-400 hover:text-white">
                <LogOut className="w-4 h-4 mr-2" /> Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button
            variant={mode === 'local' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('local')}
            className={mode === 'local' ? 'bg-blue-500 hover:bg-blue-600' : 'border-slate-700 text-slate-400'}
          >
            <Zap className="w-4 h-4 mr-2" /> Local Server
          </Button>
          <Button
            variant={mode === 'agent' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('agent')}
            className={mode === 'agent' ? 'bg-emerald-500 hover:bg-emerald-600' : 'border-slate-700 text-slate-400'}
          >
            <Monitor className="w-4 h-4 mr-2" /> Agent Relay
          </Button>
          {mode === 'agent' && (
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 ml-2">
              <Users className="w-3 h-3 mr-1" />
              {onlineAgents.length} agent{onlineAgents.length !== 1 ? 's' : ''} online
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <Play className="w-4 h-4 text-cyan-400" /> Quick Commands
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {QUICK_COMMANDS.map(qc => (
                  <Button key={qc.label} variant="ghost" size="sm"
                    onClick={() => setCommand(qc.cmd)}
                    className="w-full justify-start text-xs text-slate-300 hover:text-white hover:bg-slate-800 font-mono"
                  >
                    <ChevronRight className="w-3 h-3 mr-2 text-cyan-400" />{qc.label}
                  </Button>
                ))}
              </CardContent>
            </Card>

            {mode === 'agent' && (
              <Card className="bg-slate-900 border-slate-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white text-sm flex items-center gap-2">
                    <Laptop className="w-4 h-4 text-emerald-400" /> Connected Agents
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {agents.length === 0 && (
                    <p className="text-xs text-slate-500">No agents connected. Run <code>python agent.py --server &lt;url&gt;</code> on a target computer.</p>
                  )}
                  {agents.map(agent => (
                    <button
                      key={agent.id}
                      onClick={() => setSelectedAgent(agent.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        selectedAgent === agent.id
                          ? 'bg-emerald-500/10 border-emerald-500/30'
                          : 'bg-slate-800/50 border-slate-700/50 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {agent.status === 'online' ? (
                          <Wifi className="w-3 h-3 text-green-400" />
                        ) : (
                          <WifiOff className="w-3 h-3 text-slate-500" />
                        )}
                        <span className="text-xs font-mono text-white">{agent.hostname}</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">
                        {agent.platform} · {agent.user} · {agent.id}
                      </div>
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  {mode === 'agent' ? 'Consent Required' : 'Safety Info'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {mode === 'agent' ? (
                  <ul className="text-xs text-slate-400 space-y-2 list-disc list-inside">
                    <li>Commands are sent to the remote agent</li>
                    <li>A pop-up asks the user for consent</li>
                    <li>Auto-denied if no response in 60s</li>
                    <li>Results appear here once executed</li>
                  </ul>
                ) : (
                  <ul className="text-xs text-slate-400 space-y-2 list-disc list-inside">
                    <li>Commands run on the server</li>
                    <li>Dangerous patterns are blocked</li>
                    <li>30-second timeout per command</li>
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-3 space-y-4">
            {mode === 'agent' && selectedAgentInfo && (
              <Card className="bg-gradient-to-r from-emerald-900/40 to-slate-900 border-emerald-700/30">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                      <Monitor className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{selectedAgentInfo.hostname}</p>
                      <p className="text-xs text-slate-400">{selectedAgentInfo.platform} · {selectedAgentInfo.user}</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRickroll}
                    className="border-pink-500/30 text-pink-400 hover:bg-pink-500/10 hover:text-pink-300"
                  >
                    <Music className="w-3 h-3 mr-1" /> Rick Roll
                  </Button>
                  <Badge variant="outline" className="border-emerald-500/30 text-emerald-400">
                    <Wifi className="w-3 h-3 mr-1" /> Selected
                  </Badge>
                </CardContent>
              </Card>
            )}

            <Card className="bg-slate-900 border-slate-800 h-[calc(100vh-380px)] min-h-[350px] flex flex-col">
              <CardHeader className="pb-3 border-b border-slate-800">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white text-sm flex items-center gap-2">
                    <TerminalIcon className="w-4 h-4 text-green-400" />
                    {mode === 'agent' ? 'Agent Command Output' : 'Local Command Output'}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {isLoading && (
                      <Badge variant="outline" className="border-amber-500/30 text-amber-400 text-xs">
                        <RotateCcw className="w-3 h-3 mr-1 animate-spin" /> Running...
                      </Badge>
                    )}
                    <span className="text-xs text-slate-500">{history.length} commands</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 p-0 overflow-hidden">
                <div className="h-full overflow-y-auto p-4" ref={scrollRef}>
                  {history.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-3">
                      <TerminalIcon className="w-12 h-12 opacity-20" />
                      <p className="text-sm">{mode === 'agent' ? 'Send a command to an agent' : 'No commands executed yet'}</p>
                      <p className="text-xs">{mode === 'agent' ? 'Select an agent, type a command, and click Send' : 'Type a command below or use Quick Commands'}</p>
                    </div>
                  ) : (
                    <div className="space-y-4 font-mono text-sm">
                      {history.map(entry => (
                        <div key={entry.id} className="space-y-1">
                          <div className="flex items-start gap-2">
                            <span className="text-cyan-400 shrink-0">$</span>
                            <span className="text-slate-200">{entry.command}</span>
                            {entry.mode === 'agent' && (
                              <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400 ml-2">
                                <Monitor className="w-2 h-2 mr-1" />{entry.agentId}
                              </Badge>
                            )}
                            <span className="text-xs text-slate-600 ml-auto shrink-0">{entry.timestamp.toLocaleTimeString()}</span>
                          </div>

                          {entry.status === 'pending' ? (
                            <div className="pl-5 text-amber-400 text-xs animate-pulse">
                              {entry.mode === 'agent' ? 'Waiting for user consent...' : 'Executing...'}
                            </div>
                          ) : entry.result ? (
                            <div className="space-y-1">
                              {entry.result.stdout && (
                                <div className="pl-5 text-green-300 whitespace-pre-wrap bg-slate-950/50 rounded p-2">{entry.result.stdout}</div>
                              )}
                              {entry.result.stderr && (
                                <div className="pl-5 text-red-300 whitespace-pre-wrap bg-slate-950/50 rounded p-2">{entry.result.stderr}</div>
                              )}
                              <div className="pl-5 flex items-center gap-3 text-xs text-slate-500">
                                <span className={entry.result.success ? 'text-green-400' : 'text-red-400'}>
                                  {entry.result.success ? (
                                    <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> exit {entry.result.exitCode}</span>
                                  ) : (
                                    <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> exit {entry.result.exitCode}</span>
                                  )}
                                </span>
                                <span>{entry.result.duration}ms</span>
                                {entry.consent && (
                                  <Badge variant="outline" className={`text-[10px] ${
                                    entry.consent === 'approved' ? 'border-green-500/30 text-green-400' :
                                    entry.consent === 'denied' ? 'border-red-500/30 text-red-400' :
                                    'border-amber-500/30 text-amber-400'
                                  }`}>
                                    consent: {entry.consent}
                                  </Badge>
                                )}
                                <Button variant="ghost" size="sm"
                                  className="h-5 px-1 text-slate-500 hover:text-white"
                                  onClick={() => copyOutput(`${entry.result?.stdout || ''}\n${entry.result?.stderr || ''}`.trim())}
                                >
                                  <Copy className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <form onSubmit={handleSubmit} className="flex items-center gap-3">
              <div className="flex-1 relative">
                <ChevronRight className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400" />
                <Input
                  ref={inputRef}
                  value={command}
                  onChange={e => setCommand(e.target.value)}
                  placeholder={mode === 'agent'
                    ? (selectedAgent ? `Send command to ${selectedAgentInfo?.hostname}...` : 'Select an agent first...')
                    : 'Enter command... (e.g., echo hello, pwd, ls -la)'
                  }
                  disabled={isLoading || (mode === 'agent' && !selectedAgent)}
                  className="pl-10 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 font-mono"
                  autoComplete="off" autoCorrect="off" spellCheck="false"
                />
              </div>
              <Button type="submit"
                disabled={isLoading || !command.trim() || (mode === 'agent' && !selectedAgent)}
                className={mode === 'agent'
                  ? 'bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white px-6'
                  : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white px-6'
                }
              >
                {isLoading ? <RotateCcw className="w-4 h-4 animate-spin" /> : (
                  <><Send className="w-4 h-4 mr-2" />{mode === 'agent' ? 'Send to Agent' : 'Execute'}</>
                )}
              </Button>
              <Button variant="outline" size="sm" onClick={clearHistory} className="border-slate-700 text-slate-300 hover:text-white">
                <Trash2 className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </div>

        <Separator className="bg-slate-800" />
        <footer className="text-center text-xs text-slate-600 pb-4">
          ControlHub v1.1.0 · Agent Relay with Consent · Built for Railway Deployment
        </footer>
      </main>
    </div>
  )
}
