import { useEffect, useRef } from "react"
import { surfacePaths } from "./warpedSurface"

const REST = surfacePaths()

export default function MoireBackground({ intensity = "immersive", pattern = "surface" }) {
  const backdropRef = useRef(null)

  useEffect(() => {
    if (intensity === "subtle") return

    const backdrop = backdropRef.current
    const host = backdrop.parentElement
    const grid = backdrop.querySelector("svg")
    const paths = grid?.querySelectorAll("path")
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)")
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)")
    const immersive = intensity === "immersive"
    let frame = 0
    let visible = false
    let last = 0
    let phase = 0
    let x = 0
    let y = 0
    let targetX = 0
    let targetY = 0

    function schedule() {
      if (!frame && visible && !document.hidden && !reduced.matches) {
        frame = requestAnimationFrame(render)
      }
    }

    function render(now) {
      frame = 0
      const elapsed = last ? now - last : 42
      if (elapsed >= 40) {
        last = now
        phase += Math.min(elapsed, 80) * .00034
        const ease = 1 - Math.exp(-elapsed / 330)
        x += (targetX - x) * ease
        y += (targetY - y) * ease
        const travel = immersive ? Math.min(1, Math.max(0, -host.getBoundingClientRect().top / 850)) : 0
        if (paths) surfacePaths(phase, x, y, travel).forEach((path, i) => paths[i].setAttribute("d", path))
        backdrop.style.setProperty("--moire-x", (x * 7).toFixed(2) + "px")
        backdrop.style.setProperty("--moire-y", (y * 5).toFixed(2) + "px")
      }
      schedule()
    }

    function point(event) {
      if (!finePointer.matches || reduced.matches || event.pointerType === "touch") return
      const strength = immersive ? 1 : .48
      targetX = (event.clientX / window.innerWidth * 2 - 1) * strength
      targetY = (event.clientY / window.innerHeight * 2 - 1) * strength
    }

    function center() {
      targetX = targetY = 0
    }

    function sync() {
      const paused = !visible || document.hidden || reduced.matches
      backdrop.toggleAttribute("data-paused", paused)
      if (paused) {
        cancelAnimationFrame(frame)
        frame = last = 0
      } else {
        schedule()
      }
      if (reduced.matches) {
        x = y = targetX = targetY = phase = 0
        if (paths) REST.forEach((path, i) => paths[i].setAttribute("d", path))
        backdrop.style.removeProperty("--moire-x")
        backdrop.style.removeProperty("--moire-y")
      }
    }

    function updateVisibility() {
      const bounds = (grid ?? backdrop).getBoundingClientRect()
      const next = bounds.bottom > 0 && bounds.top < window.innerHeight
      if (next === visible) return
      visible = next
      sync()
    }
    window.addEventListener("scroll", updateVisibility, { passive: true })
    window.addEventListener("resize", updateVisibility)
    host.addEventListener("pointermove", point, { passive: true })
    host.addEventListener("pointerleave", center)
    document.addEventListener("visibilitychange", sync)
    reduced.addEventListener("change", sync)
    updateVisibility()
    sync()

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("scroll", updateVisibility)
      window.removeEventListener("resize", updateVisibility)
      host.removeEventListener("pointermove", point)
      host.removeEventListener("pointerleave", center)
      document.removeEventListener("visibilitychange", sync)
      reduced.removeEventListener("change", sync)
    }
  }, [intensity, pattern])

  return (
    <div className="moire-background" data-intensity={intensity} data-pattern={pattern} ref={backdropRef} aria-hidden="true">
      {pattern === "surface" && <svg className="warped-grid" viewBox="0 0 1040 580" focusable="false">
        <path className="warped-meridians" d={REST[0]} />
        <path className="warped-parallels" d={REST[1]} />
        <path className="warped-contours" d={REST[2]} />
      </svg>}
      {(intensity === "immersive" || pattern === "moire") && (
        <>
        <div className={intensity === "subtle" ? "moire-field moire-still" : "moire-field"}>
          <span className="moire-lines" />
          <span className="moire-offset"><span className="moire-lines" /></span>
        </div>
        {intensity === "immersive" && <div className="moire-field moire-static">
          <span className="moire-lines" />
          <span className="moire-offset"><span className="moire-lines" /></span>
        </div>}
        </>
      )}
    </div>
  )
}
