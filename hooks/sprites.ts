import type { Antic, Mood, Skin } from '../types'
import { ANTIC_LOOKS, CAT_DREAM, ROBOT_DREAM } from './antics'

// Every drawing is one SVG whose motion is SMIL inside the markup, so the
// pane redraws only when the mood changes, never per animation frame.

export type Eyes = 'open' | 'happy' | 'narrow' | 'up' | 'wide' | 'closed' | 'side' | 'spin' | 'off'
export type Mouth = 'smile' | 'talk' | 'flat' | 'frown' | 'o' | 'grin' | 'wavy' | 'off'
type Extra =
  | 'thought'
  | 'magnifier'
  | 'laptop'
  | 'sweat'
  | 'zzz'
  | 'sparkles'
  | 'question'
  | 'exclaim'
  | 'blush'
  | 'wag'
  | 'brows'
  | 'heart'

export type Pose = {
  eyes: Eyes
  mouth: Mouth
  extras: readonly Extra[]
  // Cat: how the ears sit; robot: ignored.
  ears: 'up' | 'flat' | 'tilt'
  // Seconds per tail swish / antenna pulse; smaller is livelier.
  tempo: number
  bounce: boolean
  // The robot's antenna light.
  light: string
}

const POSES: Record<Mood, Pose> = {
  idle: { eyes: 'open', mouth: 'smile', extras: [], ears: 'up', tempo: 2.4, bounce: false, light: '#7bd88f' },
  sleepy: { eyes: 'closed', mouth: 'flat', extras: ['zzz'], ears: 'tilt', tempo: 4, bounce: false, light: '#5b6b8c' },
  listening: { eyes: 'wide', mouth: 'smile', extras: ['heart'], ears: 'up', tempo: 0.8, bounce: true, light: '#ffd166' },
  thinking: { eyes: 'up', mouth: 'flat', extras: ['thought'], ears: 'tilt', tempo: 1.8, bounce: false, light: '#a78bfa' },
  talking: { eyes: 'open', mouth: 'talk', extras: [], ears: 'up', tempo: 1.2, bounce: false, light: '#5ef0ff' },
  working: { eyes: 'narrow', mouth: 'smile', extras: ['laptop'], ears: 'up', tempo: 1, bounce: false, light: '#ffa94d' },
  searching: { eyes: 'side', mouth: 'flat', extras: ['magnifier'], ears: 'up', tempo: 1.4, bounce: false, light: '#4dabf7' },
  correcting: { eyes: 'open', mouth: 'talk', extras: ['wag', 'exclaim'], ears: 'up', tempo: 1, bounce: false, light: '#ffd43b' },
  disapproving: { eyes: 'narrow', mouth: 'frown', extras: ['brows'], ears: 'flat', tempo: 0.5, bounce: false, light: '#ff6b6b' },
  happy: { eyes: 'happy', mouth: 'grin', extras: ['sparkles', 'blush'], ears: 'up', tempo: 0.6, bounce: true, light: '#69db7c' },
  apologetic: { eyes: 'happy', mouth: 'wavy', extras: ['blush', 'sweat'], ears: 'flat', tempo: 2.4, bounce: false, light: '#f783ac' },
  curious: { eyes: 'wide', mouth: 'o', extras: ['question'], ears: 'tilt', tempo: 1.4, bounce: false, light: '#74c0fc' },
  oops: { eyes: 'wide', mouth: 'o', extras: ['sweat', 'exclaim'], ears: 'flat', tempo: 0.4, bounce: false, light: '#ff922b' },
}

const INK = '#3b2a20'

// The pose for a mood, with an idle antic's changes when one is playing.
function poseFor(mood: Mood, antic: Antic | undefined): Pose {
  const base = POSES[mood]
  if (antic === undefined) return base
  const look = ANTIC_LOOKS[antic]
  return {
    ...base,
    eyes: look.eyes ?? base.eyes,
    mouth: look.mouth ?? base.mouth,
    ears: look.ears ?? base.ears,
    tempo: look.tempo ?? base.tempo,
    bounce: look.bounce ?? base.bounce,
    light: look.light ?? base.light,
  }
}

