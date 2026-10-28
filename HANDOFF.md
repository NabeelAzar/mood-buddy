# mood-buddy: handoff to a local session

This file hands off work that started in a Claude Code cloud session. The cloud app could not
draw plugin interfaces (`/buddy` reported `no-surface: no surface is attached`), so development
continues on a local computer, where the pane can actually be seen.

## Setup on your computer (you)

1. Unzip `mood-buddy.zip` somewhere permanent, for example `~/mood-buddy`. The folder must hold
   `.claude-plugin/plugin.json`. Unzipping can hide dot-folders, so check that it's there.
2. Open a terminal in that folder and start Claude Code with the plugin loaded:
   ```
   cd ~/mood-buddy
   claude --plugin-dir .
   ```
3. Run `/buddy`. You should see a side pane with an animated cat. If not, the reply says why.
4. Paste the prompt below to give the new session its context.

## Prompt to paste into the new local session

> I'm continuing work on a Claude Code plugin ("mod") called mood-buddy, in this folder. Read
> `HANDOFF.md` and `README.md` first, then load the `plugin-authoring` skill before changing any
> code. Start by running `claude plugin validate .` and `claude plugin test .`, and check that
> `/buddy` shows the pane in this session. Then help me with: <what you want next>.

## What it is

A cat or robot in a side pane that acts out Claude's mood while it works. It uses no AI and no
credits: the mood comes from session events and keyword rules applied to the reply text.

| Signal | Mood |
|---|---|
| `prompt.submit` | listening |
| `turn.step` thinking chunks | thinking |
| `turn.step` text chunks | talking, or a keyword mood (below) |
| `turn.step` tool chunks / `tool.call` | working (Bash, Edit…) or searching (Read, Grep, Web…) |
| a tool call that returns `isError` | oops |
| `turn.complete` | happy (or refusal → disapproving, error → oops), then idle |
| 90 s with no activity | sleepy |

Keyword moods (correcting, disapproving, apologetic, happy, curious) are scored by weighted
regexes over the last 400 characters of the reply. They hold for 3.5 s against busier moods, so
the face doesn't flicker. Subagent turns are ignored.

## Files

| File | What it holds |
|---|---|
| `.claude-plugin/plugin.json` | manifest (name, version, MIT license, `types`) |
| `hooks/hooks.json` | lists the hooks module |
| `hooks/register.tsx` | all hooks: session start, `/buddy` command, prompt, `turn.step` stream, tool calls, turn end, pane and band rendering |
| `hooks/moods.ts` | keyword rules, weights, threshold, tool→mood map, speech-bubble lines |
| `hooks/antics.ts` | idle antics (5 cat, 6 robot) and the two dreams: pose changes, SVG overlay, length. `register.tsx` plays a random one every 15–25 s while idle (`playAntic`); any mood change stops it. The 90 s nap waits for a playing antic to finish (`isSleepDue`). Asleep, it wakes every 1–2 min (`wake`): the wake-up antic (`stretch` / `powerup`, `isWakeUp`, never picked at random), two random antics 3 s apart (`WAKE_ANTICS`), then `sleepy` again. The mood atom carries `antic` (tag `mood-2`). |
| `hooks/sprites.ts` | the pose per mood and the cat and robot SVG builders. Animation is SMIL inside the SVG, so the pane redraws only on mood changes. Also the text faces for the terminal. |
| `types/index.d.ts` | state contract: `mood` and `skin` atoms under `mood-buddy` |
| `desktop/` | the desktop overlay: `MoodBuddy.cs` (C# 5 WinForms + WebView2, borderless always-on-top window that watches `~/.claude/mood-buddy/state.json`), `index.html` + `renderer.js` (the page it shows), `build.cmd` downloads the WebView2 SDK DLLs into `lib/` (git-ignored) from nuget.org, checksum-pinned, `build.cmd` (builds `build/` with Windows' own csc.exe) |
| `hooks/buddy.test.tsx` | 13 tests: classifier cases, sprites for every mood, pane rendering, the no-pane fallback |

## Where it shows

- **Pane** (`ui.render` on `Pane`, id `mood-buddy`): a 180 px animated SVG, a speech bubble, the
  mood name, and a "Switch to robot/cat" button. The terminal gets a text face instead.
- **Band above the prompt**: a 64 px version, drawn only when the pane isn't placed.
- **Status line**: the text face and bubble, always.
- Commands: `/buddy`, `/buddy cat`, `/buddy robot` (the choice is saved in `$.store`), and
  `/buddy status`.

## Status

- Validator passes (warning: no `author`). Type-check passes. All 13 tests pass.
- **Seen live 2026-10-27** in the Claude desktop app (Code tab): the pane opens with `/buddy`, the
  cat's SMIL animation runs, and listening, thinking, working, searching, correcting,
  disapproving, apologetic, curious and oops were seen firing (from a debug log). Fixed then: a busier
  mood arriving during a keyword mood's 3.5 s hold was dropped; it now queues until the hold ends.
  The hold fix has no unit test yet. Not yet checked:
  - The moods change at the right moments and don't flicker.
  - The terminal shows the text face (`e.surface === 'terminal'` picks it; the terminal's element
    table still reports `Svg`, which is why `'Svg' in ui` alone was not enough).
- A still-frame preview of all 26 drawings looked right.
- Desktop overlay added 2026-10-27. First built on Electron, then replaced by a C# + WebView2 app
  because Electron is ~190 MB and needs npm. Builds cleanly and **seen running 2026-10-27** when opened by hand. Open
  `desktop/build/MoodBuddy.exe` from Explorer. `TransparencyKey` plus a transparent WebView2
  background gives a see-through window (confirmed): only the cat and bubble show.
  But Windows then hit-tests the keyed window as empty, so every click passed through, the cat
  included. Fixed with a low-level mouse hook (`WH_MOUSE_LL`) that catches presses inside the
  areas the page reports (`hit:` messages from `renderer.js`); drag and right-click menu not yet
  confirmed. The process is DPI-aware so window, page and hook coordinates agree.

## Gotchas learned so far

- Plugin names can't start with `claude-`, which is why it's `mood-buddy`.
- `$.ui.open` returns `{ isPlaced, reason }`. Panes opened without the person asking only appear
  on wide terminals (144+ columns), so run `/buddy` to place it at any width.
- Hooks on `prompt.submit` and `tool.call` have a `.catch` so a failure never blocks Claude.
- The `turn.step` hook must be an `async function*` that yields every chunk unchanged.
- In tests, mock the clock and store (`mock.clock(on)`, `mock.store(on)`) and answer `ui.status`.
- Type-check needs the engine's types. Once the plugin loads, the engine writes them to
  `.claude-plugin/types/` and a `tsconfig.json`, and `tsc -p .` works.

- **Sandbox, learned the hard way:** on this machine Claude Code's tools and the mod's
  `$.process`/`$.fs` run in a sandbox with a private copy of `%LOCALAPPDATA%` (writes there are
  invisible outside), and programs started from it can't start child processes
  (Chromium helpers die with 0xC0000022). Files under `~/.claude` and the project folder are real.
  So the overlay is started by the person, and the state file lives in `~/.claude/mood-buddy/`.

## Ideas for next steps

- Tune `moods.ts` against real replies, and add rules where moods are missed or false.
- Maybe drop the status line when the pane is placed, since it repeats the pane.
- Sound effects (`$.audio.play`) with a mute toggle, more skins, and an animation-speed setting.
- Publish: a GitHub repo with `.claude-plugin/marketplace.json`, installed with
  `/plugin install mood-buddy --marketplace <owner>/<repo>`.
