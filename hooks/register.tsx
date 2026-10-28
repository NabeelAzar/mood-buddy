import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { Antic, BuddyMood, Mood, Skin } from '../types'
import { ANTICS, ANTIC_LOOKS, WAKE_ANTIC } from './antics'
import { STRONG, anticLine, classifyText, lineFor, toolMood } from './moods'
import { face, sprite } from './sprites'

const PANE = 'mood-buddy'
const TITLE = 'Buddy'

// Change a tag when its value's fields change: it declines what an earlier
// version stored, which outlives a reload.
const moodAtom = atom({ plugin: 'mood-buddy', key: 'mood' } as const, { mood: 'idle', bubble: '' } as BuddyMood, {
  shape: 'mood-2',
})
const skinAtom = atom({ plugin: 'mood-buddy', key: 'skin' } as const, 'cat' as Skin, { shape: 'skin-1' })
const hiddenAtom = atom({ plugin: 'mood-buddy', key: 'hidden' } as const, false as boolean, { shape: 'hidden-1' })

// How long a mood read from the reply's words holds against busier moods.
const HOLD_MS = 3500
const HAPPY_MS = 2500
const SLEEP_MS = 90_000
// While idle, an antic starts after a random wait in this range.
const ANTIC_WAIT_MS = [20_000, 40_000] as const
// Asleep, it wakes after a random wait in this range for a stretch and one antic.
const WAKE_WAIT_MS = [180_000, 360_000] as const
// How much new reply text arrives before it is scored again.
const RESCORE_CHARS = 40
const WINDOW_CHARS = 400

let current: Mood = 'idle'
let currentSkin: Skin = 'cat'
let holdUntil = 0
let settle: Timer | undefined
let sleep: Timer | undefined
let release: Timer | undefined
let currentBubble = ''
let stateDir: string | undefined
let writing: Promise<void> = Promise.resolve()
// "/buddy off" hides the buddy inside Claude (pane, band, status line) until "/buddy";
// the desktop buddy keeps following the moods.
let isHidden = false
let currentAntic: Antic | undefined
let lastAntic: Antic | undefined
let anticTimer: Timer | undefined

// Listed by "/buddy help" and under the buddy in the pane.
const COMMANDS: readonly (readonly [string, string])[] = [
  ['/buddy', 'open the Buddy pane (and show the buddy again after /buddy off)'],
  ['/buddy cat', 'switch to the cat (remembered)'],
  ['/buddy robot', 'switch to the robot (remembered)'],
  ['/buddy off', 'hide the buddy in Claude: pane, band and status line (remembered)'],
  ['/buddy desktop', 'how to put the buddy on the Windows desktop'],
  ['/buddy desktop off', 'close the desktop buddy'],
  ['/buddy status', 'current mood, character and pane'],
  ['/buddy help', 'this list'],
]

// The status line shows on every surface, panes or not.
function showStatus($: EngineInterface): void {
  $.ui.status(isHidden ? undefined : `${face(currentSkin, current, currentAntic)} ${currentBubble}`)
}

async function setHidden($: EngineInterface, hidden: boolean): Promise<void> {
  isHidden = hidden
  await update($, hiddenAtom, () => hidden)
  showStatus($)
  await $.store.set('hidden', hidden)
}

async function setMood($: EngineInterface, mood: Mood, isForced = false): Promise<void> {
  const now = Date.now()
  const blocked = !isForced && !STRONG.has(mood) && now < holdUntil
  // A busier mood that arrives during a hold shows when the hold ends, unless
  // something newer replaces it first.
  release?.cancel()
  release = undefined
  if (blocked) {
    release = $.clock.after(holdUntil - now, () => void setMood($, mood))
    return
  }
  if (STRONG.has(mood)) holdUntil = now + HOLD_MS
  else if (isForced) holdUntil = 0

  sleep?.cancel()
  sleep = mood === 'sleepy' ? undefined : $.clock.after(SLEEP_MS, () => void setMood($, 'sleepy', true))

  // Anything that happens ends an antic; settling into idle lines up the next,
  // falling asleep lines up the next wake-up.
  const wasPlaying = currentAntic !== undefined
  stopAntics()
  if (mood === 'idle') scheduleAntic($)
  else if (mood === 'sleepy') scheduleWake($)
  if (mood === current && !isForced && !wasPlaying) return
  current = mood
  await show($, lineFor(mood, currentSkin))
}

