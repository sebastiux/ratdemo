import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  LayoutDashboard,
  LogOut,
  Activity,
  Server,
  Database,
  Wifi,
  Cpu,
  HardDrive,
  Power,
  RefreshCw,
  Shield,
  Users,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Terminal
} from 'lucide-react'

interface SystemMetric {
  label: string
  value: number
  max: number
  unit: string
  icon: React.ReactNode
  status: 'normal' | 'warning' | 'critical'
}

interface ServiceControl {
  id: string
  name: string
  description: string
  enabled: boolean
  status: 'running' | 'stopped' | 'error'
  uptime: string
}

export default function Dashboard() {
  const { user, isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [cpuLoad, setCpuLoad] = useState([42])
  const [memoryLoad, setMemoryLoad] = useState([68])

  const [services, setServices] = useState<ServiceControl[]>([
    { id: '1', name: 'API Gateway', description: 'Main REST API endpoint', enabled: true, status: 'running', uptime: '14d 3h 22m' },
    { id: '2', name: 'WebSocket Server', description: 'Real-time communication', enabled: true, status: 'running', uptime: '14d 3h 20m' },
    { id: '3', name: 'Worker Queue', description: 'Background job processor', enabled: true, status: 'running', uptime: '12d 8h 45m' },
    { id: '4', name: 'Analytics Engine', description: 'Data processing & reports', enabled: false, status: 'stopped', uptime: '—' },
    { id: '5', name: 'Backup Service', description: 'Automated daily backups', enabled: true, status: 'running', uptime: '3d 1h 15m' },
    { id: '6', name: 'Email Relay', description: 'SMTP notification service', enabled: true, status: 'running', uptime: '14d 3h 22m' },
  ])

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/')
    }
  }, [isAuthenticated, navigate])

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setCpuLoad([Math.floor(30 + Math.random() * 50)])
      setMemoryLoad([Math.floor(50 + Math.random() * 35)])
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  const toggleService = (id: string) => {
    setServices(prev => prev.map(s => {
      if (s.id === id) {
        const newEnabled = !s.enabled
        return {
          ...s,
          enabled: newEnabled,
          status: newEnabled ? 'running' : 'stopped' as const,
          uptime: newEnabled ? '0d 0h 1m' : '—'
        }
      }
      return s
    }))
  }

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const metrics: SystemMetric[] = [
    { label: 'CPU Usage', value: cpuLoad[0], max: 100, unit: '%', icon: <Cpu className="w-5 h-5" />, status: cpuLoad[0] > 80 ? 'critical' : cpuLoad[0] > 60 ? 'warning' : 'normal' },
    { label: 'Memory', value: memoryLoad[0], max: 100, unit: '%', icon: <HardDrive className="w-5 h-5" />, status: memoryLoad[0] > 85 ? 'critical' : memoryLoad[0] > 70 ? 'warning' : 'normal' },
    { label: 'Network I/O', value: 234, max: 1000, unit: 'MB/s', icon: <Wifi className="w-5 h-5" />, status: 'normal' },
    { label: 'Disk Usage', value: 67, max: 100, unit: '%', icon: <Database className="w-5 h-5" />, status: 'warning' },
  ]

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-green-500'
      case 'stopped': return 'bg-slate-500'
      case 'error': return 'bg-red-500'
      case 'normal': return 'text-green-400'
      case 'warning': return 'text-amber-400'
      case 'critical': return 'text-red-400'
      default: return 'bg-slate-500'
    }
  }

  const runningServices = services.filter(s => s.status === 'running').length
  const totalServices = services.length

  if (!isAuthenticated) return null

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Top Navigation */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
                <LayoutDashboard className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">ControlHub</h1>
                <p className="text-xs text-slate-500">Management Console</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-2 text-sm text-slate-400">
                <Clock className="w-4 h-4" />
                {currentTime.toLocaleString()}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/terminal')}
                className="text-slate-400 hover:text-white"
              >
                <Terminal className="w-4 h-4 mr-2" />
                Terminal
              </Button>
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Terminal CTA Banner */}
        <Card className="bg-gradient-to-r from-slate-900 to-slate-800 border-slate-700">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-emerald-400 flex items-center justify-center">
                <Terminal className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Remote Terminal</h2>
                <p className="text-sm text-slate-400">Execute commands on the Railway-hosted server in real-time</p>
              </div>
            </div>
            <Button
              onClick={() => navigate('/terminal')}
              className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white px-6"
            >
              <Terminal className="w-4 h-4 mr-2" />
              Open Terminal
            </Button>
          </CardContent>
        </Card>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Active Services</p>
                  <p className="text-2xl font-bold text-white mt-1">{runningServices}/{totalServices}</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Server Uptime</p>
                  <p className="text-2xl font-bold text-white mt-1">14d 3h</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Server className="w-5 h-5 text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Active Users</p>
                  <p className="text-2xl font-bold text-white mt-1">1,247</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Alerts</p>
                  <p className="text-2xl font-bold text-white mt-1">2</p>
                </div>
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* System Metrics */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-400" />
              System Metrics
            </CardTitle>
            <CardDescription className="text-slate-500">Real-time resource utilization</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {metrics.map((metric) => (
                <div key={metric.label} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-300">
                      {metric.icon}
                      <span className="font-medium">{metric.label}</span>
                    </div>
                    <span className={`font-mono font-bold ${getStatusColor(metric.status)}`}>
                      {metric.value}{metric.unit}
                    </span>
                  </div>
                  <Progress
                    value={(metric.value / metric.max) * 100}
                    className="h-2"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Service Controls */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white flex items-center gap-2">
                  <Power className="w-5 h-5 text-cyan-400" />
                  Service Controls
                </CardTitle>
                <CardDescription className="text-slate-500">Manage system services and workers</CardDescription>
              </div>
              <Button variant="outline" size="sm" className="border-slate-700 text-slate-300 hover:text-white">
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {services.map((service) => (
                <div
                  key={service.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-slate-800/50 border border-slate-700/50 hover:border-slate-600 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor(service.status)}`} />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-white">{service.name}</p>
                        {service.status === 'running' ? (
                          <CheckCircle2 className="w-4 h-4 text-green-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-slate-500" />
                        )}
                      </div>
                      <p className="text-sm text-slate-500">{service.description}</p>
                      <p className="text-xs text-slate-600 mt-0.5">Uptime: {service.uptime}</p>
                    </div>
                  </div>
                  <Switch
                    checked={service.enabled}
                    onCheckedChange={() => toggleService(service.id)}
                    className="data-[state=checked]:bg-blue-500"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <RefreshCw className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="font-medium text-white">Restart All</p>
                  <p className="text-xs text-slate-500">Cycle all services</p>
                </div>
              </div>
              <Button className="w-full bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30">
                Execute
              </Button>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Database className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="font-medium text-white">Backup Now</p>
                  <p className="text-xs text-slate-500">Trigger manual backup</p>
                </div>
              </div>
              <Button className="w-full bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30">
                Execute
              </Button>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <p className="font-medium text-white">Maintenance Mode</p>
                  <p className="text-xs text-slate-500">Enable maintenance</p>
                </div>
              </div>
              <Button className="w-full bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30">
                Execute
              </Button>
            </CardContent>
          </Card>
        </div>

        <Separator className="bg-slate-800" />

        <footer className="text-center text-xs text-slate-600 pb-4">
          ControlHub v1.0.0  Built for Railway Deployment
        </footer>
      </main>
    </div>
  )
}