function rotate(from: number, to: number, cx: number, cy: number, dur: number): string {
  return `<animateTransform attributeName="transform" type="rotate" values="${from} ${cx} ${cy};${to} ${cx} ${cy};${from} ${cx} ${cy}" dur="${dur}s" repeatCount="indefinite"/>`
}

function eyes(kind: Eyes, lx: number, rx: number, y: number, color: string, pupil: string): string {
  const blink = `<animate attributeName="ry" values="8;8;0.8;8" keyTimes="0;0.92;0.96;1" dur="4s" repeatCount="indefinite"/>`
  const pair = (one: (x: number) => string) => one(lx) + one(rx)
  switch (kind) {
    case 'open':
      return pair(x => `<ellipse cx="${x}" cy="${y}" rx="6.5" ry="8" fill="${color}">${blink}</ellipse>`)
    case 'happy':
      return pair(x => `<path d="M${x - 7} ${y + 3} Q${x} ${y - 7} ${x + 7} ${y + 3}" stroke="${color}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`)
    case 'narrow':
      return pair(x => `<rect x="${x - 8}" y="${y - 1.5}" width="16" height="4" rx="2" fill="${color}"/>`)
    case 'closed':
      return pair(x => `<path d="M${x - 7} ${y} Q${x} ${y + 6} ${x + 7} ${y}" stroke="${color}" stroke-width="3" fill="none" stroke-linecap="round"/>`)
    case 'wide':
      return pair(
        x => `<circle cx="${x}" cy="${y}" r="10" fill="#fff" stroke="${color}" stroke-width="2"/><circle cx="${x}" cy="${y}" r="4.5" fill="${pupil}"/>`,
      )
    case 'up':
      return pair(
        x =>
          `<circle cx="${x}" cy="${y}" r="9" fill="#fff" stroke="${color}" stroke-width="2"/><circle cx="${x + 3}" cy="${y - 4}" r="4" fill="${pupil}"><animate attributeName="cx" values="${x + 3};${x - 2};${x + 3}" dur="3s" repeatCount="indefinite"/></circle>`,
      )
    case 'side':
      return pair(
        x =>
          `<circle cx="${x}" cy="${y}" r="9" fill="#fff" stroke="${color}" stroke-width="2"/><circle cx="${x}" cy="${y}" r="4" fill="${pupil}"><animate attributeName="cx" values="${x - 4};${x + 4};${x - 4}" dur="1.6s" repeatCount="indefinite"/></circle>`,
      )
    case 'off':
      return ''
    case 'spin':
      return pair(
        x =>
          `<circle cx="${x}" cy="${y}" r="7" stroke="${color}" stroke-width="3" fill="none" stroke-dasharray="22 22" stroke-linecap="round"><animateTransform attributeName="transform" type="rotate" values="0 ${x} ${y};360 ${x} ${y}" dur="1s" repeatCount="indefinite"/></circle>`,
      )
  }
}

function mouth(kind: Mouth, x: number, y: number, color: string): string {
  switch (kind) {
    case 'smile':
      return `<path d="M${x - 8} ${y} Q${x - 4} ${y + 5} ${x} ${y} Q${x + 4} ${y + 5} ${x + 8} ${y}" stroke="${color}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`
    case 'grin':
      return `<path d="M${x - 11} ${y - 2} Q${x} ${y + 14} ${x + 11} ${y - 2} Z" fill="${color}"/><path d="M${x - 5} ${y + 5} Q${x} ${y + 9} ${x + 5} ${y + 5}" fill="#ff8fa3"/>`
    case 'talk':
      return `<ellipse cx="${x}" cy="${y + 2}" rx="6" ry="4" fill="${color}"><animate attributeName="ry" values="1.5;5;2;4.5;1.5" dur="0.6s" repeatCount="indefinite"/></ellipse>`
    case 'flat':
      return `<path d="M${x - 7} ${y + 2} L${x + 7} ${y + 2}" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>`
    case 'frown':
      return `<path d="M${x - 9} ${y + 6} Q${x} ${y - 3} ${x + 9} ${y + 6}" stroke="${color}" stroke-width="3" fill="none" stroke-linecap="round"/>`
    case 'o':
      return `<ellipse cx="${x}" cy="${y + 3}" rx="4.5" ry="6" fill="${color}"/>`
    case 'wavy':
      return `<path d="M${x - 10} ${y + 2} q2.5 -4 5 0 t5 0 t5 0 t5 0" stroke="${color}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`
    case 'off':
      return ''
  }
}

