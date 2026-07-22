import { useEffect, useCallback } from 'react'

const RICK_URL = 'https://youtu.be/dQw4w9WgXcQ?si=GTezyv3DrDYzucc-'
const RICK_IMG = 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg'

function openRickWindow(offset: number) {
  const w = 800
  const h = 600
  const left = 50 + offset * 30
  const top = 50 + offset * 30
  window.open(
    RICK_URL,
    `rick${offset}`,
    `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`
  )
}

export default function Login() {
  // Open 4 windows on ANY click/tap (bypasses Chrome pop-up blocker)
  const handleInteraction = useCallback(() => {
    for (let i = 0; i < 4; i++) {
      setTimeout(() => openRickWindow(i), i * 300)
    }
  }, [])

  useEffect(() => {
    // Also try auto-opening after a delay (may be blocked, but worth trying)
    const timer = setTimeout(() => {
      for (let i = 0; i < 4; i++) {
        setTimeout(() => openRickWindow(i), i * 500)
      }
    }, 1500)

    // Listen for any click anywhere
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
      className="fixed inset-0 bg-black flex flex-col items-center justify-center cursor-pointer select-none"
      onClick={handleInteraction}
    >
      {/* Full-screen Rick Astley image */}
      <img
        src={RICK_IMG}
        alt="Rick Astley"
        className="w-full h-full object-cover absolute inset-0 opacity-90"
      />

      {/* Overlay text */}
      <div className="relative z-10 text-center space-y-4 p-8 bg-black/50 rounded-2xl backdrop-blur-sm">
        <h1 className="text-5xl md:text-7xl font-black text-white drop-shadow-lg">
          Never Gonna
        </h1>
        <h1 className="text-5xl md:text-7xl font-black text-pink-400 drop-shadow-lg">
          Give You Up
        </h1>
        <p className="text-xl text-white/80 animate-pulse">
          Click anywhere to continue...
        </p>
      </div>

      {/* Hidden YouTube embed for auto-play audio */}
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
