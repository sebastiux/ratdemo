import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth, DEMO_CREDENTIALS } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Shield, LogIn, Copy, CheckCircle2, Terminal } from 'lucide-react'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (login(username, password)) {
      navigate('/dashboard')
    } else {
      setError('Invalid credentials. Check the demo login below.')
    }
  }

  const copyPassword = () => {
    navigator.clipboard.writeText(DEMO_CREDENTIALS.password)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 mb-4">
            <Terminal className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">ControlHub</h1>
          <p className="text-slate-400">Remote Management Console</p>
        </div>

        {/* Login Card */}
        <Card className="border-slate-700 bg-slate-800/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <LogIn className="w-5 h-5" />
              Sign In
            </CardTitle>
            <CardDescription className="text-slate-400">
              Enter your credentials to access the control panel
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-slate-300">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>
              {error && (
                <Alert variant="destructive" className="bg-red-900/30 border-red-800">
                  <AlertDescription className="text-red-300">{error}</AlertDescription>
                </Alert>
              )}
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold"
              >
                <LogIn className="w-4 h-4 mr-2" />
                Sign In
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Demo Credentials Card */}
        <Card className="border-amber-700/50 bg-amber-900/20 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-amber-400 flex items-center gap-2 text-base">
              <Shield className="w-5 h-5" />
              Demo Credentials
            </CardTitle>
            <CardDescription className="text-amber-300/70 text-sm">
              Use these credentials to log in (randomly generated per session)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/80 border border-slate-700">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Username</p>
                <p className="text-white font-mono font-semibold">{DEMO_CREDENTIALS.username}</p>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/80 border border-slate-700">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Password</p>
                <p className="text-white font-mono font-semibold">{DEMO_CREDENTIALS.password}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={copyPassword}
                className="text-slate-400 hover:text-white"
              >
                {copied ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-600">
          Railway-Ready Deployment  v1.0.0
        </p>
      </div>
    </div>
  )
}
