# Working on mood-buddy

Notes for changing the plugin. What it does for people who install it is in `README.md`.

## Run it from this folder

```
claude --plugin-dir .
```

Then run `/buddy`. With the `--plugin-dir` folder loaded, an edit reloads the plugin when the turn
that made it ends. Before committing:

```
claude plugin validate .
claude plugin test .
```

Run from a folder outside `.claude`, the mod can't find `~/.claude` (it works that out from the
folder it's installed in, and reads no environment variables), so it doesn't write `state.json`
and `/buddy desktop` says so. To work on the desktop buddy, load the plugin from under `.claude`,
or build with `desktop\build.cmd` and start `desktop\build\MoodBuddy.exe` with the mood folder as
its argument.

Raise `version` in `.claude-plugin/plugin.json` with every release: the Claude directory serves a
new version only when it goes up.

## How the mood is chosen

It uses no AI and no credits: the mood comes from session events and keyword rules applied to
the reply text.

| Signal | Mood |
|---|---|
| `prompt.submit` | listening |
| `turn.step` thinking chunks | thinking |
| `turn.step` text chunks | talking, or a keyword mood (below) |
| `turn.step` tool chunks / `tool.call` | working (Bash, Edit…) or searching (Read, Grep, Web…) |
| a tool call that returns `isError` | oops |
| `turn.complete` | happy (or refusal → disapproving, error → oops), then idle |
| 90 s after the last activity | sleepy |

Keyword moods (correcting, disapproving, apologetic, happy, curious) are scored by weighted
regexes over the last 400 characters of the reply. They hold for 3.5 s; a busier mood that
arrives meanwhile is queued until the hold ends, so the face doesn't flicker. Subagent turns
are ignored.

## Files

