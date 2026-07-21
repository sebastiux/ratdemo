import { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { api, type ExecuteResult } from '@/lib/api'
import {
  Terminal as TerminalIcon,
  LogOut,
  Send,
  Trash2,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronRight,
  Server,
  Play,
  RotateCcw,
  Shield,
  LayoutDashboard
} from 'lucide-react'

interface CommandHistory {
  id: string
  command: string
  result: ExecuteResult | null
  status: 'pending' | 'success' | 'error'
  timestamp: Date
}

const QUICK_COMMANDS = [
  { label: 'echo Hello', cmd: 'echo "Hello from Railway!"' },
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

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/')
    }
  }, [isAuthenticated, navigate])

  useEffect(() => {
    api.health()
      .then(() => setIsConnected(true))
      .catch(() => setIsConnected(false))
  }, [])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [history])

  const executeCommand = useCallback(async (cmd: string) => {
    if (!cmd.trim() || isLoading) return

    const id = Math.random().toString(36).substring(7)
    const newEntry: CommandHistory = {
      id,
      command: cmd,
      result: null,
      status: 'pending',
      timestamp: new Date(),
    }

    setHistory((prev) => [...prev, newEntry])
    setIsLoading(true)
    setCommand('')

    try {
      const result = await api.execute(cmd, currentDir === '~' ? undefined : currentDir)
      setHistory((prev) =>
        prev.map((h) => (h.id === id ? { ...h, result, status: result.success ? 'success' : 'error' } : h))
      )
      if (cmd.trim() === 'pwd' && result.success) {
        setCurrentDir(result.stdout.trim() || '~')
      }
    } catch (err: any) {
      setHistory((prev) =>
        prev.map((h) =>
          h.id === id
            ? {
                ...h,
                result: {
                  success: false,
                  command: cmd,
                  stdout: '',
                  stderr: err.message,
                  exitCode: -1,
                  duration: 0,
                  timestamp: new Date().toISOString(),
                  cwd: currentDir,
                },
                status: 'error',
              }
            : h
        )
      )
    } finally {
      setIsLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isLoading, currentDir])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    executeCommand(command)
  }

  const clearHistory = () => setHistory([])

  const copyOutput = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  if (!isAuthenticated) return null

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
                <p className="text-xs text-slate-500">Remote Terminal</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/dashboard')}
                className="text-slate-400 hover:text-white"
              >
                <LayoutDashboard className="w-4 h-4 mr-2" />
                Dashboard
              </Button>
              <Badge
                variant="outline"
                className={isConnected ? 'border-green-500/30 text-green-400' : 'border-red-500/30 text-red-400'}
              >
                <Server className="w-3 h-3 mr-1" />
                {isConnected ? 'Connected' : 'Disconnected'}
              </Badge>
              <Badge variant="outline" className="border-blue-500/30 text-blue-400">
                <Shield className="w-3 h-3 mr-1" />
                {user?.role}
              </Badge>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-slate-400 hover:text-white">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-slate-400">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              {new Date().toLocaleString()}
            </div>
            <Separator orientation="vertical" className="h-4 bg-slate-700" />
            <div className="font-mono text-slate-300">
              <ChevronRight className="w-3 h-3 inline mr-1 text-cyan-400" />
              {currentDir}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={clearHistory} className="border-slate-700 text-slate-300 hover:text-white">
              <Trash2 className="w-4 h-4 mr-2" />
              Clear
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <Play className="w-4 h-4 text-cyan-400" />
                  Quick Commands
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Click to execute instantly
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {QUICK_COMMANDS.map((qc) => (
                  <Button
                    key={qc.label}
                    variant="ghost"
                    size="sm"
                    onClick={() => executeCommand(qc.cmd)}
                    disabled={isLoading}
                    className="w-full justify-start text-xs text-slate-300 hover:text-white hover:bg-slate-800 font-mono"
                  >
                    <ChevronRight className="w-3 h-3 mr-2 text-cyan-400" />
                    {qc.label}
                  </Button>
                ))}
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  Safety Info
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-xs text-slate-400 space-y-2 list-disc list-inside">
                  <li>Commands run on the server</li>
                  <li>Dangerous patterns are blocked</li>
                  <li>30-second timeout per command</li>
                  <li>Output limited to 1MB</li>
                </ul>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-3 space-y-4">
            <Card className="bg-slate-900 border-slate-800 h-[calc(100vh-280px)] min-h-[400px] flex flex-col">
              <CardHeader className="pb-3 border-b border-slate-800">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white text-sm flex items-center gap-2">
                    <TerminalIcon className="w-4 h-4 text-green-400" />
                    Command Output
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {isLoading && (
                      <Badge variant="outline" className="border-amber-500/30 text-amber-400 text-xs">
                        <RotateCcw className="w-3 h-3 mr-1 animate-spin" />
                        Running...
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
                      <p className="text-sm">No commands executed yet</p>
                      <p className="text-xs">Type a command below or use Quick Commands</p>
                    </div>
                  ) : (
                    <div className="space-y-4 font-mono text-sm">
                      {history.map((entry) => (
                        <div key={entry.id} className="space-y-1">
                          <div className="flex items-start gap-2">
                            <span className="text-cyan-400 shrink-0">$</span>
                            <span className="text-slate-200">{entry.command}</span>
                            <span className="text-xs text-slate-600 ml-auto shrink-0">
                              {entry.timestamp.toLocaleTimeString()}
                            </span>
                          </div>

                          {entry.status === 'pending' ? (
                            <div className="pl-5 text-amber-400 text-xs animate-pulse">Executing...</div>
                          ) : entry.result ? (
                            <div className="space-y-1">
                              {entry.result.warning && (
                                <div className="pl-5 text-amber-400 text-xs flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  {entry.result.warning}
                                </div>
                              )}
                              {entry.result.stdout && (
                                <div className="pl-5 text-green-300 whitespace-pre-wrap bg-slate-950/50 rounded p-2">
                                  {entry.result.stdout}
                                </div>
                              )}
                              {entry.result.stderr && (
                                <div className="pl-5 text-red-300 whitespace-pre-wrap bg-slate-950/50 rounded p-2">
                                  {entry.result.stderr}
                                </div>
                              )}
                              <div className="pl-5 flex items-center gap-3 text-xs text-slate-500">
                                <span className={entry.result.success ? 'text-green-400' : 'text-red-400'}>
                                  {entry.result.success ? (
                                    <span className="flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3" />
                                      exit {entry.result.exitCode}
                                    </span>
                                  ) : (
                                    <span className="flex items-center gap-1">
                                      <AlertTriangle className="w-3 h-3" />
                                      exit {entry.result.exitCode}
                                    </span>
                                  )}
                                </span>
                                <span>{entry.result.duration}ms</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 px-1 text-slate-500 hover:text-white"
                                  onClick={() =>
                                    copyOutput(
                                      `${entry.result?.stdout || ''}\n${entry.result?.stderr || ''}`.trim()
                                    )
                                  }
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
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder="Enter command... (e.g., echo hello, pwd, ls -la)"
                  disabled={isLoading}
                  className="pl-10 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 font-mono"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck="false"
                />
              </div>
              <Button
                type="submit"
                disabled={isLoading || !command.trim()}
                className="bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white px-6"
              >
                {isLoading ? (
                  <RotateCcw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Execute
                  </>
                )}
              </Button>
            </form>
          </div>
        </div>

        <Separator className="bg-slate-800" />

        <footer className="text-center text-xs text-slate-600 pb-4">
          ControlHub v1.0.0  Built for Railway Deployment  |  Remote Terminal Interface
        </footer>
      </main>
    </div>
  )
}
