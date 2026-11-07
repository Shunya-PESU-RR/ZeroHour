import { useEffect, useRef, useState } from "react"

const DISTANCE = 10
const FRAGMENTS = 40
const SAMPLES = 8
const CROSS_SECTION = 12
const TURN = Math.PI * 2

function projectedPoint(angle, offset) {
  const dx = 2.65 * Math.cos(angle)
  const dy = 2.48 * Math.cos(2 * angle)
  const length = Math.hypot(dx, dy)
  return [2.65 * Math.sin(angle) - dy * offset / length,
    1.24 * Math.sin(2 * angle) + dx * offset / length]
}

function buildSculpture(THREE) {
  const positions = []
  const colors = []
  const indices = []
  const coral = new THREE.Color("#f2a38f")
  const violet = new THREE.Color("#a995e1")
  const tint = new THREE.Color()

  for (let piece = 0; piece < FRAGMENTS; piece++) {
    // Each section is lifted along its original camera rays. Changing its
    // distance and physical size together preserves the reference projection.
    const crossing = Math.min(piece, FRAGMENTS - 1 - piece) < 2
    const behindCrossing = Math.abs(piece + .5 - FRAGMENTS / 2) < 2
    const depth = crossing ? 2.85 : behindCrossing ? -2.8 : ((piece * 17) % 41 - 20) * .135
    const start = positions.length / 3
    for (let step = 0; step <= SAMPLES; step++) {
      const angle = TURN * (piece * SAMPLES + step) / (FRAGMENTS * SAMPLES)
      for (let side = 0; side < CROSS_SECTION; side++) {
        const profile = TURN * side / CROSS_SECTION
        const offset = .35 * Math.cos(profile)
        const z = depth + .28 * Math.sin(profile)
        const [x, y] = projectedPoint(angle, offset)
        const scale = (DISTANCE - z) / DISTANCE
        positions.push(x * scale, y * scale, z)
        tint.copy(violet).lerp(coral, .5 + .5 * Math.sin(angle + .32))
        colors.push(tint.r, tint.g, tint.b)
        if (step === SAMPLES) continue
        const a = start + step * CROSS_SECTION + side
        const b = start + step * CROSS_SECTION + (side + 1) % CROSS_SECTION
        indices.push(a, b, a + CROSS_SECTION, b, b + CROSS_SECTION, a + CROSS_SECTION)
      }
    }
    // Duplicate the rims so the cut faces have independent, flat normals.
    for (const step of [0, SAMPLES]) {
      const rim = start + step * CROSS_SECTION
      const cap = positions.length / 3
      for (let side = 0; side < CROSS_SECTION; side++) {
        const offset = (rim + side) * 3
        positions.push(positions[offset], positions[offset + 1], positions[offset + 2])
        colors.push(colors[offset] * .65, colors[offset + 1] * .65, colors[offset + 2] * .65)
      }
      for (let side = 1; side < CROSS_SECTION - 1; side++) {
        if (step === 0) indices.push(cap, cap + side + 1, cap + side)
        else indices.push(cap, cap + side, cap + side + 1)
      }
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function fallbackPath(start, end) {
  return Array.from({ length: 161 }, (_, step) => {
    const [x, y] = projectedPoint(start + (end - start) * step / 160, 0)
    return (step === 0 ? "M" : "L") + x.toFixed(3) + " " + (-y).toFixed(3)
  }).join(" ")
}

const LOOP = fallbackPath(0, TURN)
const OVERPASS = fallbackPath(-.15, .15)

function mountSculpture(THREE, stage, canvas, setAvailable) {
  let renderer
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
  } catch {
    return
  }

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(34, 1, .1, 40)
  const geometry = buildSculpture(THREE)
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: .36, metalness: .22, side: THREE.DoubleSide,
  })
  scene.add(new THREE.Mesh(geometry, material))
  scene.add(new THREE.HemisphereLight("#f6dfda", "#594270", 1.3))
  const key = new THREE.DirectionalLight("#fff0df", 3.2)
  key.position.set(-4, 6, 7)
  scene.add(key)
  const rim = new THREE.DirectionalLight("#c2a9ff", 2.3)
  rim.position.set(5, -2, -4)
  scene.add(rim)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
  renderer.toneMapping = THREE.ACESFilmicToneMapping

  let pointer = null
  let origin = 0
  let originY = 0
  let angle = .46
  let pitch = 0
  let targetAngle = angle
  let targetPitch = 0
  let scrollAngle = .46
  let distance = DISTANCE
  let targetDistance = DISTANCE
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
  let frame = 0
  let lost = false

  function schedule() {
    if (!frame && !lost) frame = requestAnimationFrame(draw)
  }

  function draw() {
    frame = 0
    const damping = reducedMotion.matches ? 1 : .2
    angle = THREE.MathUtils.lerp(angle, targetAngle, damping)
    pitch = THREE.MathUtils.lerp(pitch, targetPitch, damping)
    distance = THREE.MathUtils.lerp(distance, targetDistance, damping)
    camera.position.set(distance * Math.cos(pitch) * Math.sin(angle), distance * Math.sin(pitch), distance * Math.cos(pitch) * Math.cos(angle))
    camera.lookAt(0, 0, 0)
    renderer.render(scene, camera)
    if (Math.abs(angle - targetAngle) + Math.abs(pitch - targetPitch) + Math.abs(distance - targetDistance) > .0005) schedule()
  }

  function scroll() {
    if (pointer !== null) return
    const progress = THREE.MathUtils.clamp(window.scrollY / (window.innerHeight * .7), 0, 1)
    const nextAngle = reducedMotion.matches ? .46 : .46 * (1 - progress)
    targetAngle = THREE.MathUtils.clamp(targetAngle + nextAngle - scrollAngle, -1.05, 1.05)
    scrollAngle = nextAngle
    targetDistance = reducedMotion.matches ? DISTANCE : DISTANCE + .45 * (1 - progress)
    schedule()
  }

  function resize() {
    if (lost) return
    const { width, height } = stage.getBoundingClientRect()
    if (!width || !height) return
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    const halfHeight = Math.max(2, 3.48 / camera.aspect)
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(halfHeight / DISTANCE))
    camera.updateProjectionMatrix()
    schedule()
  }

  function press(event) {
    if (pointer !== null || event.button !== 0) return
    pointer = event.pointerId
    origin = event.clientX
    originY = event.clientY
    stage.setPointerCapture(pointer)
    stage.dataset.dragging = "true"
  }

  function move(event) {
    if (event.pointerId !== pointer) return
    const delta = (event.clientX - origin) / stage.clientWidth * 2.1
    origin = event.clientX
    const vertical = (event.clientY - originY) / stage.clientHeight * 1.6
    originY = event.clientY
    targetAngle = THREE.MathUtils.clamp(targetAngle + delta, -1.05, 1.05)
    targetPitch = THREE.MathUtils.clamp(targetPitch + vertical, -.55, .55)
    schedule()
  }

  function release(event) {
    if (event.pointerId !== pointer) return
    pointer = null
    delete stage.dataset.dragging
    scroll()
  }

  function hover(event) {
    key.intensity = event.type === "pointerenter" ? 3.6 : 3.2
    schedule()
  }

  function keyDown(event) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home"].includes(event.key)) return
    event.preventDefault()
    if (event.key === "Home") {
      targetAngle = 0
      targetPitch = 0
    } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      targetPitch = THREE.MathUtils.clamp(targetPitch + (event.key === "ArrowUp" ? -.025 : .025), -.55, .55)
    } else {
      targetAngle = THREE.MathUtils.clamp(targetAngle + (event.key === "ArrowLeft" ? -.025 : .025), -1.05, 1.05)
    }
    schedule()
  }

  function contextLost(event) {
    event.preventDefault()
    lost = true
    cancelAnimationFrame(frame)
    frame = 0
    setAvailable(false)
  }

  function contextRestored() {
    lost = false
    resize()
    setAvailable(true)
  }

  const listeners = [
    ["pointerdown", press], ["pointermove", move], ["pointerup", release],
    ["pointercancel", release], ["lostpointercapture", release],
    ["pointerenter", hover], ["pointerleave", hover], ["keydown", keyDown],
  ]
  listeners.forEach(([type, handler]) => stage.addEventListener(type, handler))
  canvas.addEventListener("webglcontextlost", contextLost)
  canvas.addEventListener("webglcontextrestored", contextRestored)
  const observer = new ResizeObserver(resize)
  observer.observe(stage)
  window.addEventListener("scroll", scroll, { passive: true })
  reducedMotion.addEventListener("change", scroll)
  scroll()
  resize()
  setAvailable(true)

  return () => {
    cancelAnimationFrame(frame)
    observer.disconnect()
    window.removeEventListener("scroll", scroll)
    reducedMotion.removeEventListener("change", scroll)
    listeners.forEach(([type, handler]) => stage.removeEventListener(type, handler))
    canvas.removeEventListener("webglcontextlost", contextLost)
    canvas.removeEventListener("webglcontextrestored", contextRestored)
    geometry.dispose()
    material.dispose()
    renderer.dispose()
  }
}