// Draws the current mood (and antic) everywhere: status line, desktop file, pane.
async function show($: EngineInterface, bubble: string): Promise<void> {
  currentBubble = bubble
  showStatus($)
  publish($)
  const mood = current
  const antic = currentAntic
  await update($, moodAtom, () => (antic === undefined ? { mood, bubble } : { mood, bubble, antic }))
}

function stopAntics(): void {
  anticTimer?.cancel()
  anticTimer = undefined
  currentAntic = undefined
}

function scheduleAntic($: EngineInterface): void {
  const [least, most] = ANTIC_WAIT_MS
  anticTimer = $.clock.after(least + Math.random() * (most - least), () => void playAntic($))
}

// Picks one of the character's antics (not the last one) and shows it for its
// length; then waits for the next one, or after a wake-up dozes off again.
async function playAntic($: EngineInterface, isThenAsleep = false): Promise<void> {
  if (current !== 'idle') return
  const choices = ANTICS[currentSkin].filter(antic => antic !== lastAntic)
  const antic = choices[Math.floor(Math.random() * choices.length)]
  if (antic === undefined) return
  lastAntic = antic
  currentAntic = antic
  anticTimer = $.clock.after(ANTIC_LOOKS[antic].ms, () => {
    currentAntic = undefined
    if (isThenAsleep) {
      void setMood($, 'sleepy', true)
      return
    }
    scheduleAntic($)
    void show($, lineFor('idle'))
  })
  await show($, anticLine(antic))
}

function scheduleWake($: EngineInterface): void {
  const [least, most] = WAKE_WAIT_MS
  anticTimer = $.clock.after(least + Math.random() * (most - least), () => void wake($))
}

// Now and then a napping buddy wakes, stretches, plays one antic and dozes off again.
async function wake($: EngineInterface): Promise<void> {
  if (current !== 'sleepy') return
  current = 'idle'
  const stretch = WAKE_ANTIC[currentSkin]
  currentAntic = stretch
  anticTimer = $.clock.after(ANTIC_LOOKS[stretch].ms, () => void playAntic($, true))
  await show($, anticLine(stretch))
}

// The desktop overlay (desktop/) draws whatever this file last said.
function publish($: EngineInterface): void {
  if (stateDir === undefined) return
  const file = `${stateDir}/state.json`
  const text = JSON.stringify({
    mood: current,
    bubble: currentBubble,
    skin: currentSkin,
    antic: currentAntic,
    svg: sprite(currentSkin, current, currentAntic),
    at: Date.now(),
  })
  writing = writing.then(() => $.fs.write(file, text)).catch(() => undefined)
}

// The overlay is started by the person, not from here: a program Claude Code
// starts can run sandboxed, and WebView2 can't start its own processes there.
async function overlayHelp($: EngineInterface): Promise<string> {
  if (stateDir === undefined) return "The desktop buddy can't run here: USERPROFILE isn't set."
  const exe = `${$.plugin.root}/desktop/build/MoodBuddy.exe`.replaceAll('/', '\\')
  if (!(await $.fs.exists(exe))) {
    return `The desktop buddy isn't built yet: run ${$.plugin.root.replaceAll('/', '\\')}\\desktop\\build.cmd first.`
  }
  return `To put the buddy on your desktop, open ${exe} from File Explorer (pin it to Start to reopen it later). It follows this session's moods while it runs; right-click it or run /buddy desktop off to close it.`
}

