import type { Antic, Mood, Skin } from '../types'

// Moods read from the reply's words outrank moods read from what Claude is
// doing, so a "correcting" face isn't replaced by "talking" a moment later.
export const STRONG: ReadonlySet<Mood> = new Set([
  'correcting',
  'disapproving',
  'happy',
  'apologetic',
  'curious',
  'oops',
])

type Rule = { mood: Mood; weight: number; pattern: RegExp }

const RULES: readonly Rule[] = [
  { mood: 'correcting', weight: 3, pattern: /\bactually\b/i },
  { mood: 'correcting', weight: 3, pattern: /\b(that'?s|this is) not (quite|right|correct)\b/i },
  { mood: 'correcting', weight: 3, pattern: /\b(incorrect|isn'?t (quite )?right|a common misconception)\b/i },
  { mood: 'correcting', weight: 2, pattern: /\b(to clarify|small correction|the (real )?issue is|in fact)\b/i },

  { mood: 'disapproving', weight: 3, pattern: /\b(i'?d|i would) (recommend|advise) against\b/i },
  { mood: 'disapproving', weight: 3, pattern: /\b(not a good idea|bad idea|i (can'?t|won'?t|shouldn'?t) (help|do))\b/i },
  { mood: 'disapproving', weight: 2, pattern: /\b(risky|dangerous|unsafe|be careful|don'?t do this|strongly discourage)\b/i },

  { mood: 'apologetic', weight: 3, pattern: /\b(sorry|my mistake|my bad|i apologi[sz]e|you'?re (absolutely )?right)\b/i },

  // Single cheerful words are common in plain prose, so it takes two of them.
  { mood: 'happy', weight: 1, pattern: /\b(great|perfect|nice|awesome|excellent)\b/i },
  { mood: 'happy', weight: 1, pattern: /\b(done|fixed|success(fully)?|all set)\b/i },
  { mood: 'happy', weight: 3, pattern: /(all (\d+ )?tests pass|✓|✅|🎉)/i },

  { mood: 'curious', weight: 2, pattern: /\b(could you clarify|can you (tell|share)|which (one|do you)|do you want)\b/i },
]

const THRESHOLD = 2

// Scores the recent reply text against the rules; null when nothing stands
// out, so the caller keeps the mood that comes from what Claude is doing.
export function classifyText(text: string): Mood | null {
  const scores = new Map<Mood, number>()
  for (const rule of RULES) {
    if (rule.pattern.test(text)) {
      scores.set(rule.mood, (scores.get(rule.mood) ?? 0) + rule.weight)
    }
  }
  // A reply that ends asking something reads as curious.
  if (/\?\s*$/.test(text)) scores.set('curious', (scores.get('curious') ?? 0) + 2)

  let best: Mood | null = null
  let bestScore = THRESHOLD - 1
  for (const [mood, score] of scores) {
    if (score > bestScore) {
      best = mood
      bestScore = score
    }
  }

  return best
}

const SEARCH_TOOLS = /^(Read|Grep|Glob|WebFetch|WebSearch|LS|ToolSearch)$/
export function toolMood(tool: string): Mood {
  return SEARCH_TOOLS.test(tool) ? 'searching' : 'working'
}

const LINES: Record<Mood, readonly string[]> = {
  idle: ['…', '*hums*', '*stretches*'],
  sleepy: ['Zzz…', '*yawn*'],
  listening: ['Ooh, a new message!', "I'm all ears!", 'Whatcha got?'],
  thinking: ['Hmm…', 'Let me think…', '*ponders*'],
  talking: ['Blah blah…', 'So here’s the thing…', 'Typing away!'],
  working: ['On it!', '*tap tap tap*', 'Building…'],
  searching: ['Looking…', 'Where is it…', 'Investigating!'],
  correcting: ['Ahem, actually…', 'Small correction!', 'Not quite…'],
  disapproving: ['Hmm, I wouldn’t…', 'Tsk tsk.', 'Careful there…'],
  happy: ['Yay!', 'Nailed it!', 'Done!'],
  apologetic: ['Oops, my bad!', 'Sorry!', 'You’re right!'],
  curious: ['Hmm? Tell me more!', 'Question time!'],
  oops: ['Uh oh…', 'That didn’t work…', 'Eek!'],
}

// What each character mumbles in its sleep.
const DREAMS: Record<Skin, readonly string[]> = {
  cat: ['Zzz… mice…', '*dreams of mice*', 'mrrp… zzz…'],
  robot: ['Zzz… 01001…', '*low power mode*', 'beep… zzz…'],
}

const ANTIC_LINES: Record<Antic, readonly string[]> = {
  groom: ['*lick lick*', 'Gotta look my best.'],
  yarn: ['Mine!', '*bap*'],
  butterfly: ['Ooh, a butterfly!', '*wiggles*… pounce!'],
  cup: ['Oops.', '*innocent look*'],
  loaf: ['*purrs*', '*slow blink*'],
  recharge: ['Recharging…', 'Battery: full!'],
  radio: ['♪ beep boop ♪', 'This one’s a banger.'],
  oil: ['*squeak*… ahh, better.', 'Eek! Oil time.'],
  juggle: ['Watch this!', 'Bolt, bolt, bolt… oops.'],
  scan: ['Scanning…', 'Fly detected!'],
  reboot: ['Rebooting…', 'Hello, world!'],
}

function pick(lines: readonly string[]): string {
  return lines[Math.floor(Math.random() * lines.length)] ?? ''
}

export function lineFor(mood: Mood, skin?: Skin): string {
  return pick(mood === 'sleepy' && skin !== undefined ? DREAMS[skin] : LINES[mood])
}

export function anticLine(antic: Antic): string {
  return pick(ANTIC_LINES[antic])
}
