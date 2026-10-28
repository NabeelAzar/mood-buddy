import { describe, expect, mock, test } from 'claude-code/testing'

import { classifyText, toolMood } from './moods'
import { ANTICS } from './antics'
import { sprite } from './sprites'

describe('classifyText', () => {
  const cases: [string, string | null][] = [
    ["Actually, that's not quite right: the loop runs twice.", 'correcting'],
    ["I'd recommend against force-pushing to main.", 'disapproving'],
    ["That's risky, be careful with rm -rf.", 'disapproving'],
    ["Sorry, my mistake, you're right.", 'apologetic'],
    ['All 12 tests pass ✅', 'happy'],
    ['Great, the fix is done.', 'happy'],
    ['Which one do you want me to keep?', 'curious'],
    ['Here is the function that parses the config file.', null],
    ['Great question.', null],
  ]
  for (const [text, mood] of cases) {
    test(`"${text}" reads as ${mood ?? 'nothing in particular'}`, async () => {
      expect(classifyText(text)).toBe(mood)
    })
  }
})

test('tools map to working or searching', async () => {
  expect(toolMood('Grep')).toBe('searching')
  expect(toolMood('Bash')).toBe('working')
})

test('every antic draws as an svg, only on its own character', async () => {
  for (const skin of ['cat', 'robot'] as const) {
    for (const antic of ANTICS[skin]) {
      const svg = sprite(skin, 'idle', antic)
      expect(svg.startsWith('<svg')).toBe(true)
      expect(svg.includes(`(${antic})`)).toBe(true)
      expect(svg.length < 131072).toBe(true)
    }
  }
  expect(sprite('robot', 'idle', 'groom')).toBe(sprite('robot', 'idle'))
})

test('every skin draws every mood as an svg', async () => {
  const moods = ['idle', 'sleepy', 'listening', 'thinking', 'talking', 'working', 'searching', 'correcting', 'disapproving', 'happy', 'apologetic', 'curious', 'oops'] as const
  for (const skin of ['cat', 'robot'] as const) {
    for (const mood of moods) {
      const svg = sprite(skin, mood)
      expect(svg.startsWith('<svg')).toBe(true)
      expect(svg.length < 131072).toBe(true)
    }
  }
})

const PANE = {
  plugin: 'mood-buddy',
  component: 'Pane',
  requestId: 'mood-buddy',
  props: {
    title: 'Buddy',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

test('the pane shows the mood after a tool call, on every surface', async ($, on) => {
  on('command.register', () => ({ value: { command: 'buddy' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: {} }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.tool.call({ tool: 'Grep', pattern: 'x' })

  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: 'searching' }))?.text).toBe('searching')
    await ui.unmount()
  }
})

test('/buddy says why when the app cannot place the pane, and the band shows the buddy', async ($, on) => {
  mock.clock(on)
  mock.store(on)
  const statuses: unknown[] = []
  on('ui.status', (_, e) => {
    statuses.push(e)
    return { value: undefined }
  })
  on('command.register', () => ({ value: { command: 'buddy' } }))
  on('ui.open', () => ({ value: { isPlaced: false, reason: 'no surface here places panes' } }))
  on('ui.panes', () => ({ value: [{ id: 'mood-buddy', title: 'Buddy', isShown: false, isFocused: false, isPlaced: false }] }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: {} }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ran = await $.command.run({
    command: 'buddy',
    args: '',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 100 },
  })
  expect(String(ran.text)).toContain('no surface here places panes')

  await $.tool.call({ tool: 'Bash', command: 'ls' })
  const ui = await $.ui.mount({ plugin: 'mood-buddy', component: 'AbovePrompt', surface: 'terminal',
    props: { hasSurvey: false, isWorking: true, maxRows: 6, bodyColumns: 80, scroll: { offset: 0, bodyRows: 6 }, view: {} },
  })
  expect((await ui.find({ type: 'Text', text: /⌨/ }))?.text).toContain('⌨')
  await ui.unmount()
  expect(JSON.stringify(statuses)).toContain('⌨')
})
