import type { Antic, Skin } from '../types'
import type { Eyes, Mouth, Pose } from './sprites'

// Little scenes a character plays on its own while idle, drawn over the idle
// pose, plus what each one dreams while asleep. Each scene loops; register.tsx
// shows it for `ms`, long enough for one or two loops.

const INK = '#3b2a20'
const FUR = '#f4a259'
const GLOW = '#5ef0ff'
const loop = (seconds: number) => `dur="${seconds}s" repeatCount="indefinite"`

export type AnticLook = {
  skin: Skin
  ms: number
  eyes?: Eyes
  mouth?: Mouth
  ears?: Pose['ears']
  tempo?: number
  bounce?: boolean
  light?: string
  // Replaces the whole-body breathing, as the butterfly's pounce does.
  motion?: string
  // Robot only: the antenna sways.
  isAntennaWiggling?: boolean
  art: string
}

export const ANTIC_LOOKS: Record<Antic, AnticLook> = {
  // Licks a paw and wipes it over its ear.
  groom: {
    skin: 'cat',
    ms: 6000,
    eyes: 'closed',
    mouth: 'off',
    ears: 'tilt',
    art: `<ellipse cx="100" cy="114" rx="3.5" ry="4.5" fill="#ff8fa3"><animate attributeName="ry" values="1;4.5;1" ${loop(0.6)}/></ellipse>
      <g><animateTransform attributeName="transform" type="translate" values="0 0;-2 -30;0 -24;-2 -30;0 0" ${loop(2.4)}/>
      <ellipse cx="74" cy="122" rx="11" ry="9" fill="${FUR}" stroke="${INK}" stroke-width="3"/>
      <path d="M69 118 L69 124 M74 117 L74 124 M79 118 L79 124" stroke="${INK}" stroke-width="1.5" stroke-linecap="round"/></g>`,
  },
  // Bats a ball of yarn that rolls away and back.
  yarn: {
    skin: 'cat',
    ms: 6600,
    eyes: 'side',
    mouth: 'smile',
    art: `<g><animateTransform attributeName="transform" type="translate" values="0 0;-26 0;0 0" ${loop(2.2)}/>
      <g><animateTransform attributeName="transform" type="rotate" values="0 40 178;-300 40 178;0 40 178" ${loop(2.2)}/>
      <circle cx="40" cy="178" r="13" fill="#e64980" stroke="${INK}" stroke-width="2.5"/>
      <path d="M30 172 Q40 168 50 174 M28 180 Q40 176 52 182 M34 188 Q42 184 48 188" stroke="#fcc2d7" stroke-width="2" fill="none"/></g></g>
      <g><animateTransform attributeName="transform" type="translate" values="0 0;-12 6;0 0;0 0" keyTimes="0;0.12;0.3;1" ${loop(2.2)}/>
      <ellipse cx="64" cy="172" rx="10" ry="8" fill="${FUR}" stroke="${INK}" stroke-width="3"/></g>`,
  },
  // A butterfly flutters by; the cat watches, then pounces.
  butterfly: {
    skin: 'cat',
    ms: 8000,
    eyes: 'up',
    mouth: 'smile',
    motion: `<animateTransform attributeName="transform" type="translate" values="0 0;0 0;0 -16;0 0" keyTimes="0;0.7;0.82;1" ${loop(4)}/>`,
    art: `<g><animateMotion path="M24 44 C60 0 120 8 150 36 S194 78 160 68 S80 30 24 44" ${loop(4)}/>
      <ellipse cx="-4" cy="0" rx="6" ry="8" fill="#ffd43b" stroke="${INK}" stroke-width="1.5"><animate attributeName="rx" values="6;1.5;6" ${loop(0.3)}/></ellipse>
      <ellipse cx="4" cy="0" rx="6" ry="8" fill="#ffd43b" stroke="${INK}" stroke-width="1.5"><animate attributeName="rx" values="6;1.5;6" ${loop(0.3)}/></ellipse>
      <rect x="-1" y="-6" width="2" height="12" rx="1" fill="${INK}"/></g>`,
  },
  // Nudges a little cup off a shelf, then looks innocent.
  cup: {
    skin: 'cat',
    ms: 8000,
    eyes: 'happy',
    mouth: 'smile',
    art: `<g fill="#a47148" stroke="${INK}" stroke-width="2"><rect x="14" y="160" width="4" height="34"/><rect x="40" y="160" width="4" height="34"/>
      <rect x="8" y="150" width="42" height="10" rx="2"/></g>
      <g><animateTransform attributeName="transform" type="translate" values="0 0;0 0;-18 0;-30 46;-30 46" keyTimes="0;0.25;0.45;0.6;1" ${loop(4)}/>
      <animate attributeName="opacity" values="1;1;1;0;0" keyTimes="0;0.25;0.55;0.62;1" ${loop(4)}/>
      <path d="M28 134 L44 134 L42 150 L30 150 Z" fill="#74c0fc" stroke="${INK}" stroke-width="2"/>
      <path d="M44 138 q6 0 5 5 q-1 4 -6 4" stroke="${INK}" stroke-width="2" fill="none"/></g>
      <g><animateTransform attributeName="transform" type="translate" values="0 0;0 0;-16 0;0 0;0 0" keyTimes="0;0.2;0.42;0.55;1" ${loop(4)}/>
      <ellipse cx="62" cy="142" rx="9" ry="7.5" fill="${FUR}" stroke="${INK}" stroke-width="3"/></g>`,
  },
  // Tucks its paws in, squints happily and purrs.
  loaf: {
    skin: 'cat',
    ms: 8000,
    eyes: 'happy',
    mouth: 'smile',
    tempo: 3.6,
    art: `<ellipse cx="86" cy="189" rx="10" ry="5" fill="${FUR}" stroke="${INK}" stroke-width="2.5"/>
      <ellipse cx="114" cy="189" rx="10" ry="5" fill="${FUR}" stroke="${INK}" stroke-width="2.5"/>
      <g stroke="#d9822b" stroke-width="2" fill="none" stroke-linecap="round">
      <path d="M150 128 q5 -5 0 -10"><animate attributeName="opacity" values="0;1;0" ${loop(1.6)}/></path>
      <path d="M158 132 q7 -9 0 -18"><animate attributeName="opacity" values="0;0;1;0" ${loop(1.6)}/></path></g>`,
  },
  // A battery on its chest fills, then gets a check mark.
  recharge: {
    skin: 'robot',
    ms: 6000,
    eyes: 'narrow',
    mouth: 'flat',
    light: '#69db7c',
    art: `<rect x="80" y="135" width="36" height="22" rx="4" fill="#1d2433" stroke="#4a5568" stroke-width="2.5"/>
      <rect x="116" y="141" width="4" height="10" rx="1.5" fill="#4a5568"/>
      <rect x="84" y="139" width="0" height="14" rx="2" fill="#69db7c"><animate attributeName="width" values="0;28;28" keyTimes="0;0.75;1" ${loop(6)}/></rect>
      <path d="M92 146 L97 151 L106 140" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0"><animate attributeName="opacity" values="0;0;1;1" keyTimes="0;0.75;0.8;1" ${loop(6)}/></path>`,
  },
  // Its antenna catches a tune and it bops along.
  radio: {
    skin: 'robot',
    ms: 6000,
    eyes: 'happy',
    mouth: 'smile',
    bounce: true,
    tempo: 0.5,
    light: '#ffd43b',
    isAntennaWiggling: true,
    art: `<g font-family="sans-serif" font-weight="bold" fill="#ffd43b">
      <text x="118" y="30" font-size="18">♪<animate attributeName="y" values="34;0" ${loop(1.8)}/><animate attributeName="opacity" values="0;1;0" ${loop(1.8)}/></text>
      <text x="132" y="30" font-size="16">♫<animate attributeName="y" values="40;4" begin="-0.6s" ${loop(1.8)}/><animate attributeName="opacity" values="0;1;0" begin="-0.6s" ${loop(1.8)}/></text>
      <text x="66" y="30" font-size="16">♪<animate attributeName="y" values="38;2" begin="-1.2s" ${loop(1.8)}/><animate attributeName="opacity" values="0;1;0" begin="-1.2s" ${loop(1.8)}/></text></g>`,
  },
  // A joint squeaks; out comes the oil can.
  oil: {
    skin: 'robot',
    ms: 8000,
    eyes: 'wide',
    mouth: 'o',
    art: `<text x="14" y="128" font-size="15" font-weight="bold" font-family="sans-serif" fill="#ff922b" opacity="0">eek!<animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;0.05;0.3;0.35;1" ${loop(4)}/></text>
      <g opacity="0"><animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;0.3;0.35;0.85;0.9;1" ${loop(4)}/>
      <g transform="rotate(25 40 110)"><rect x="28" y="102" width="20" height="16" rx="3" fill="#ffa94d" stroke="#4a5568" stroke-width="2"/>
      <path d="M48 106 L62 98" stroke="#4a5568" stroke-width="3" stroke-linecap="round"/><path d="M30 102 q8 -10 16 0" stroke="#4a5568" stroke-width="2" fill="none"/></g>
      <circle cx="64" cy="110" r="2.5" fill="#495057"><animate attributeName="cy" values="110;132" ${loop(0.6)}/></circle></g>`,
  },
  // Juggles three bolts and drops a fourth.
  juggle: {
    skin: 'robot',
    ms: 10000,
    eyes: 'up',
    mouth: 'smile',
    tempo: 0.35,
    art:
      [0, -0.5, -1]
        .map(
          begin => `<g><animateMotion path="M54 168 C54 108 146 108 146 168 C146 150 54 150 54 168" begin="${begin}s" ${loop(1.5)}/>
      <rect x="-5" y="-5" width="10" height="10" rx="2" fill="#adb5bd" stroke="#4a5568" stroke-width="2" transform="rotate(45)"/><circle r="2" fill="#4a5568"/></g>`,
        )
        .join('') +
      `<g opacity="0"><animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;0.7;0.72;0.95;1" ${loop(5)}/>
      <animateTransform attributeName="transform" type="translate" values="0 0;0 0;14 24;14 24" keyTimes="0;0.72;0.82;1" ${loop(5)}/>
      <rect x="141" y="163" width="10" height="10" rx="2" fill="#adb5bd" stroke="#4a5568" stroke-width="2"/></g>
      <text x="40" y="52" font-size="30" font-weight="bold" font-family="sans-serif" fill="#f59f00" opacity="0">!<animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;0.72;0.74;0.95;1" ${loop(5)}/></text>`,
  },
  // A laser from its eye sweeps the room and beeps at a fly.
  scan: {
    skin: 'robot',
    ms: 6000,
    eyes: 'side',
    mouth: 'flat',
    light: '#ff6b6b',
    art: `<g><animateTransform attributeName="transform" type="rotate" values="-30 114 80;25 114 80;-30 114 80" ${loop(3)}/>
      <line x1="120" y1="80" x2="200" y2="80" stroke="#ff4d4d" stroke-width="2.5" opacity="0.85"/><circle cx="200" cy="80" r="3" fill="#ff4d4d"/></g>
      <g><animateMotion path="M160 30 q10 -10 20 0 t-10 15 t-15 -10 z" ${loop(1.2)}/>
      <circle r="2.5" fill="#212529"/><ellipse cx="-2" cy="-3" rx="2.5" ry="1.5" fill="#dee2e6"/><ellipse cx="2" cy="-3" rx="2.5" ry="1.5" fill="#dee2e6"/></g>
      <text x="146" y="64" font-size="12" font-family="monospace" font-weight="bold" fill="#ff6b6b">beep!<animate attributeName="opacity" values="0;1;0" ${loop(1.5)}/></text>`,
  },
  // Its face shows a loading bar, then says hello.
  reboot: {
    skin: 'robot',
    ms: 5000,
    eyes: 'off',
    mouth: 'off',
    light: '#4dabf7',
    art: `<g><animate attributeName="opacity" values="1;1;0;0" keyTimes="0;0.65;0.68;1" ${loop(5)}/>
      <text x="100" y="72" font-size="9" text-anchor="middle" fill="${GLOW}" font-family="monospace">REBOOT</text>
      <rect x="72" y="80" width="56" height="10" rx="3" fill="none" stroke="${GLOW}" stroke-width="2"/>
      <rect x="75" y="83" width="0" height="4" rx="1.5" fill="${GLOW}"><animate attributeName="width" values="0;12;14;40;50;50" keyTimes="0;0.15;0.3;0.45;0.62;1" ${loop(5)}/></rect></g>
      <text x="100" y="88" font-size="15" font-weight="bold" text-anchor="middle" fill="${GLOW}" font-family="sans-serif" opacity="0">Hello!<animate attributeName="opacity" values="0;0;1;1" keyTimes="0;0.68;0.7;1" ${loop(5)}/></text>`,
  },
}

