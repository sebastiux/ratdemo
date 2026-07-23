import { useState, useEffect } from 'react'

const RICK_URL = 'https://youtu.be/dQw4w9WgXcQ?si=GTezyv3DrDYzucc-'
const RICK_IMG = 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg'
const YT_EMBED = 'https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&mute=0'

export default function Join() {
  const [stage, setStage] = useState<'idle' | 'launched' | 'gotcha'>('idle')
  const [ipInfo, setIpInfo] = useState<any>(null)

  // Pre-fetch IP in background
  useEffect(() => {
    fetch('https://ipapi.co/json/')
      .then(r => r.json())
      .then(data => setIpInfo(data))
      .catch(() => setIpInfo({ ip: 'unknown', city: 'unknown', country_name: 'unknown' }))
  }, [])

  // The trick: open ONE popup during user gesture, then that popup opens the rest
  // via document.write() with inline script — all synchronous, same execution chain
  const handleConnect = () => {
    if (stage !== 'idle') return
    setStage('launched')

    // Open a single "master" popup — this is allowed because of the click
    const master = window.open('about:blank', 'rick_master', 'width=640,height=480,popup=yes,left=20,top=20')
    if (!master) {
      // Blocked entirely — show fallback
      setStage('gotcha')
      return
    }

    // Build the script that opens 15 more windows.
    // These window.open() calls are inside a <script> tag that gets injected
    // via document.write() — they execute SYNCHRONOUSLY during the write,
    // which Chrome may allow because it's the same execution chain as the click.
    const openCalls: string[] = []
    for (let i = 1; i < 16; i++) {
      const left = 20 + (i % 4) * 160
      const top = 20 + Math.floor(i / 4) * 120
      openCalls.push(
        `try{window.open('${RICK_URL}','rick_${i}','width=640,height=480,popup=yes,left=${left},top=${top}')}catch(e){}`
      )
    }

    // Write HTML into the master popup.
    // The inline <script> runs immediately during document.write().
    master.document.open()
    master.document.write(`<!DOCTYPE html>
<html>
<head><title>Rick Roll</title></head>
<body style="margin:0;padding:0;overflow:hidden;background:#000">
  <iframe width="100%" height="100%" src="${YT_EMBED}" frameborder="0" allow="autoplay" allowfullscreen></iframe>
  <script>
    ${openCalls.join(';')}
  </script>
</body>
</html>`)
    master.document.close()

    // Reveal gotcha after delay
    setTimeout(() => {
      setStage('gotcha')
    }, 3500)
  }

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* Fullscreen Rick background */}
      <img
        src={RICK_IMG}
        alt="Rick Astley"
        className="w-full h-full object-cover absolute inset-0 opacity-80"
      />

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Center content */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center p-6">
        {stage === 'idle' && (
          <div className="text-center space-y-6 animate-pulse">
            <h1 className="text-4xl md:text-6xl font-black text-white drop-shadow-lg">
              Remote Access
            </h1>
            <p className="text-xl text-white/80">
              An admin wants to connect to your device.
            </p>
            <button
              onClick={handleConnect}
              className="px-10 py-4 bg-emerald-500 hover:bg-emerald-400 text-white text-xl font-bold rounded-xl shadow-lg transition-all transform hover:scale-105"
            >
              Allow Connection
            </button>
            <p className="text-sm text-white/50">
              You will see a consent popup for every command.
            </p>
          </div>
        )}

        {stage === 'launched' && (
          <div className="text-center space-y-4">
            <h1 className="text-5xl md:text-7xl font-black text-pink-400 drop-shadow-lg animate-pulse">
              Never Gonna
            </h1>
            <h1 className="text-5xl md:text-7xl font-black text-white drop-shadow-lg animate-pulse">
              Give You Up
            </h1>
            <p className="text-2xl text-pink-300 font-bold">
              Rick Roll incoming... 🎵
            </p>
          </div>
        )}

        {stage === 'gotcha' && ipInfo && (
          <div className="text-center space-y-6 max-w-md">
            <h1 className="text-5xl font-black text-pink-400 drop-shadow-lg">
              GOTCHA! 😎
            </h1>
            <div className="bg-black/70 border border-pink-500/30 rounded-xl p-5 text-left space-y-2">
              <p className="text-pink-400 font-bold text-lg">Your info:</p>
              <p className="text-white font-mono text-sm">IP: {ipInfo.ip}</p>
              <p className="text-white font-mono text-sm">Location: {ipInfo.city}, {ipInfo.region}, {ipInfo.country_name}</p>
              <p className="text-white font-mono text-sm">ISP: {ipInfo.org}</p>
              <p className="text-pink-300 text-xs mt-3">Thanks for playing! 🎉</p>
            </div>
          </div>
        )}
      </div>

      {/* Hidden autoplay audio attempt */}
      {stage !== 'idle' && (
        <iframe
          className="absolute opacity-0 pointer-events-none"
          width="1"
          height="1"
          src={YT_EMBED}
          allow="autoplay"
        />
      )}
    </div>
  )
}
