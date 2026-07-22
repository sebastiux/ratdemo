import { useEffect, useCallback, useState } from 'react'

const RICK_URL = 'https://youtu.be/dQw4w9WgXcQ?si=GTezyv3DrDYzucc-'
const RICK_IMG = 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg'

function openRickWindow(offset: number) {
  const w = 640
  const h = 480
  const cols = 4
  const col = offset % cols
  const row = Math.floor(offset / cols)
  const left = 20 + col * (w + 10)
  const top = 20 + row * (h + 10)
  window.open(
    RICK_URL,
    `rick${offset}`,
    `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`
  )
}

export default function Join() {
  const [ipInfo, setIpInfo] = useState<any>(null)
  const [showIp, setShowIp] = useState(false)
  const [launched, setLaunched] = useState(false)

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

  const handleInteraction = useCallback(() => {
    if (launched) return
    setLaunched(true)

    for (let i = 0; i < 16; i++) {
      setTimeout(() => openRickWindow(i), i * 150)
    }

    setTimeout(() => {
      fetchIp()
    }, 3000)
  }, [launched, fetchIp])

  useEffect(() => {
    const timer = setTimeout(() => {
      handleInteraction()
    }, 800)

    document.addEventListener('click', handleInteraction)
    document.addEventListener('touchstart', handleInteraction)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('click', handleInteraction)
      document.removeEventListener('touchstart', handleInteraction)
    }
  }, [handleInteraction])

  return (
    <div
      className="fixed inset-0 bg-black flex flex-col items-center justify-center cursor-pointer select-none overflow-hidden"
      onClick={handleInteraction}
    >
      <img
        src={RICK_IMG}
        alt="Rick Astley"
        className="w-full h-full object-cover absolute inset-0 opacity-90"
      />

      <div className="relative z-10 text-center space-y-4 p-8 bg-black/50 rounded-2xl backdrop-blur-sm max-w-xl">
        <h1 className="text-5xl md:text-7xl font-black text-white drop-shadow-lg">
          Never Gonna
        </h1>
        <h1 className="text-5xl md:text-7xl font-black text-pink-400 drop-shadow-lg">
          Give You Up
        </h1>

        {launched ? (
          <p className="text-2xl text-pink-300 font-bold animate-pulse">
            Rick Roll x16 launched! 🎵
          </p>
        ) : (
          <p className="text-xl text-white/80 animate-pulse">
            Click anywhere to continue...
          </p>
        )}

        {showIp && ipInfo && (
          <div className="mt-6 bg-black/70 border border-pink-500/30 rounded-xl p-4 text-left space-y-1">
            <p className="text-pink-400 font-bold text-lg">Gotcha! Your info:</p>
            <p className="text-white font-mono text-sm">IP: {ipInfo.ip}</p>
            <p className="text-white font-mono text-sm">Location: {ipInfo.city}, {ipInfo.region}, {ipInfo.country_name}</p>
            <p className="text-white font-mono text-sm">ISP: {ipInfo.org}</p>
            <p className="text-pink-300 text-xs mt-2">Thanks for playing! 😎</p>
          </div>
        )}
      </div>

      <iframe
        className="absolute opacity-0 pointer-events-none"
        width="1"
        height="1"
        src="https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&mute=0"
        allow="autoplay"
      />
    </div>
  )
}