const ALL = Object.keys(ANTIC_LOOKS) as Antic[]
export const ANTICS: Record<Skin, readonly Antic[]> = {
  cat: ALL.filter(antic => ANTIC_LOOKS[antic].skin === 'cat'),
  robot: ALL.filter(antic => ANTIC_LOOKS[antic].skin === 'robot'),
}

// Asleep, the cat dreams of a mouse scurrying by.
export const CAT_DREAM = `<g fill="#fff" stroke="#9aa3b5" stroke-width="2">
    <circle cx="140" cy="64" r="3.5"/><circle cx="150" cy="51" r="5.5"/><ellipse cx="172" cy="27" rx="26" ry="19"/></g>
  <clipPath id="mb-dream"><ellipse cx="172" cy="27" rx="24" ry="17"/></clipPath>
  <g clip-path="url(#mb-dream)"><path d="M146 38 L198 38" stroke="#e9ecef" stroke-width="2"/>
    <g><animateTransform attributeName="transform" type="translate" values="-34 0;34 0" ${loop(2.4)}/>
    <g><animateTransform attributeName="transform" type="translate" values="0 0;0 -2;0 0" ${loop(0.3)}/>
    <path d="M164 33 q-6 -5 -11 0" stroke="#adb5bd" stroke-width="1.5" fill="none"/>
    <ellipse cx="171" cy="32" rx="8" ry="5" fill="#adb5bd"/><circle cx="179" cy="30" r="4" fill="#adb5bd"/>
    <circle cx="178" cy="26" r="2.5" fill="#ffc9c9" stroke="#adb5bd"/><circle cx="181" cy="29.5" r="0.9" fill="${INK}"/></g></g></g>
  <text x="124" y="46" font-size="11" font-weight="bold" font-family="sans-serif" fill="#8ea0c8">z<animate attributeName="opacity" values="0;1;0" ${loop(3)}/></text>`

// Powered down, the robot dreams in 1s and 0s floating up.
export const ROBOT_DREAM = [146, 160, 174, 188, 18, 32, 46, 168]
  .map(
    (x, i) =>
      `<text x="${x}" y="70" font-size="12" font-family="monospace" font-weight="bold" fill="${GLOW}" opacity="0">${i % 2 === 0 ? '0' : '1'}<animate attributeName="y" values="74;8" begin="${-i * 0.45}s" ${loop(3.6)}/><animate attributeName="opacity" values="0;0.85;0" begin="${-i * 0.45}s" ${loop(3.6)}/></text>`,
  )
  .join('')
