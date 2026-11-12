const EXTENT = 1.42
const SAMPLES = 40

// Project a sinusoidal surface with a local radial well into screen space.
function project(u, v, phase, x, y, travel) {
  const dx = u - x * .42
  const dy = v - y * .42
  const well = Math.exp(-1.55 * (dx * dx + dy * dy))
  const height = .23 * Math.sin(3.3 * u + phase) * Math.cos(2.8 * v) - .69 * well
  const scale = 1 / (1.14 + v * (.25 + travel * .1))
  return [
    520 + (u * 350 + height * 55) * scale,
    290 + (v * 180 + height * 135) * scale,
  ]
}

function curve(sample) {
  let path = ""
  for (let i = 0; i <= SAMPLES; i++) {
    const [x, y] = sample(i / SAMPLES)
    path += (i ? "L" : "M") + x.toFixed(1) + "," + y.toFixed(1)
  }
  return path
}

export function surfacePaths(phase = 0, x = 0, y = 0, travel = 0) {
  const paths = ["", "", ""]
  const point = (u, v) => project(u, v, phase, x, y, travel)
  for (let i = -11; i <= 11; i++) {
    const axis = i * EXTENT / 11
    paths[0] += curve(t => point(axis, (2 * t - 1) * EXTENT))
    paths[1] += curve(t => point((2 * t - 1) * EXTENT, axis))
  }
  // Two radial contours are embedded in the same surface as the grid.
  for (const radius of [.55, .94]) {
    paths[2] += curve(t => {
      const angle = t * Math.PI * 2
      return point(x * .42 + radius * Math.cos(angle), y * .42 + radius * Math.sin(angle))
    }) + "Z"
  }
  return paths
}