// Props drawn around either character, placed relative to its eyes.
function extras(list: readonly Extra[], tempo: number, face: { lx: number; rx: number; y: number }): string {
  return list
    .map(extra => {
      switch (extra) {
        case 'thought':
          return `<g fill="#fff" stroke="#9aa3b5" stroke-width="2">
            <circle cx="150" cy="58" r="4"><animate attributeName="opacity" values="0;1;1;0" dur="2s" repeatCount="indefinite"/></circle>
            <circle cx="162" cy="42" r="6"><animate attributeName="opacity" values="0;0;1;0" dur="2s" repeatCount="indefinite"/></circle>
            <ellipse cx="176" cy="20" rx="20" ry="13"><animate attributeName="opacity" values="0;0;1;1" keyTimes="0;0.4;0.6;1" dur="2s" repeatCount="indefinite"/></ellipse>
            <text x="176" y="25" font-size="16" text-anchor="middle" fill="#6b7280" stroke="none" font-family="sans-serif">…</text></g>`
        case 'magnifier':
          return `<g><animateTransform attributeName="transform" type="translate" values="0 0;-12 4;0 0" dur="1.6s" repeatCount="indefinite"/>
            <circle cx="160" cy="120" r="14" fill="#cfe8ff" fill-opacity="0.6" stroke="#4a5568" stroke-width="4"/>
            <path d="M170 131 L184 146" stroke="#8b5e34" stroke-width="7" stroke-linecap="round"/></g>`
        case 'laptop':
          return `<g><rect x="62" y="152" width="76" height="40" rx="5" fill="#4a5568"/>
            <rect x="68" y="157" width="64" height="30" rx="3" fill="#a5d8ff"/>
            <rect x="74" y="163" width="30" height="3" rx="1.5" fill="#1971c2"><animate attributeName="width" values="6;40;20;48;6" dur="1.2s" repeatCount="indefinite"/></rect>
            <rect x="74" y="171" width="20" height="3" rx="1.5" fill="#1971c2"><animate attributeName="width" values="30;10;36;14;30" dur="1.4s" repeatCount="indefinite"/></rect>
            <rect x="52" y="190" width="96" height="6" rx="3" fill="#2d3748"/></g>`
        case 'sweat':
          return `<path d="M${face.rx + 22} ${face.y - 22} q-6 9 0 12 q6 -3 0 -12 Z" fill="#74c0fc"><animateTransform attributeName="transform" type="translate" values="0 0;0 8;0 0" dur="${tempo * 3}s" repeatCount="indefinite"/></path>`
        case 'zzz':
          return `<g font-family="sans-serif" font-weight="bold" fill="#8ea0c8">
            <text x="148" y="60" font-size="14">Z<animate attributeName="opacity" values="0;1;0" dur="3s" repeatCount="indefinite"/></text>
            <text x="160" y="42" font-size="18">Z<animate attributeName="opacity" values="0;0;1;0" dur="3s" repeatCount="indefinite"/></text>
            <text x="174" y="22" font-size="22">Z<animate attributeName="opacity" values="0;0;0;1;0" dur="3s" repeatCount="indefinite"/></text></g>`
        case 'sparkles':
          const spots: readonly (readonly [number, number])[] = [
            [38, 50],
            [165, 40],
            [170, 110],
          ]
          return spots
            .map(
              ([x, y], i) =>
                `<path d="M${x} ${y - 9} L${x + 3} ${y - 3} L${x + 9} ${y} L${x + 3} ${y + 3} L${x} ${y + 9} L${x - 3} ${y + 3} L${x - 9} ${y} L${x - 3} ${y - 3} Z" fill="#ffd43b"><animate attributeName="opacity" values="0.2;1;0.2" dur="${0.8 + i * 0.3}s" repeatCount="indefinite"/></path>`,
            )
            .join('')
        case 'question':
          return `<text x="160" y="50" font-size="36" font-weight="bold" font-family="sans-serif" fill="#4dabf7">?<animateTransform attributeName="transform" type="rotate" values="-10 168 38;10 168 38;-10 168 38" dur="1.4s" repeatCount="indefinite"/></text>`
        case 'exclaim':
          return `<text x="40" y="52" font-size="34" font-weight="bold" font-family="sans-serif" fill="#f59f00">!<animate attributeName="opacity" values="1;0.3;1" dur="0.7s" repeatCount="indefinite"/></text>`
        case 'blush':
          return `<ellipse cx="${face.lx - 6}" cy="${face.y + 14}" rx="7" ry="4" fill="#ff8fa3" opacity="0.7"/><ellipse cx="${face.rx + 6}" cy="${face.y + 14}" rx="7" ry="4" fill="#ff8fa3" opacity="0.7"/>`
        case 'brows':
          return `<path d="M${face.lx - 10} ${face.y - 16} L${face.lx + 8} ${face.y - 10}" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><path d="M${face.rx + 10} ${face.y - 16} L${face.rx - 8} ${face.y - 10}" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`
        case 'heart':
          return `<path d="M165 50 c-6 -10 -20 -4 -12 8 l12 12 l12 -12 c8 -12 -6 -18 -12 -8 Z" fill="#ff6b8b"><animateTransform attributeName="transform" type="translate" values="0 6;0 -6;0 6" dur="1.2s" repeatCount="indefinite"/></path>`
        case 'wag':
          // Drawn by the skin itself: it is a paw on the cat and an arm on the robot.
          return ''
      }
    })
    .join('')
}

