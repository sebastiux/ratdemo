import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth, DEMO_CREDENTIALS } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LogIn, Terminal } from 'lucide-react'

export default function AdminLogin() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (login(username, password)) {
      navigate('/dashboard')
    } else {
      setError('Invalid credentials.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 mb-4">
            <Terminal className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">ControlHub</h1>
          <p className="text-slate-400">Admin Console</p>
        </div>

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
                <p className="text-sm text-red-400">{error}</p>
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

        <div className="text-center space-y-2">
          <p className="text-xs text-slate-500">Demo Credentials</p>
          <div className="inline-block bg-slate-900/80 border border-slate-700 rounded-lg px-4 py-2">
            <p className="text-xs text-slate-500">Username: <span className="text-white font-mono">{DEMO_CREDENTIALS.username}</span></p>
            <p className="text-xs text-slate-500">Password: <span className="text-white font-mono">{DEMO_CREDENTIALS.password}</span></p>
          </div>
        </div>
      </div>
    </div>
  )
}
