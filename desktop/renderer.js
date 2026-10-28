const bubble = document.getElementById('bubble')
const sprite = document.getElementById('sprite')
const host = window.chrome.webview
let shown = ''

// Tells the window where the cat and bubble are, so presses there move it or open its menu.
function reportHitAreas() {
  const areas = [bubble, sprite]
    .filter(el => !el.hidden)
    .map(el => {
      const r = el.getBoundingClientRect()
      return [r.left, r.top, r.width, r.height].map(n => Math.round(n)).join(',')
    })
  host.postMessage(`hit:${window.innerWidth};${areas.join(';')}`)
}

host.addEventListener('message', event => {
  const state = JSON.parse(event.data)
  bubble.textContent = state.bubble || ''
  bubble.hidden = !state.bubble
  // Replacing the SVG restarts its animation, so only swap it when the pose changes.
  const key = `${state.skin}:${state.mood}:${state.antic || ""}`
  if (key !== shown && typeof state.svg === 'string') {
    shown = key
    sprite.innerHTML = state.svg
  }
  reportHitAreas()
})

window.addEventListener('resize', reportHitAreas)