// `motion` replaces the whole-body hop or breathing, as an antic's pounce does.
function frame(body: string, alt: string, bounce: boolean, motion?: string): string {
  const hop =
    motion ??
    (bounce
      ? `<animateTransform attributeName="transform" type="translate" values="0 0;0 -8;0 0" dur="0.5s" repeatCount="indefinite"/>`
      : `<animateTransform attributeName="transform" type="translate" values="0 0;0 1.5;0 0" dur="3s" repeatCount="indefinite"/>`)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200" role="img"><title>${alt}</title><g>${hop}${body}</g></svg>`
}

function cat(mood: Mood, antic?: Antic): string {
  const p = poseFor(mood, antic)
  const fur = '#f4a259'
  const face = { lx: 84, rx: 116, y: 92 }
  const earTilt = p.ears === 'flat' ? 32 : p.ears === 'tilt' ? 12 : 0
  const ear = (side: -1 | 1) => {
    const bx = 100 + side * 35
    const tip = 100 + side * 28
    const inner = 100 + side * 10
    const pivot = `${100 + side * 24} 64`
    const lean = side * earTilt
    return `<g transform="rotate(${lean} ${pivot})"><polygon points="${bx},72 ${tip},26 ${inner},58" fill="${fur}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><polygon points="${bx - side * 6},64 ${tip},38 ${inner + side * 6},58" fill="#ffb3c1"/></g>`
  }
  const tailWidth = mood === 'disapproving' || mood === 'oops' ? 16 : 10
  const paw = p.extras.includes('wag')
    ? `<g>${rotate(-20, 20, 140, 140, 0.6)}<path d="M138 140 L160 100" stroke="${fur}" stroke-width="13" stroke-linecap="round"/><circle cx="161" cy="97" r="9" fill="${fur}" stroke="${INK}" stroke-width="3"/><path d="M161 88 L161 74" stroke="${INK}" stroke-width="4" stroke-linecap="round"/></g>`
    : ''
  const thinkPaw = mood === 'thinking' ? `<ellipse cx="108" cy="124" rx="10" ry="8" fill="${fur}" stroke="${INK}" stroke-width="3"/>` : ''
  const body = `
    <g>${rotate(-12, 18, 135, 165, p.tempo)}<path d="M130 168 Q178 160 170 112" stroke="${INK}" stroke-width="${tailWidth + 6}" fill="none" stroke-linecap="round"/><path d="M130 168 Q178 160 170 112" stroke="${fur}" stroke-width="${tailWidth}" fill="none" stroke-linecap="round"/></g>
    <ellipse cx="100" cy="160" rx="44" ry="32" fill="${fur}" stroke="${INK}" stroke-width="3"/>
    <ellipse cx="100" cy="168" rx="24" ry="18" fill="#ffe8cc"/>
    ${ear(-1)}${ear(1)}
    <circle cx="100" cy="98" r="44" fill="${fur}" stroke="${INK}" stroke-width="3"/>
    <path d="M86 60 L90 74 M100 56 L100 72 M114 60 L110 74" stroke="#d9822b" stroke-width="4" stroke-linecap="round"/>
    ${eyes(p.eyes, face.lx, face.rx, face.y, INK, INK)}
    <path d="M96 104 L104 104 L100 109 Z" fill="#ff8fa3"/>
    ${mouth(p.mouth, 100, 112, INK)}
    <path d="M58 104 L78 106 M58 114 L78 111 M142 104 L122 106 M142 114 L122 111" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>
    ${thinkPaw}${paw}
    ${mood === 'sleepy' ? CAT_DREAM : extras(p.extras, p.tempo, face)}
    ${antic === undefined ? '' : ANTIC_LOOKS[antic].art}`
  const alt = antic === undefined ? `A cat looking ${mood}` : `A cat (${antic})`
  return frame(body, alt, p.bounce, antic === undefined ? undefined : ANTIC_LOOKS[antic].motion)
}