async function setSkin($: EngineInterface, skin: Skin, isSaved = true): Promise<void> {
  currentSkin = skin
  // The other character's antic would make no sense on this one; settle back
  // into idle, which also restarts the clock toward a nap.
  if (currentAntic !== undefined) {
    await setMood($, 'idle', true)
  } else {
    publish($)
    showStatus($)
  }
  await update($, skinAtom, () => skin)
  if (isSaved) await $.store.set('skin', skin)
}

function openPane($: EngineInterface) {
  return $.ui.open({ id: PANE, title: TITLE })
}

async function isPanePlaced($: EngineInterface): Promise<boolean> {
  return (await $.ui.panes()).some(pane => pane.id === PANE && pane.isPlaced)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'buddy',
      description: 'Show the mood buddy; "/buddy help" lists the options',
      argumentHint: '[cat | robot | off | desktop | desktop off | status | help]',
    })
    isHidden = (await $.store.get('hidden')) === true
    await update($, hiddenAtom, () => isHidden)
    // Under ~/.claude, which a sandboxed Claude Code still writes for real, so
    // the overlay outside the sandbox sees the same file.
    const home = await $.env.get('USERPROFILE')
    if (home !== undefined) stateDir = `${home.replaceAll('\\', '/')}/.claude/mood-buddy`
    const saved = await $.store.get('skin')
    if (saved === 'cat' || saved === 'robot') await setSkin($, saved, false)
    if (!isHidden) void openPane($)
    void setMood($, 'idle', true)

    return next(e)
  })

  on('command.run', { command: 'buddy' }, async ($, e) => {
    const choice = e.args.trim().toLowerCase().replace(/\s+/g, ' ')
    if (choice === 'status') {
      const panes = await $.ui.panes()
      const lines = panes.map(pane => `${pane.id}: ${pane.isPlaced ? 'placed' : 'not placed'}`)
      return { text: `Mood: ${current}, skin: ${currentSkin}. Panes: ${lines.join('; ') || 'none open'}.` }
    }
    if (choice === 'desktop off') {
      // The overlay runs outside Claude Code, so it is asked to close through a file it watches.
      if (stateDir === undefined) return { text: "Can't reach the desktop buddy: USERPROFILE isn't set." }
      await $.fs.write(`${stateDir}/control.json`, JSON.stringify({ action: 'quit', at: Date.now() }))
      return { text: 'Asked the desktop buddy to close. It goes within a second if it was running.' }
    }
    if (choice === 'desktop') {
      return { text: await overlayHelp($) }
    }
    if (choice === 'off') {
      await setHidden($, true)
      await $.ui.close({ id: PANE })
      return { text: 'Buddy is hidden in Claude (remembered). Run /buddy to bring it back. A desktop buddy keeps running; /buddy desktop off closes it.' }
    }
    if (choice !== '' && choice !== 'cat' && choice !== 'robot') {
      const intro = choice === 'help' || choice === '?' ? '' : `"${choice}" isn't a /buddy option. `
      return {
        text: [
          `${intro}/buddy options:`,
          ...COMMANDS.map(([command, what]) => `  ${command.padEnd(18)}  ${what}`),
        ].join('\n'),
      }
    }
    if (isHidden) await setHidden($, false)
    if (choice === 'cat' || choice === 'robot') await setSkin($, choice)

    const opened = await openPane($)
    const intro = choice === 'cat' || choice === 'robot' ? `Buddy is now a ${choice}. ` : ''
    return {
      text: opened.isPlaced
        ? `${intro}Buddy pane opened.`
        : `${intro}This app can't show the Buddy pane (${opened.reason}), so Buddy lives in the status line and above the prompt instead.`,
    }
  })

  on('prompt.submit', async ($, e, next) => {
    void setMood($, 'listening', true)

    return next(e)
  }).catch(($, e, next) => next(e))

  on('turn.step', async function* ($, e, next) {
    // Subagents' steps are background work; the buddy follows the main thread.
    if (e.agentId !== undefined) return yield* next(e)

    let text = ''
    let scoredAt = 0
    for await (const chunk of next(e)) {
      yield chunk
      if (chunk.kind === 'thinking') {
        void setMood($, 'thinking')
      } else if (chunk.kind === 'text') {
        text = (text + chunk.text).slice(-WINDOW_CHARS)
        scoredAt += chunk.text.length
        if (scoredAt >= RESCORE_CHARS || /[.!?]\s*$/.test(chunk.text)) {
          scoredAt = 0
          void setMood($, classifyText(text) ?? 'talking')
        }
      } else if (chunk.kind === 'tool') {
        void setMood($, toolMood(chunk.name))
      }
    }
  })

  on('tool.call', async ($, e, next) => {
    void setMood($, toolMood(e.tool))
    const ran = await next(e)
    if (ran.isError === true) void setMood($, 'oops')

    return ran
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId !== undefined) return done

    settle?.cancel()
    // The turn is over, so a busy mood still waiting on a hold no longer applies.
    release?.cancel()
    release = undefined
    if (e.reason === 'refusal') {
      await setMood($, 'disapproving', true)
    } else if (e.reason === 'error') {
      await setMood($, 'oops', true)
    } else if (e.reason === 'answer' && !STRONG.has(current)) {
      await setMood($, 'happy')
    }
    // Let the last face show for a moment, then relax.
    const wait = Math.max(HAPPY_MS, holdUntil - Date.now())
    settle = $.clock.after(wait, () => void setMood($, 'idle', true))

    return done
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const ui = $.ui.resolve(e)
    const { Box, Text, Button } = ui
    const { mood, bubble, antic } = await read($, moodAtom)
    const skin = await read($, skinAtom)
    const other: Skin = skin === 'cat' ? 'robot' : 'cat'
    const switchSkin = () => setSkin($, other)

    return (
      <Box flexDirection="column" alignItems="center" gap={1} padding={1}>
        {bubble !== '' && <Text italic>“{bubble}”</Text>}
        {e.surface !== 'terminal' && 'Svg' in ui ? (
          <ui.Svg source={sprite(skin, mood, antic)} alt={`${skin} looking ${antic ?? mood}`} width={180} height={180} isInteractive />
        ) : (
          <Text bold>{face(skin, mood, antic)}</Text>
        )}
        <Text dimColor size="caption">
          {antic ?? mood}
        </Text>
        <Button key="skin" plain dimColor onPress={switchSkin}>
          Switch to {other}
        </Button>
        <Box flexDirection="column" alignSelf="flex-start" gap={1} marginTop={1}>
          <Text bold size="caption">
            Commands
          </Text>
          {COMMANDS.map(([command, what]) => (
            <Box key={command} flexDirection="column">
              <Text size="caption">{command}</Text>
              <Text dimColor size="caption">
                {what}
              </Text>
            </Box>
          ))}
        </Box>
      </Box>
    )
  })

  // Where the pane can't be placed, a small buddy sits above the prompt.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || (await read($, hiddenAtom)) || (await isPanePlaced($))) return next(e)

    const ui = $.ui.resolve(e)
    const { Box, Text } = ui
    const { mood, bubble, antic } = await read($, moodAtom)
    const skin = await read($, skinAtom)

    return (
      <Box flexDirection="row" alignItems="center" gap={1}>
        {e.surface !== 'terminal' && 'Svg' in ui ? (
          <ui.Svg source={sprite(skin, mood, antic)} alt={`${skin} looking ${antic ?? mood}`} width={64} height={64} isInteractive />
        ) : (
          <Text bold>{face(skin, mood, antic)}</Text>
        )}
        <Text italic dimColor>
          {bubble}
        </Text>
      </Box>
    )
  })
}
