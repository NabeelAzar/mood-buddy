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
const ANTIC_WAIT_MS = [15_000, 25_000] as const
// Asleep, it wakes after a random wait in this range, stretches, plays
// WAKE_ANTICS antics with a short pause between them, and dozes off again.
const WAKE_WAIT_MS = [60_000, 120_000] as const
const WAKE_ANTICS = 2
const WAKE_PAUSE_MS = 3000
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
// Nap time came while an antic was playing: sleep once it finishes.
let isSleepDue = false

// Listed by "/buddy help" and under the buddy in the pane.
const COMMANDS: readonly (readonly [string, string])[] = [
  ['/buddy', 'open the Buddy pane (and show the buddy again after /buddy off)'],
  ['/buddy cat', 'switch to the cat (remembered)'],
  ['/buddy robot', 'switch to the robot (remembered)'],
  ['/buddy off', 'hide the buddy in Claude: pane, band and status line (remembered)'],
  ['/buddy desktop', 'put the buddy on the Windows desktop (builds it the first time)'],
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
  isSleepDue = false
  sleep =
    mood === 'sleepy'
      ? undefined
      : $.clock.after(SLEEP_MS, () => {
          if (currentAntic === undefined) void setMood($, 'sleepy', true)
          else isSleepDue = true
        })

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

// Picks one of the character's antics (not the last one) and plays it to the
// end. Awake, the next one follows a wait, or a nap if one came due meanwhile.
// During a wake-up, `wakeLeft` counts this antic and the ones still to come;
// after the last, it dozes off again.
async function playAntic($: EngineInterface, wakeLeft?: number): Promise<void> {
  if (current !== 'idle') return
  const choices = ANTICS[currentSkin].filter(antic => antic !== lastAntic)
  const antic = choices[Math.floor(Math.random() * choices.length)]
  if (antic === undefined) return
  lastAntic = antic
  currentAntic = antic
  anticTimer = $.clock.after(ANTIC_LOOKS[antic].ms, () => {
    currentAntic = undefined
    if (wakeLeft !== undefined) {
      if (wakeLeft <= 1) {
        void setMood($, 'sleepy', true)
        return
      }
      anticTimer = $.clock.after(WAKE_PAUSE_MS, () => void playAntic($, wakeLeft - 1))
    } else if (isSleepDue) {
      void setMood($, 'sleepy', true)
      return
    } else {
      scheduleAntic($)
    }
    void show($, lineFor('idle'))
  })
  await show($, anticLine(antic))
}

function scheduleWake($: EngineInterface): void {
  const [least, most] = WAKE_WAIT_MS
  anticTimer = $.clock.after(least + Math.random() * (most - least), () => void wake($))
}

// Now and then a napping buddy wakes, stretches, plays a couple of antics and dozes off again.
async function wake($: EngineInterface): Promise<void> {
  if (current !== 'sleepy') return
  current = 'idle'
  const stretch = WAKE_ANTIC[currentSkin]
  currentAntic = stretch
  anticTimer = $.clock.after(ANTIC_LOOKS[stretch].ms, () => void playAntic($, WAKE_ANTICS))
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

const windowsPath = (path: string) => path.replaceAll('/', '\\')

// What the desktop buddy is built from; when any of these change, it is rebuilt.
const OVERLAY_SOURCES = ['MoodBuddy.cs', 'index.html', 'renderer.js', 'build.cmd'] as const

async function overlayFingerprint($: EngineInterface, sourceDir: string): Promise<string> {
  const texts = await Promise.all(OVERLAY_SOURCES.map(name => $.fs.read(`${sourceDir}/${name}`)))
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texts.join('\u0000')))
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

async function requestOverlayQuit($: EngineInterface): Promise<void> {
  if (stateDir === undefined) return
  await $.fs.write(`${stateDir}/control.json`, JSON.stringify({ action: 'quit', at: Date.now() }))
}

// Builds the desktop buddy into ~/.claude/mood-buddy/app (the same place for
// every session and plugin version, so a pinned shortcut keeps working), again
// only when its sources change, then shows it in File Explorer. It is opened by
// the person, not from here: a program Claude Code starts can run sandboxed,
// and WebView2 can't start its own processes there.
async function prepareOverlay($: EngineInterface): Promise<string> {
  if ((await $.env.get('OS')) !== 'Windows_NT') return 'The desktop buddy is Windows-only for now.'
  if (stateDir === undefined) return "The desktop buddy can't be set up here: USERPROFILE isn't set."
  const sourceDir = `${$.plugin.root}/desktop`
  const appDir = `${stateDir}/app`
  const exe = windowsPath(`${appDir}/MoodBuddy.exe`)
  const fingerprintFile = `${appDir}/source.sha256`
  const fingerprint = await overlayFingerprint($, sourceDir)
  const hasExe = await $.fs.exists(exe)
  const builtFrom = hasExe && (await $.fs.exists(fingerprintFile)) ? (await $.fs.read(fingerprintFile)).trim() : ''
  let intro = ''
  if (builtFrom !== fingerprint) {
    // A running buddy locks its program file, so it is asked to close first.
    if (hasExe) {
      await requestOverlayQuit($)
      await $.clock.sleep(1500)
    }
    // `call` keeps cmd from stripping the quotes around paths with spaces.
    const built = await $.process.run(
      ['cmd.exe', '/d', '/c', 'call', windowsPath(`${sourceDir}/build.cmd`), windowsPath(appDir)],
      { timeoutMs: 180_000 },
    )
    if (built.exitCode !== 0) {
      const why = `${built.stdout}\n${built.stderr}`.trim().split(/\r?\n/).pop() ?? 'unknown error'
      return [
        `Couldn't build the desktop buddy here (${why}).`,
        'Build it yourself in a Command Prompt, then run /buddy desktop again:',
        `  "${windowsPath(`${sourceDir}/build.cmd`)}" "${windowsPath(appDir)}"`,
      ].join('\n')
    }
    await $.fs.write(fingerprintFile, fingerprint)
    intro = hasExe ? 'Updated the desktop buddy (it closed to update; open it again). ' : 'Built the desktop buddy. '
  }
  // Explorer opens its window in the person's own session, outside any sandbox.
  await $.process.run(['explorer.exe', `/select,${exe}`]).catch(() => undefined)
  return [
    `${intro}Double-click MoodBuddy.exe in the File Explorer window to put the buddy on your desktop.`,
    `It's at ${exe}; pin it to Start to reopen it any time.`,
    'It follows your Claude sessions while it runs; right-click it or run /buddy desktop off to close it.',
  ].join('\n')
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
      await requestOverlayQuit($)
      return { text: 'Asked the desktop buddy to close. It goes within a second if it was running.' }
    }
    if (choice === 'desktop') {
      return { text: await prepareOverlay($) }
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