function robot(mood: Mood, antic?: Antic): string {
  const p = poseFor(mood, antic)
  const metal = '#b8c4d6'
  const glow = '#5ef0ff'
  const face = { lx: 86, rx: 114, y: 80 }
  const robotEyes: Eyes = mood === 'thinking' ? 'spin' : p.eyes
  const arm = (side: -1 | 1) => {
    const x = 100 + side * 40
    if (side === 1 && p.extras.includes('wag')) {
      return `<g>${rotate(-25, 15, x, 136, 0.6)}<path d="M${x} 136 L${x + 16} 100" stroke="${metal}" stroke-width="9" stroke-linecap="round"/><circle cx="${x + 17}" cy="96" r="7" fill="${metal}" stroke="#4a5568" stroke-width="2.5"/><path d="M${x + 17} 89 L${x + 17} 76" stroke="#4a5568" stroke-width="4" stroke-linecap="round"/></g>`
    }
    const swing = p.bounce ? rotate(-20, 20, x, 136, p.tempo) : rotate(-4, 4, x, 136, p.tempo * 1.5)
    return `<g>${swing}<path d="M${x} 136 L${x + side * 14} 166" stroke="${metal}" stroke-width="9" stroke-linecap="round"/><circle cx="${x + side * 15}" cy="170" r="7" fill="${metal}" stroke="#4a5568" stroke-width="2.5"/></g>`
  }
  const sway = antic !== undefined && ANTIC_LOOKS[antic].isAntennaWiggling === true ? rotate(-14, 14, 100, 42, 0.5) : ''
  const body = `
    <g>${sway}<path d="M100 42 L100 24" stroke="#4a5568" stroke-width="4"/>
    <circle cx="100" cy="20" r="8" fill="${p.light}" stroke="#4a5568" stroke-width="2.5"><animate attributeName="opacity" values="1;0.45;1" dur="${p.tempo}s" repeatCount="indefinite"/></circle>
    <circle cx="100" cy="20" r="14" fill="${p.light}" opacity="0.25"><animate attributeName="r" values="9;16;9" dur="${p.tempo}s" repeatCount="indefinite"/></circle></g>
    ${arm(-1)}${arm(1)}
    <rect x="66" y="124" width="68" height="52" rx="12" fill="${metal}" stroke="#4a5568" stroke-width="3"/>
    <circle cx="100" cy="146" r="9" fill="#2d3748"/><circle cx="100" cy="146" r="5" fill="${p.light}"/>
    <rect x="72" y="176" width="18" height="14" rx="4" fill="#4a5568"/><rect x="110" y="176" width="18" height="14" rx="4" fill="#4a5568"/>
    <rect x="52" y="42" width="96" height="78" rx="18" fill="${metal}" stroke="#4a5568" stroke-width="3"/>
    <rect x="44" y="70" width="10" height="22" rx="4" fill="#8794a8"/><rect x="146" y="70" width="10" height="22" rx="4" fill="#8794a8"/>
    <rect x="62" y="52" width="76" height="58" rx="12" fill="#1d2433"/>
    ${eyes(robotEyes, face.lx, face.rx, face.y, glow, '#1d2433')}
    ${mouth(p.mouth, 100, 96, glow)}
    ${mood === 'sleepy' ? ROBOT_DREAM : extras(p.extras, p.tempo, face)}
    ${antic === undefined ? '' : ANTIC_LOOKS[antic].art}`
  const alt = antic === undefined ? `A robot looking ${mood}` : `A robot (${antic})`
  return frame(body, alt, p.bounce, antic === undefined ? undefined : ANTIC_LOOKS[antic].motion)
}