export default function AnamorphicInfinity() {
  const stageRef = useRef(null)
  const canvasRef = useRef(null)
  const [available, setAvailable] = useState(false)

  useEffect(() => {
    let mounted = true
    let dispose
    import("three").then(THREE => {
      if (mounted) dispose = mountSculpture(THREE, stageRef.current, canvasRef.current, setAvailable)
    }).catch(() => { if (mounted) setAvailable(false) })
    return () => {
      mounted = false
      dispose?.()
    }
  }, [])

  return (
    <>
      <div ref={stageRef} className="hero-aperture infinity-stage" data-interactive={available}
        tabIndex={available ? 0 : undefined} role={available ? "group" : "img"}
        aria-label={available ? "Anamorphic infinity puzzle. Drag or use the arrow keys to orbit. Press Home to align the sculpture." : "Coral and violet infinity sculpture"}>
        <canvas ref={canvasRef} aria-hidden="true" hidden={!available} />
        {!available && (
          <svg viewBox="-3.5 -2 7 4" aria-hidden="true" focusable="false">
            <defs>
              <linearGradient id="infinity-fallback" x2="1" y2=".7">
                <stop stopColor="#f2a38f" /><stop offset=".48" stopColor="#d78b91" /><stop offset="1" stopColor="#8975bc" />
              </linearGradient>
            </defs>
            <path d={LOOP} fill="none" stroke="#36263d" strokeWidth=".78" transform="translate(0 .08)" />
            <path d={LOOP} fill="none" stroke="url(#infinity-fallback)" strokeWidth=".7" />
            <path d={OVERPASS} fill="none" stroke="#674450" strokeWidth=".77" />
            <path d={OVERPASS} fill="none" stroke="url(#infinity-fallback)" strokeWidth=".7" />
          </svg>
        )}
      </div>
      <figcaption className="hero-coordinate">
        {available ? "DRAG TO ALIGN REALITY" : "NOTHING IS WHAT IT SEEMS"}
      </figcaption>
    </>
  )
}
