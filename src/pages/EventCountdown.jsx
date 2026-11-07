import { useEffect, useRef, useState } from "react"
import { eventStart } from "./eventSchedule"
import "./event-countdown.css"

const eventStartTime = Date.parse(eventStart)
const arrivalMessage = "ZeroHour has begun."
const units = [
  { label: "Days", seconds: 86400 },
  { label: "Hours", seconds: 3600, cycle: 24 },
  { label: "Minutes", seconds: 60, cycle: 60 },
  { label: "Seconds", seconds: 1, cycle: 60 },
]

function getCountdownSeconds(now) {
  return Math.max(0, Math.ceil((eventStartTime - now) / 1000))
}

function moveLens(event) {
  if (event.pointerType !== "mouse") return
  const unit = event.currentTarget
  const bounds = unit.getBoundingClientRect()
  const offset = (event.clientX - bounds.left) / bounds.width - .5
  unit.style.setProperty("--countdown-lens", `${offset * 4}px`)
}

export default function EventCountdown() {
  const [remaining, setRemaining] = useState(null)
  const unitsRef = useRef(null)
  const complete = remaining === 0
  const running = remaining !== null && !complete

  useEffect(() => {
    function update() {
      const next = getCountdownSeconds(Date.now())
      setRemaining(next)
      if (next === 0) window.clearInterval(interval)
    }

    const interval = window.setInterval(update, 1000)
    const initialTick = window.setTimeout(update, 0)
    return () => {
      window.clearTimeout(initialTick)
      window.clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    if (!running) return
    const display = unitsRef.current
    const motion = window.matchMedia("(prefers-reduced-motion: no-preference)")
    let nextGlitch
    let endGlitch
    let activeUnit

    function clearGlitch() {
      if (activeUnit) delete activeUnit.dataset.glitch
      activeUnit = null
    }

    function schedule() {
      nextGlitch = window.setTimeout(() => {
        if (!document.hidden && Date.now() < eventStartTime) {
          activeUnit = display.children[Math.floor(Math.random() * units.length)]
          activeUnit.dataset.glitch = ""
          endGlitch = window.setTimeout(clearGlitch, 200)
        }
        schedule()
      }, 5000 + Math.random() * 7000)
    }

    function syncMotion() {
      window.clearTimeout(nextGlitch)
      window.clearTimeout(endGlitch)
      clearGlitch()
      if (motion.matches) schedule()
    }

    syncMotion()
    motion.addEventListener("change", syncMotion)
    return () => {
      motion.removeEventListener("change", syncMotion)
      window.clearTimeout(nextGlitch)
      window.clearTimeout(endGlitch)
      clearGlitch()
    }
  }, [running])

  return (
    <section className="event-countdown" aria-labelledby="event-countdown-heading">
      <div className="event-countdown-inner">
        <div role="status">
          <h2 id="event-countdown-heading">
            {complete ? (
              <span className="event-countdown-arrival">
                {arrivalMessage}
                <span className="event-countdown-echo" aria-hidden="true">{arrivalMessage}</span>
              </span>
            ) : "Countdown to ZeroHour"}
          </h2>
          <p>{complete ? "The wait is over. Let the challenge begin." : "Every second brings us closer to the challenge."}</p>
        </div>
        {!complete && (
          <div ref={unitsRef} className="event-countdown-units" role="timer" aria-label="Time until ZeroHour" aria-live="off" aria-busy={remaining === null}>
            {units.map(({ label, seconds, cycle }) => {
              const total = Math.floor(remaining / seconds)
              const value = remaining === null ? "––" : String(cycle ? total % cycle : total).padStart(2, "0")
              return (
                <div className="event-countdown-unit" key={label} onPointerMove={moveLens}
                  onPointerLeave={(event) => event.currentTarget.style.removeProperty("--countdown-lens")}>
                  <span className="event-countdown-value">
                    <span className="event-countdown-digit" key={value}>{value}</span>
                    <span className="event-countdown-echo" aria-hidden="true" data-value={value}>{value}</span>
                  </span>
                  <span className="event-countdown-label">{label}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