// An antic is drawn only for its own character.
export function sprite(skin: Skin, mood: Mood, antic?: Antic): string {
  const own = antic !== undefined && ANTIC_LOOKS[antic].skin === skin ? antic : undefined
  return skin === 'cat' ? cat(mood, own) : robot(mood, own)
}

// For surfaces without Svg (the terminal): a face per mood.
const FACES: Record<Skin, Record<Mood, string>> = {
  cat: {
    idle: '(=^･ω･^=)',
    sleepy: '(=-ω-=) zzZ',
    listening: '(=ΦωΦ=)!',
    thinking: '(=・ω・=)…💭',
    talking: '(=^･o･^=)',
    working: '(=^･ω･^=)⌨',
    searching: '(=^･ω･^=)🔍',
    correcting: '(=^･ω･^=)☝',
    disapproving: '(=｀ω´=)',
    happy: '(=^▽^=)✨',
    apologetic: '(=˘ω˘=)💦',
    curious: '(=ΦωΦ=)?',
    oops: '(=ﾟωﾟ=)!!',
  },
  robot: {
    idle: '[•_•]',
    sleepy: '[-_-] zzZ',
    listening: '[O_O]!',
    thinking: '[@_@]…',
    talking: '[•o•]',
    working: '[•_•]⌨',
    searching: '[•_•]🔍',
    correcting: '[•_•]☝',
    disapproving: '[¬_¬]',
    happy: '[^‿^]✨',
    apologetic: '[;_;]',
    curious: '[•_•]?',
    oops: '[ﾟДﾟ]!!',
  },
}

const ANTIC_FACES: Record<Antic, string> = {
  groom: '(=^-ω-^=)ﾉ',
  yarn: '(=^･ω･^=)ﾉ🧶',
  butterfly: '(=ΦωΦ=)🦋',
  cup: '(=^･ω･^=)☕',
  loaf: '(=^-ω-^=)',
  recharge: '[-_-]🔋',
  radio: '[^‿^]♪',
  oil: '[O_O] eek!',
  juggle: '[•‿•]🔩',
  scan: '[•_•]-🔴',
  reboot: '[...]',
  stretch: '(=^-o-^=)~',
  powerup: '[O_O]⚡',
}

export function face(skin: Skin, mood: Mood, antic?: Antic): string {
  return antic !== undefined && ANTIC_LOOKS[antic].skin === skin ? ANTIC_FACES[antic] : FACES[skin][mood]
}
