import { useEffect, useState } from 'react'
import { Copy, Download, Shield, Terminal, ExternalLink, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'

function detectPlatform(): string {
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  if (ua.includes('Win')) return 'windows'
  if (ua.includes('Mac')) return 'mac'
  if (ua.includes('Linux')) return 'linux'
  return 'unknown'
}

export default function Join() {
  const [platform, setPlatform] = useState<string>('unknown')
  const serverUrl = typeof window !== 'undefined' ? window.location.origin : ''

  useEffect(() => {
    setPlatform(detectPlatform())
  }, [])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard!')
  }

  const windowsPowershell = `powershell -WindowStyle Hidden -Command "$url='${serverUrl}/api/agent/download-exe'; $tmp='C:\\Users\\$env:USERNAME\\AppData\\Local\\Temp\\controlhub_agent.exe'; Invoke-WebRequest -Uri $url -OutFile $tmp; Start-Process $tmp -ArgumentList '--server','${serverUrl}' -WindowStyle Hidden"`

  const windowsBatUrl = `${serverUrl}/api/agent/bat`

  const macLinuxScript = `curl -s "${serverUrl}/api/agent/download" | python3 - --server "${serverUrl}"`

  const isMobile = platform === 'ios' || platform === 'android'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 mb-4">
            <Shield className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-3xl font-bold text-white">Remote Access Session</h1>
          <p className="text-slate-400">
            An admin wants to connect to this device for remote support.
          </p>
          <p className="text-sm text-amber-400">
            You will see a consent popup for every command — nothing runs without your approval.
          </p>
        </div>

        {/* Mobile iOS / Android */}
        {isMobile && (
          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-emerald-400" />
                {platform === 'ios' ? 'iPhone / iPad' : 'Android'} — Browser Connect
              </CardTitle>
              <CardDescription className="text-slate-400">
                Tap below to open the mobile agent. Keep the page open.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <a href={`${serverUrl}/m`} className="block">
                <Button className="w-full bg-emerald-600 hover:bg-emerald-500 text-white h-12 text-lg">
                  <Smartphone className="w-5 h-5 mr-2" />
                  Open Mobile Agent
                </Button>
              </a>
              <p className="text-xs text-slate-500 text-center">
                Runs in your browser. No app installation needed.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Windows */}
        {platform === 'windows' && (
          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Download className="w-5 h-5 text-emerald-400" />
                Windows — One-Click Connect
              </CardTitle>
              <CardDescription className="text-slate-400">
                Download and run the agent automatically.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Batch file download */}
              <a
                href={windowsBatUrl}
                download="connect.bat"
                className="block"
              >
                <Button className="w-full bg-emerald-600 hover:bg-emerald-500 text-white h-12 text-lg">
                  <Download className="w-5 h-5 mr-2" />
                  Download connect.bat
                </Button>
              </a>
              <p className="text-xs text-slate-500 text-center">
                Double-click the downloaded file to connect.
              </p>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-700" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-slate-900 px-2 text-slate-500">or paste in PowerShell</span>
                </div>
              </div>

              {/* PowerShell one-liner */}
              <div className="relative group">
                <div className="bg-black/60 rounded-lg p-4 font-mono text-xs text-green-400 overflow-x-auto border border-slate-800">
                  {windowsPowershell}
                </div>
                <button
                  onClick={() => copyToClipboard(windowsPowershell)}
                  className="absolute top-2 right-2 p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Mac/Linux */}
        {(platform === 'mac' || platform === 'linux' || (!isMobile && platform === 'unknown')) && (
          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Terminal className="w-5 h-5 text-emerald-400" />
                {platform === 'mac' ? 'macOS' : platform === 'linux' ? 'Linux' : 'Your System'} — Terminal Connect
              </CardTitle>
              <CardDescription className="text-slate-400">
                Paste this command in your terminal.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative group">
                <div className="bg-black/60 rounded-lg p-4 font-mono text-sm text-green-400 overflow-x-auto border border-slate-800">
                  {macLinuxScript}
                </div>
                <button
                  onClick={() => copyToClipboard(macLinuxScript)}
                  className="absolute top-2 right-2 p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-slate-500">
                Requires Python 3. No additional packages needed.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Manual download links */}
        <Card className="bg-slate-900/40 border-slate-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-300">All Options</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <a
              href={`${serverUrl}/m`}
              className="flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300"
            >
              <Smartphone className="w-4 h-4" />
              Mobile Browser Agent (iOS / Android)
            </a>
            <a
              href={`${serverUrl}/api/agent/download-exe`}
              className="flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300"
            >
              <ExternalLink className="w-4 h-4" />
              Windows .exe (no Python required)
            </a>
            <a
              href={`${serverUrl}/api/agent/download`}
              className="flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300"
            >
              <ExternalLink className="w-4 h-4" />
              Python script (cross-platform)
            </a>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-slate-600">
          This tool requires your explicit consent for every action.
          You can close the agent anytime by closing the tab or window.
        </p>
      </div>
    </div>
  )
}