| File | What it holds |
|---|---|
| `.claude-plugin/plugin.json` | manifest (name, version, author, MIT license, `types`) |
| `.claude-plugin/marketplace.json` | makes this repository a marketplace with the one plugin |
| `hooks/hooks.json` | lists the hooks module |
| `hooks/register.tsx` | all hooks: session start, `/buddy` command, prompt, `turn.step` stream, tool calls, turn end, pane and band rendering, the idle and sleep cycle, and `/buddy desktop` |
| `hooks/moods.ts` | keyword rules, weights, threshold, tool→mood map, speech-bubble lines |
| `hooks/antics.ts` | idle antics (5 cat, 6 robot), the two wake-ups and the two dreams: pose changes, SVG overlay, length |
| `hooks/paths.ts` | the plugin's folder, worked out from the module's own `import.meta.url`, and Windows path spelling |
| `hooks/sprites.ts` | the pose per mood and the cat and robot SVG builders. Animation is SMIL inside the SVG, so the pane redraws only on mood changes. Also the text faces for the terminal. |
| `types/index.d.ts` | state contract: `mood`, `skin` and `hidden` atoms under `mood-buddy` |
| `desktop/` | the desktop buddy: `MoodBuddy.cs` (C# 5 WinForms + WebView2), `index.html` + `renderer.js` (the page it shows), `build.cmd [folder]` |
| `hooks/buddy.test.tsx` | tests: classifier cases, sprites for every mood and antic, pane rendering, the no-pane fallback |

## The idle cycle

While idle, `playAntic` plays a random antic every 15–25 s; any mood change stops it. The 90 s
nap waits for a playing antic to finish (`isSleepDue`). Asleep, `wake` runs every 1–2 min: the
wake-up antic (`stretch` / `powerup`, marked `isWakeUp` so it's never picked at random), two
random antics 3 s apart (`WAKE_ANTICS`), then `sleepy` again. The mood atom carries `antic`
(tag `mood-2`).

## Where it shows

- **Pane** (`ui.render` on `Pane`, id `mood-buddy`): a 180 px animated SVG, a speech bubble, the
  mood name, a "Switch to robot/cat" button, and the command list. The terminal gets a text face
  instead (`e.surface === 'terminal'`; the terminal's element table still reports `Svg`).
- **Band above the prompt**: a 64 px version, drawn only when the pane isn't placed.
- **Status line**: the text face and bubble.
- `/buddy off` hides all three (the `hidden` atom, kept in `$.store`) until the next `/buddy`.

## The desktop buddy

`MoodBuddy.exe` is a borderless, always-on-top window whose WebView2 draws whatever the mod last
wrote to `~/.claude/mood-buddy/state.json`. `TransparencyKey` plus a transparent WebView2
background gives a see-through window. Windows then hit-tests the keyed window as empty, so a
low-level mouse hook (`WH_MOUSE_LL`) catches presses inside the areas the page reports (`hit:`
messages from `renderer.js`) for dragging and the right-click menu. The process is DPI-aware so
window, page and hook coordinates agree. `/buddy desktop off` writes `control.json`, which the
window watches and closes on.

The mod runs no programs: a mod that calls `$.process.run` is held for review as running a shell
and a downloader. `/buddy desktop` (`prepareOverlay`) hashes the four desktop sources and compares
that with `~/.claude/mood-buddy/app/source.sha256`. When they match, it copies the exe's path with
`$.ui.copy`; otherwise it copies the build command, `"<plugin>\desktop\build.cmd"
"<.claude>\mood-buddy\app" <fingerprint>`. Either way the person runs it with Win+R, outside the
sandbox. Given a folder, `build.cmd` closes a running buddy (`taskkill`, since the exe is locked
while it runs), builds, writes the fingerprint to `source.sha256`, starts the new buddy, and
pauses on an error so its window can be read.

`build.cmd` compiles with the .NET Framework's own C# compiler, which takes C# 5 only (no string
interpolation, no `?.`). The comments at its top say how it fetches and checks the WebView2 SDK.
It names the System32 copies of the Windows tools it uses by full path, because Git for Windows
puts a GNU `tar` on PATH that reads `C:` as a host name.

`build.cmd` has no labels, `call`s or `goto`s, the part of a batch file that breaks with Unix line
endings, so it works whichever line endings git checks it out with. Don't add a `.gitattributes`
to fix line endings instead: the Claude directory refuses to validate a repository whose
`.gitattributes` rewrites file contents (`eol=crlf` included).

## Gotchas

- The Claude directory reads a mod's use of `$` from the source and accepts only two forms: a
  plain call `$.noun.method(...)` with nothing wrapped around its parts, and `$` passed whole to a
  function declared at the top level of the same file. So no `(await $.x.y())`, no `.catch`
  chained on a call or on `on(...)`, no `$.plugin.root` (a property, not a call; `hooks/paths.ts`
  works the folder out from `import.meta.url` instead, and `~/.claude` from that), and no passing `$` to imported helpers
  such as the library's `read`/`update` (the `readMood`/`writeMood` helpers call `$.state`
  directly). `claude plugin validate` doesn't check this; the developer portal's **Validate** does.

- Plugin names can't start with `claude-`, which is why it's `mood-buddy`.
- `$.ui.open` returns `{ isPlaced, reason }`. Panes opened without the person asking only appear
  on wide terminals (144+ columns), so run `/buddy` to place it at any width.
- The `turn.step` hook must be an `async function*` that yields every chunk unchanged.
- In tests, mock the clock and store (`mock.clock(on)`, `mock.store(on)`) and answer `ui.status`.
- Type-check needs the engine's types. Once the plugin loads, the engine writes them to
  `.claude-plugin/types/` and a `tsconfig.json`, and `tsc -p .` works.
- Claude Code can run its tools, and a mod's `$.process` and `$.fs`, in a sandbox. Seen on
  Windows: writes under the local app-data folder went to a private copy that nothing outside could see,
  programs it started couldn't start child processes (Chromium helpers died with 0xC0000022), and
  starting `explorer.exe` did nothing. Files under `~/.claude` were real. That's why the desktop
  buddy is built and started by the person, its files live in `~/.claude/mood-buddy/`, and the
  command goes on the clipboard instead of opening Explorer.

## Not yet checked

- The terminal's text face, live.
- A unit test for the hold queue and the idle cycle's timing.

## Ideas

- Tune `moods.ts` against real replies, and add rules where moods are missed or false.
- Maybe drop the status line when the pane is placed, since it repeats the pane.
- Sound effects (`$.audio.play`) with a mute toggle, more characters, an animation-speed setting.
- A desktop buddy for macOS.
